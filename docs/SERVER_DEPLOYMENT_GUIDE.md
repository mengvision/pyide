# PyIDE 云服务器部署指南

> 本文档介绍如何将 PyIDE 后端部署到 Ubuntu 服务器，并在 Windows 桌面端连接远程内核。

---

## 1. 概述

PyIDE 采用**分离式部署架构**：服务端运行在 Ubuntu Linux 上，桌面 IDE 运行在 Windows 本地，两者通过 HTTP/WebSocket 通信。

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Ubuntu Server                               │
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────────────┐  │
│  │PostgreSQL│    │  Redis   │    │   FastAPI (api container)    │  │
│  │  :5432   │◄───│  :6379   │◄───│          :8000               │  │
│  └──────────┘    └──────────┘    │   ┌──────────────────────┐   │  │
│                                  │   │  Kernel Manager      │   │  │
│                                  │   │  ┌────┐ ┌────┐ ┌───┐ │   │  │
│                                  │   │  │py1 │ │py2 │ │...│ │   │  │
│                                  │   │  └────┘ └────┘ └───┘ │   │  │
│                                  │   └──────────────────────┘   │  │
│                                  └──────────────────────────────┘  │
│                                           ▲                         │
│  ┌──────────────────────────┐             │ Docker internal network │
│  │  Nginx (web container)   │             │                         │
│  │         :3000            │─────proxy───┘                         │
│  └──────────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────────┘
                        ▲                ▲
                        │ HTTP REST      │ WebSocket (JSON-RPC 2.0)
                        │                │
┌─────────────────────────────────────────────────────────────────────┐
│                    Windows Desktop (Tauri)                          │
│                                                                     │
│   ┌────────────────────────────────────────────────────────────┐   │
│   │  React Frontend                                            │   │
│   │  Login → Editor → Terminal → AI Chat                      │   │
│   └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 核心服务说明

| 组件 | 技术栈 | 说明 |
|------|--------|------|
| `api` | FastAPI + Python | 提供 REST API 和 WebSocket 接口，管理 PyKernel 进程 |
| `db` | PostgreSQL 16 | 持久化存储用户、项目、会话数据 |
| `redis` | Redis 7 | Session 缓存、消息队列 |
| `web` | React + Nginx | 浏览器版前端（可选） |
| 桌面 IDE | Tauri + React | Windows 原生桌面应用，内嵌 WebView2 |

---

## 2. 前置条件

### 2.1 服务器要求

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| 操作系统 | Ubuntu 20.04 LTS | Ubuntu 22.04 LTS |
| CPU | 2 核 | 4 核+ |
| 内存 | 4 GB | 8 GB+ |
| 磁盘 | 10 GB | 40 GB+ SSD |
| 网络 | 局域网可达 | 公网 IP 或反向代理 |

### 2.2 安装 Docker 和 Docker Compose

在服务器上执行以下命令：

```bash
# 更新包索引
sudo apt update

# 安装依赖
sudo apt install -y ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG 密钥
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 添加 Docker 仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine 和 Compose 插件
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 将当前用户加入 docker 组（免 sudo）
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker --version
docker compose version
```

---

## 3. 服务端部署步骤

### 3.1 将项目传输到服务器

**方式一：SCP 上传（从 Windows 本地）**

```powershell
# 在 Windows PowerShell 中执行
# 将整个项目目录上传到服务器家目录
scp -r C:\Users\lenovo\Desktop\python_ide1 user@SERVER_IP:~/pyide
```

**方式二：Git Clone（在服务器上执行）**

```bash
# 在服务器上
git clone https://github.com/yourname/python_ide1.git ~/pyide
cd ~/pyide
```

进入项目目录（后续所有命令均在此目录执行）：

```bash
cd ~/pyide
```

---

### 3.2 环境变量配置（.env）

#### 工作原理

Docker Compose 会**自动读取**与 `docker-compose.yml` 同目录的 `.env` 文件，并将其中的变量注入到 YAML 中的 `${VAR:-default}` 占位符。

例如，在 `docker-compose.lan.yml` 中：

```yaml
ports:
  - "${API_PORT:-8000}:8000"
```

- 若 `.env` 中设置了 `API_PORT=8080`，则宿主机端口映射为 `8080:8000`
- 若未设置，则默认使用 `8000:8000`

#### 创建 .env 文件

```bash
# 以 .env.lan.example 为模板创建 .env
cp .env.lan.example .env

# 编辑配置
nano .env
```

#### 关键环境变量说明

```dotenv
# ── 数据库 ──────────────────────────────────────────────────────────
# PostgreSQL 用户名
POSTGRES_USER=pyide_user

# PostgreSQL 密码（请修改为强密码）
POSTGRES_PASSWORD=your_strong_password_here

# PostgreSQL 数据库名
POSTGRES_DB=pyide_db

# ── 安全 ────────────────────────────────────────────────────────────
# JWT 签名密钥（必须修改！用下方命令生成）
# openssl rand -hex 32
SECRET_KEY=your_secret_key_here_at_least_32_chars

# ── 服务地址 ─────────────────────────────────────────────────────────
# 服务器的完整 URL，供前端/桌面客户端填写
# 替换 SERVER_IP 为实际 IP 地址
SERVER_URL=http://192.168.1.100:8000

# API 监听端口（宿主机端口，可修改以避免冲突）
API_PORT=8000

# ── Redis ────────────────────────────────────────────────────────────
# Redis 连接 URL（容器内部名称 redis，无需修改）
REDIS_URL=redis://redis:6379/0

# ── 数据持久化 ────────────────────────────────────────────────────────
# 内核进程的工作目录（宿主机路径）
PYIDE_DATA_DIR=/data/pyide

# ── 内核端口范围 ──────────────────────────────────────────────────────
# 每个用户的 PyKernel 进程会分配此范围内的端口
KERNEL_PORT_START=9000
KERNEL_PORT_END=9999
```

#### 生成安全的 SECRET_KEY

```bash
openssl rand -hex 32
# 示例输出: a3f8c2e1d4b5...（将输出复制到 .env 中的 SECRET_KEY）
```

> **警告**：请勿在生产环境中使用示例中的默认密码。`POSTGRES_PASSWORD` 和 `SECRET_KEY` 必须修改为强随机值。

---

### 3.3 理解 docker-compose.lan.yml

项目使用 `docker-compose.lan.yml` 定义局域网/服务器部署配置。以下是各服务的说明：

```yaml
services:
  # ── 数据库 ──────────────────────────────────────────────────────────
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-pyide_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: ${POSTGRES_DB:-pyide_db}
    volumes:
      - pgdata:/var/lib/postgresql/data   # 数据持久化
    # 注意：db 服务不暴露端口到宿主机，只在 Docker 内部网络可访问

  # ── 缓存 ────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    # 同样不对外暴露，仅内部访问

  # ── FastAPI 后端 ─────────────────────────────────────────────────────
  api:
    build: .
    ports:
      - "${API_PORT:-8000}:8000"   # 宿主机端口:容器端口
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      REDIS_URL: ${REDIS_URL:-redis://redis:6379/0}
      SECRET_KEY: ${SECRET_KEY}
    depends_on:
      - db
      - redis

  # ── Web 前端（浏览器版，可选）────────────────────────────────────────
  web:
    build:
      context: ./apps/web
    ports:
      - "3000:80"   # Nginx 在容器内监听 80，映射到宿主机 3000
```

#### 关键概念：Docker 内部 DNS vs 宿主机端口

| 访问方式 | 地址 | 适用场景 |
|---------|------|---------|
| 容器间通信（内部 DNS） | `http://api:8000` | Nginx proxy_pass、容器间 API 调用 |
| 从宿主机访问 | `http://localhost:${API_PORT}` | 调试、健康检查 |
| 从局域网其他机器访问 | `http://SERVER_IP:${API_PORT}` | 桌面 IDE 连接 |

Nginx 的 `proxy_pass` 使用的是 Docker 内部名称 `api:8000`，与宿主机暴露的端口无关：

```nginx
# nginx.lan.conf 中
location /api/ {
    proxy_pass http://api:8000/;   # Docker 内部 DNS，始终是 8000
}
```

---

### 3.4 运行部署脚本

```bash
# 进入项目根目录
cd ~/pyide

# 【重要】修复 Windows CRLF 换行符（见常见问题 Q1）
sed -i 's/\r$//' deploy-lan.sh

# 赋予执行权限
chmod +x deploy-lan.sh

# 执行部署
./deploy-lan.sh
```

脚本会自动完成：拉取镜像 → 构建容器 → 创建网络和卷 → 启动所有服务。

---

### 3.5 验证部署

#### 检查容器状态

```bash
docker compose -f docker-compose.lan.yml ps
```

期望输出：所有服务状态为 `Up` 或 `healthy`：

```
NAME           IMAGE      STATUS          PORTS
pyide-db-1     postgres   Up (healthy)    5432/tcp
pyide-redis-1  redis      Up              6379/tcp
pyide-api-1    pyide_api  Up (healthy)    0.0.0.0:8000->8000/tcp
pyide-web-1    pyide_web  Up              0.0.0.0:3000->80/tcp
```

#### 健康检查

```bash
# 检查 API 健康端点
curl http://localhost:8000/health

# 期望返回
{"status": "ok", "version": "x.x.x"}
```

#### 查看日志

```bash
# 查看所有服务日志
docker compose -f docker-compose.lan.yml logs -f

# 仅查看 API 服务日志
docker compose -f docker-compose.lan.yml logs -f api

# 查看数据库日志
docker compose -f docker-compose.lan.yml logs db
```

---

## 4. 桌面 IDE 配置（Windows）

### 4.1 前置依赖

在 Windows 上构建并运行 Tauri 桌面应用，需要以下依赖：

| 依赖 | 用途 | 安装方式 |
|------|------|---------|
| Node.js 18+ | 前端构建 | https://nodejs.org |
| Rust 工具链 | Tauri 编译 | `winget install Rustlang.Rustup` |
| Visual Studio C++ Build Tools | Rust 编译依赖 | VS Installer 或 winget |
| WebView2 Runtime | Tauri 内嵌浏览器 | Windows 11 自带；Win10 需手动安装 |

**安装 Rust（必须，见常见问题 Q4）：**

```powershell
# 方式一：winget（推荐）
winget install Rustlang.Rustup

# 方式二：官网下载
# 访问 https://rustup.rs 下载 rustup-init.exe 并运行

# 安装完成后验证
rustc --version
cargo --version
```

**安装 Visual Studio C++ Build Tools：**

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
# 安装时勾选 "C++ build tools" 工作负载
```

### 4.2 构建和运行桌面 IDE

```powershell
# 进入桌面应用目录
cd apps\desktop

# 安装 npm 依赖
npm install

# 开发模式运行（热重载）
npm run dev

# 生产构建（打包为 .exe 安装程序）
npm run tauri build
```

### 4.3 连接到远程服务器

1. 启动桌面 IDE 后，进入**登录界面**
2. 将 **Server URL** 修改为服务器地址，例如：
   ```
   http://192.168.1.100:8000
   ```
3. 输入用户名和密码，点击登录

> Server URL 会被持久化保存在本地设置中，下次启动无需重新填写。

#### 相关源码文件

| 文件 | 说明 |
|------|------|
| `apps/desktop/src/components/layout/Login.tsx` | 登录界面，含 Server URL 输入框 |
| `apps/desktop/src/stores/settingsStore.ts` | 本地设置存储，持久化 `serverUrl` |
| `apps/desktop/src/hooks/useRemoteKernel.ts` | WebSocket 连接逻辑，连接远程内核 |
| `apps/desktop/src/stores/uiStore.ts` | `kernelMode` 状态：`'local'` 或 `'remote'` |

---

## 5. 防火墙配置

### Ubuntu UFW 配置

```bash
# 开放 API 端口（必须）
sudo ufw allow 8000/tcp

# 开放 Web 前端端口（可选，仅需要浏览器访问时）
sudo ufw allow 3000/tcp

# PostgreSQL 和 Redis 不需要对外开放
# 它们仅在 Docker 内部网络通信

# 查看防火墙规则
sudo ufw status verbose
```

### 云服务器安全组

若使用阿里云、腾讯云、AWS 等云平台，还需在**安全组**中添加入站规则：

| 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|
| TCP | 8000（或 API_PORT） | 0.0.0.0/0 或内网 CIDR | API 访问 |
| TCP | 3000 | 0.0.0.0/0 | Web 前端（可选） |
| TCP | 22 | 管理 IP | SSH 管理 |

> **最小权限原则**：生产环境建议将来源限制为特定 IP 段，而非 `0.0.0.0/0`。

---

## 6. 安全建议

### 6.1 局域网部署 vs 生产环境

| 项目 | 局域网（内网） | 生产环境（公网） |
|------|-------------|----------------|
| 传输加密 | 可不使用 HTTPS | **必须** 使用 HTTPS |
| SECRET_KEY | 随机生成即可 | 定期轮换，妥善保管 |
| DB 密码 | 强密码 | 强密码 + 不对外暴露端口 |
| 身份认证 | JWT（30 min 过期） | JWT + 考虑 MFA |

### 6.2 配置 HTTPS（生产环境推荐）

**方式一：Let's Encrypt 免费证书（需要公网域名）**

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书（替换为实际域名）
sudo certbot --nginx -d pyide.yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

**方式二：自签名证书（局域网）**

```bash
# 生成自签名证书
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/pyide.key \
  -out /etc/ssl/certs/pyide.crt \
  -subj "/CN=192.168.1.100"
```

### 6.3 其他安全最佳实践

```bash
# 1. 禁止 root SSH 登录
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl reload sshd

# 2. 定期更新系统
sudo apt update && sudo apt upgrade -y

# 3. 启用自动安全更新
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

---

## 7. 常见问题 / 故障排查

### Q1：deploy-lan.sh 报错"解释器错误，没有那个文件或目录"

**现象：**

```
bash: ./deploy-lan.sh: /bin/bash^M: bad interpreter: No such file or directory
```

**原因：**

在 Windows 下编辑或传输的文件，行尾使用 CRLF（`\r\n`）换行符。Linux 的 shebang 解析会将 `#!/bin/bash\r` 视为完整的解释器路径，导致找不到该路径而报错。

**解决方案：**

```bash
# 方案一：使用 sed 原地替换（推荐）
sed -i 's/\r$//' deploy-lan.sh

# 方案二：安装并使用 dos2unix
sudo apt install dos2unix
dos2unix deploy-lan.sh

# 验证修复
file deploy-lan.sh
# 期望输出: deploy-lan.sh: Bourne-Again shell script, ASCII text executable
# （不应出现 "with CRLF line terminators"）
```

> **预防措施**：在 Git 仓库根目录创建 `.gitattributes` 文件，添加 `*.sh text eol=lf`，确保 shell 脚本始终使用 LF 换行符。

---

### Q2：脚本报错"无法获取 '.env.lan.example' 的文件状态"

**现象：**

```
stat: cannot statx '.env.lan.example': No such file or directory
```

**原因：**

- 没有在项目根目录运行脚本（当前目录不对）
- 或者文件传输时遗漏了 `.env.lan.example`

**解决方案：**

```bash
# 确认当前目录
pwd
# 应输出类似: /home/user/pyide

# 确认文件存在
ls -la .env.lan.example

# 若目录不对，先 cd
cd ~/pyide

# 若文件不存在，手动创建 .env（最小配置）
cat > .env << 'EOF'
POSTGRES_USER=pyide_user
POSTGRES_PASSWORD=changeme_please
POSTGRES_DB=pyide_db
SECRET_KEY=$(openssl rand -hex 32)
API_PORT=8000
SERVER_URL=http://YOUR_SERVER_IP:8000
REDIS_URL=redis://redis:6379/0
PYIDE_DATA_DIR=/data/pyide
KERNEL_PORT_START=9000
KERNEL_PORT_END=9999
EOF
```

---

### Q3：端口 8000 已被占用

**现象：**

```
Error response from daemon: driver failed programming external connectivity:
Bind for 0.0.0.0:8000 failed: port is already allocated
```

**原因：**

服务器上已有其他服务（如另一个 Web 应用、Jupyter 等）占用了 8000 端口。

**解决方案：**

```bash
# 查看哪个进程占用了端口
sudo lsof -i :8000
# 或
sudo ss -tlnp | grep 8000

# 在 .env 中修改 API_PORT 为空闲端口
echo "API_PORT=8080" >> .env

# 同时更新 SERVER_URL
# nano .env 将 SERVER_URL 改为 http://SERVER_IP:8080

# 重新启动服务
docker compose -f docker-compose.lan.yml down
docker compose -f docker-compose.lan.yml up -d
```

`docker-compose.lan.yml` 中的端口映射使用 `${API_PORT:-8000}` 语法，因此修改 `.env` 后无需修改 YAML 文件。

---

### Q4：Windows 桌面端报错 "cargo metadata command failed"

**现象：**

```
Error: cargo metadata command failed with
  error: No such file or directory (os error 2)
```

或者：

```
'cargo' 不是内部或外部命令，也不是可运行的程序或批处理文件。
```

**原因：**

Tauri 需要 Rust 工具链（`rustc` + `cargo`）来编译本地代码。未安装 Rust 工具链时会报此错误。

**解决方案：**

```powershell
# 方式一：使用 winget 安装
winget install Rustlang.Rustup

# 安装完成后，重启终端，验证安装
rustc --version   # rustc 1.xx.x (...)
cargo --version   # cargo 1.xx.x (...)

# 方式二：手动下载
# 访问 https://rustup.rs，下载 rustup-init.exe 并双击运行
# 按照提示选择默认安装（Default installation）
```

> **注意**：安装 Rust 后需要**重启终端**（或重新加载 PATH），否则 `cargo` 命令仍不可用。

---

### Q5：桌面 IDE 无法建立 WebSocket 连接

**现象：** 登录后内核无法连接，控制台显示 WebSocket 错误。

**排查步骤：**

```bash
# 1. 检查服务器 API 是否正常运行
curl http://SERVER_IP:8000/health

# 2. 检查服务器日志中是否有错误
docker compose -f docker-compose.lan.yml logs -f api

# 3. 测试 WebSocket 连接（需要 wscat 工具）
npm install -g wscat
wscat -c ws://SERVER_IP:8000/ws/kernel
```

**常见原因及解决：**

| 原因 | 解决方案 |
|------|---------|
| JWT Token 过期（默认 30 分钟） | 重新登录获取新 Token |
| 防火墙阻止端口 | 参考第 5 节开放端口 |
| Server URL 配置错误 | 检查 Login 界面的 Server URL 是否正确 |
| API 容器未启动 | `docker compose ... ps` 检查容器状态 |
| 网络不通 | `ping SERVER_IP` 检查网络连通性 |

---

### Q6：数据库连接错误 / API 启动失败

**现象：**

```
sqlalchemy.exc.OperationalError: could not connect to server: Connection refused
```

**原因：**

PostgreSQL 容器首次启动时需要 10-20 秒进行初始化（创建数据库、用户、运行初始化脚本）。API 容器可能比数据库先准备好，导致连接失败。

**解决方案：**

```bash
# 等待 15-30 秒后重启 API 服务
sleep 20
docker compose -f docker-compose.lan.yml restart api

# 查看数据库是否已就绪
docker compose -f docker-compose.lan.yml logs db | grep "ready to accept connections"

# 验证数据库连接（进入容器测试）
docker compose -f docker-compose.lan.yml exec db \
  psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "SELECT version();"
```

**其他常见原因：**

- `.env` 中 `POSTGRES_PASSWORD` 与数据库卷中已有的密码不一致（数据卷已有旧密码）
  - 解决：`docker compose ... down -v`（**警告：会删除所有数据**），然后重新启动

---

### Q7：桌面端构建报错 os error 267（仅 Windows）

**现象：**

```
Os { code: 267, kind: Other, message: "目录名称无效。" }
```

**原因：**

Tauri 开发模式下使用相对路径查找资源文件，但工作目录不在 `apps\desktop` 目录下。

**解决方案：**

```powershell
# 确保在正确目录执行命令
cd apps\desktop
npm run dev
```

---

## 8. 架构参考

### 8.1 数据流图

```
桌面 IDE (Windows Tauri)
    │
    │  1. HTTP POST /api/auth/login  →  获取 JWT Token
    │  2. HTTP POST /api/kernels     →  创建内核会话
    │  3. WS ws://host:port/ws/{id}  →  建立 WebSocket 通道
    │
    ▼
FastAPI 服务器
    │
    ├── 身份验证中间件 (JWT)
    ├── REST API 路由
    └── WebSocket 处理器
            │
            │  JSON-RPC 2.0 over WebSocket
            ▼
    Kernel Manager
            │
            ├── 为每个会话 fork PyKernel 进程
            └── 通过 ZMQ/内部通道转发消息
                    │
                    ▼
            PyKernel 进程
            (独立 Python 解释器，隔离的命名空间)
```

### 8.2 认证流程

```
客户端                          服务端
  │                               │
  │── POST /api/auth/login ───────►│
  │   {username, password}        │
  │                               │── 验证密码 (bcrypt)
  │                               │── 生成 JWT (exp: 30min)
  │◄── {access_token, user} ──────│
  │                               │
  │── WS /ws/{kernel_id} ─────────►│
  │   Header: Authorization:       │── 验证 JWT
  │   Bearer {token}              │── 建立 WebSocket 连接
  │◄─── WebSocket 连接建立 ────────│
  │                               │
  │── JSON-RPC 2.0 消息 ──────────►│
  │◄── 执行结果/输出 ──────────────│
```

### 8.3 通信协议

桌面 IDE 与后端之间使用 **JSON-RPC 2.0** over WebSocket：

```json
// 请求（客户端 → 服务端）
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "method": "execute_code",
  "params": {
    "code": "print('Hello, World!')",
    "kernel_id": "abc123"
  }
}

// 响应（服务端 → 客户端）
{
  "jsonrpc": "2.0",
  "id": "req-001",
  "result": {
    "output": "Hello, World!\n",
    "execution_count": 1,
    "status": "ok"
  }
}
```

### 8.4 服务端关键文件

| 文件路径 | 说明 |
|---------|------|
| `packages/server/` | FastAPI 应用主目录 |
| `packages/pykernel/` | Python 内核管理器 |
| `packages/protocol/` | 通信协议定义 |
| `docker-compose.lan.yml` | 局域网/服务器部署配置 |
| `Dockerfile` | API 服务镜像构建文件 |
| `deploy-lan.sh` | 一键部署脚本 |
| `.env.lan.example` | 环境变量模板 |

### 8.5 桌面端关键文件

| 文件路径 | 说明 |
|---------|------|
| `apps/desktop/src/App.tsx` | 应用根组件，路由和模式切换 |
| `apps/desktop/src/components/layout/Login.tsx` | 登录界面（含 Server URL 配置） |
| `apps/desktop/src/stores/settingsStore.ts` | 设置持久化（serverUrl 等） |
| `apps/desktop/src/stores/uiStore.ts` | UI 状态（kernelMode: local/remote） |
| `apps/desktop/src/hooks/useRemoteKernel.ts` | 远程内核 WebSocket 连接 |
| `apps/desktop/src-tauri/src/` | Rust 原生代码（文件系统、进程管理） |
| `apps/desktop/src-tauri/tauri.conf.json` | Tauri 应用配置 |

---

## 附录：常用命令速查

```bash
# ── 服务管理 ──────────────────────────────────────────────────────────

# 启动所有服务（后台运行）
docker compose -f docker-compose.lan.yml up -d

# 停止所有服务
docker compose -f docker-compose.lan.yml down

# 停止并删除数据卷（完全重置，谨慎操作）
docker compose -f docker-compose.lan.yml down -v

# 重新构建并启动（更新代码后使用）
docker compose -f docker-compose.lan.yml up -d --build

# 重启单个服务
docker compose -f docker-compose.lan.yml restart api

# ── 日志查看 ──────────────────────────────────────────────────────────

# 查看所有服务日志（实时）
docker compose -f docker-compose.lan.yml logs -f

# 查看最近 100 行日志
docker compose -f docker-compose.lan.yml logs --tail=100 api

# ── 调试 ──────────────────────────────────────────────────────────────

# 进入 API 容器 shell
docker compose -f docker-compose.lan.yml exec api bash

# 进入数据库容器
docker compose -f docker-compose.lan.yml exec db psql -U $POSTGRES_USER $POSTGRES_DB

# 查看容器资源使用
docker stats
```

---

*文档生成于 PyIDE 项目 · 如有问题请查阅 `docs/TROUBLESHOOTING_KERNEL_SPAWN.md` 或提交 Issue*
