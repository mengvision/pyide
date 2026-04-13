# PyIDE LAN Deployment Guide

## Overview

This guide explains how to deploy PyIDE (Python IDE) to your local network server and access it from your laptop or other devices on the same network.

---

## 1. Architecture & Implementation Principles

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    Your LAN Network                              │
│                                                                  │
│  ┌──────────────┐                           ┌────────────────┐  │
│  │   Laptop     │  HTTP/WS (port 3000,8000) │   Server       │  │
│  │   (Client)   │◄─────────────────────────►│   (Docker)     │  │
│  │   Browser    │                           │                │  │
│  └──────────────┘                           │  ┌──────────┐  │  │
│                                             │  │ Web UI   │  │  │
│                                             │  │ (Nginx)  │  │  │
│                                             │  └──────────┘  │  │
│                                             │        │       │  │
│                                             │  ┌──────────┐  │  │
│                                             │  │ API      │  │  │
│                                             │  │(FastAPI) │  │  │
│                                             │  └──────────┘  │  │
│                                             │   ↕      ↕     │  │
│                                             │  ┌────┐ ┌────┐ │  │
│                                             │  │ PG │ │Redis│ │  │
│                                             │  └────┘ └────┘ │  │
│                                             │                │  │
│                                             │  ┌──────────┐  │  │
│                                             │  │ Kernels  │  │  │
│                                             │  │(pykernel)│  │  │
│                                             │  └──────────┘  │  │
│                                             └────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

1. **Web UI (Port 3000)**: React SPA served by Nginx
   - Provides the IDE interface
   - Proxies `/api/*` and `/ws/*` to backend
   
2. **API Server (Port 8000)**: FastAPI backend
   - User authentication (JWT tokens)
   - File management
   - Kernel lifecycle management
   - MCP/Skills integration

3. **PostgreSQL Database**: User data, sessions, metadata

4. **Redis**: Caching, session management

5. **Pykernel**: Python execution engine (one process per user)

### Data Flow

```
User Action → Browser → Nginx (3000) → FastAPI (8000) → Database/Kernel
     ↑                                      ↓
     └─────────── WebSocket ───────────────┘
              (Kernel Output)
```

---

## 2. Security Risks & Mitigations

### ⚠️ Critical Risks

#### 1. **No HTTPS (Unencrypted Traffic)**
- **Risk**: All data (including passwords, code, API keys) transmitted in plain text
- **Impact**: Anyone on the network can sniff traffic
- **Mitigation**: 
  - For trusted LAN only (home/office)
  - Enable HTTPS with nginx (see `docker-compose.yml` nginx service)
  - Use self-signed certs or Let's Encrypt

#### 2. **No Firewall Rules**
- **Risk**: Ports 3000/8000 exposed to entire network
- **Impact**: Unauthorized access if network is compromised
- **Mitigation**:
  ```bash
  # On Linux server
  sudo ufw allow from 192.168.1.0/24 to any port 3000
  sudo ufw allow from 192.168.1.0/24 to any port 8000
  ```

#### 3. **Weak Default Secret Key**
- **Risk**: JWT tokens can be forged
- **Impact**: Authentication bypass
- **Mitigation**: ALWAYS change `SECRET_KEY` in `.env`

#### 4. **No Rate Limiting on API**
- **Risk**: Brute force attacks on login
- **Impact**: Account compromise
- **Mitigation**: Basic rate limiting is implemented (5 req/min on auth endpoints)

#### 5. **File System Access**
- **Risk**: Users can access server file system through code execution
- **Impact**: Potential data leakage or modification
- **Mitigation**:
  - User workspaces isolated under `/pyide-data/{user}/`
  - But Python code can still read/write anywhere server allows
  - **Critical**: Don't run on server with sensitive data!

#### 6. **No Resource Limits (Windows Docker)**
- **Risk**: Single user can consume all CPU/RAM
- **Impact**: Server becomes unresponsive
- **Mitigation**: 
  - Linux: Use cgroups (documented in `docs/02-kernel.md`)
  - Windows: Docker resource limits in Docker Desktop settings

### Security Checklist

- [ ] Change `SECRET_KEY` to a strong random value
- [ ] Use strong database password
- [ ] Restrict ports with firewall (allow only your IP range)
- [ ] Enable HTTPS for production use
- [ ] Regular backups of PostgreSQL data
- [ ] Monitor Docker container resource usage
- [ ] Don't store sensitive data on the server
- [ ] Update Docker images regularly

---

## 3. Deployment on Your Server

### Prerequisites

**Server Requirements**:
- Linux (Ubuntu 20.04+ recommended) or Windows with Docker Desktop
- Docker & Docker Compose installed
- 4GB+ RAM, 2+ CPU cores
- 10GB+ disk space
- Python 3.10+ (for kernel execution)

**Network Requirements**:
- Static IP address for the server (e.g., `192.168.1.100`)
- Port 3000 and 8000 accessible from your laptop

### Step-by-Step Deployment

#### Step 1: Prepare the Server

```bash
# SSH into your server
ssh user@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose (usually included with Docker)
docker compose version
```

#### Step 2: Transfer PyIDE Code

**Option A: Git Clone (Recommended)**
```bash
# On server
cd ~
git clone <your-repo-url> pyide
cd pyide
```

**Option B: SCP from Windows**
```powershell
# On your Windows laptop (PowerShell)
scp -r C:\Users\lenovo\Desktop\python_ide1 user@server-ip:~/pyide
```

#### Step 3: Configure Environment

```bash
# On server
cd ~/pyide

# Copy environment file
cp .env.lan.example .env

# Edit configuration
nano .env
```

**Minimum required changes**:
```bash
# Change these!
SECRET_KEY=$(openssl rand -hex 32)  # Generate random key
POSTGRES_PASSWORD=your-strong-password-here

# Server IP (for CORS if needed)
SERVER_URL=http://192.168.1.100:8000  # Replace with your server IP
```

#### Step 4: Build and Start Services

```bash
# Build and start all services
docker compose -f docker-compose.lan.yml up -d --build

# Check status
docker compose -f docker-compose.lan.yml ps

# View logs
docker compose -f docker-compose.lan.yml logs -f
```

Expected output:
```
NAME                IMAGE                    STATUS
python_ide1-db-1    postgres:16              Up
python_ide1-redis-1 redis:7                  Up
python_ide1-api-1   python_ide1-api          Up
python_ide1-web-1   python_ide1-web          Up
```

#### Step 5: Initialize Database

```bash
# Wait for database to be ready (wait ~10 seconds)
sleep 10

# The database tables are auto-created on first API request
# Test by accessing the API health endpoint
curl http://localhost:8000/health
```

#### Step 6: Configure Firewall (Linux)

```bash
# Allow access from your LAN (adjust IP range)
sudo ufw allow from 192.168.1.0/24 to any port 3000
sudo ufw allow from 192.168.1.0/24 to any port 8000

# Enable firewall
sudo ufw enable
```

#### Step 7: Access from Your Laptop

Open your browser and navigate to:
```
http://YOUR_SERVER_IP:3000
```

Example: `http://192.168.1.100:3000`

---

## 4. First-Time Usage

### Create Your First Account

1. Open `http://YOUR_SERVER_IP:3000` in your browser
2. Click "Register" or navigate to `/register`
3. Create an account with username, email, and password
4. You'll be automatically logged in with a JWT token

### Test Python Execution

1. After login, you'll see the IDE interface
2. Create a new Python file (e.g., `test.py`)
3. Write some code:
   ```python
   print("Hello from PyIDE!")
   import sys
   print(f"Python version: {sys.version}")
   ```
4. Run the code - a kernel will be started automatically
5. Check the output in the terminal panel

### File Management

Your files are stored on the server at:
```
/pyide-data/{username}/workspace/
```

You can verify:
```bash
# On server
docker exec -it python_ide1-api-1 ls -la /pyide-data/
```

---

## 5. Maintenance

### Stop Services

```bash
docker compose -f docker-compose.lan.yml down
```

### Update PyIDE

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose -f docker-compose.lan.yml up -d --build
```

### View Logs

```bash
# All services
docker compose -f docker-compose.lan.yml logs -f

# Specific service
docker compose -f docker-compose.lan.yml logs -f api
docker compose -f docker-compose.lan.yml logs -f web
```

### Backup Data

```bash
# Backup PostgreSQL database
docker exec python_ide1-db-1 pg_dump -U pyide_user pyide > backup_$(date +%Y%m%d).sql

# Backup user data
docker run --rm -v python_ide1_pyide_data:/data -v $(pwd):/backup alpine tar czf /backup/pyide_data_$(date +%Y%m%d).tar.gz /pyide-data
```

### Restart Services

```bash
# Restart all
docker compose -f docker-compose.lan.yml restart

# Restart specific service
docker compose -f docker-compose.lan.yml restart api
```

---

## 6. Troubleshooting

### Can't Access from Laptop

**Problem**: Browser shows "Connection refused" or timeout

**Solutions**:
1. Check server is running:
   ```bash
   docker compose -f docker-compose.lan.yml ps
   ```

2. Check ports are listening:
   ```bash
   sudo netstat -tlnp | grep -E '3000|8000'
   ```

3. Check firewall:
   ```bash
   sudo ufw status
   ```

4. Test from server itself:
   ```bash
   curl http://localhost:3000
   ```

5. Test from laptop:
   ```bash
   telnet YOUR_SERVER_IP 3000
   ```

### Database Connection Errors

**Problem**: API logs show "could not connect to database"

**Solutions**:
1. Wait for PostgreSQL to start (takes ~5-10 seconds)
2. Check database credentials in `.env`
3. Restart services:
   ```bash
   docker compose -f docker-compose.lan.yml down
   docker compose -f docker-compose.lan.yml up -d
   ```

### Kernel Won't Start

**Problem**: Code execution hangs or fails

**Solutions**:
1. Check API logs:
   ```bash
   docker compose -f docker-compose.lan.yml logs api
   ```

2. Verify Python is available in API container:
   ```bash
   docker exec -it python_ide1-api-1 python --version
   ```

3. Check workspace permissions:
   ```bash
   docker exec -it python_ide1-api-1 ls -la /pyide-data/
   ```

### WebSocket Connection Fails

**Problem**: Terminal shows "WebSocket connection failed"

**Solutions**:
1. Check nginx config includes `/ws/` proxy
2. Verify nginx logs:
   ```bash
   docker compose -f docker-compose.lan.yml logs web
   ```

3. Test WebSocket manually:
   ```bash
   # Install wscat
   npm install -g wscat
   
   # Test connection
   wscat -c ws://YOUR_SERVER_IP:8000/ws/kernel/test
   ```

---

## 7. Advanced Configuration

### Enable HTTPS (Recommended for Production)

```bash
# Create certificates directory
mkdir -p certs

# Generate self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Org/CN=your-server-ip"

# Use the main docker-compose.yml with HTTPS profile
docker compose --profile https up -d
```

Access via: `https://YOUR_SERVER_IP:443`

### Increase Resource Limits

Edit `docker-compose.lan.yml`:

```yaml
api:
  deploy:
    resources:
      limits:
        cpus: '4'
        memory: 8G
      reservations:
        cpus: '1'
        memory: 2G
```

### Configure AI Provider

Edit `.env`:

```bash
DEFAULT_AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
DEFAULT_MODEL=gpt-4o
```

---

## 8. Access URLs

Once deployed, these URLs are available from your laptop:

| Service | URL | Description |
|---------|-----|-------------|
| Web IDE | `http://SERVER_IP:3000` | Main IDE interface |
| API | `http://SERVER_IP:8000` | REST API |
| API Docs | `http://SERVER_IP:8000/docs` | Swagger UI |
| Health | `http://SERVER_IP:8000/health` | Health check |

Replace `SERVER_IP` with your server's actual IP address.

---

## 9. Next Steps

- [ ] **Enable HTTPS**: Secure your connection
- [ ] **Set up backups**: Automated database and data backups
- [ ] **Configure monitoring**: Use tools like Portainer, Grafana
- [ ] **Add more users**: Each user gets isolated workspace
- [ ] **Configure AI**: Set up OpenAI/other AI providers
- [ ] **Install MCP servers**: Extend capabilities with Model Context Protocol
- [ ] **Set up CI/CD**: Automated deployment on code updates

---

## Support

For issues or questions:
1. Check logs: `docker compose -f docker-compose.lan.yml logs -f`
2. Review documentation in `docs/` folder
3. Check troubleshooting section above

---

**Version**: 1.0  
**Last Updated**: 2026-04-13  
**Deployment Type**: LAN (Local Area Network)
