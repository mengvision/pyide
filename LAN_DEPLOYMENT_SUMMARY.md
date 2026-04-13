# PyIDE LAN Deployment - Quick Summary

## 📦 What Has Been Prepared

I've created everything you need to deploy PyIDE to your local network server and access it from your laptop.

### Files Created

1. **Configuration Files**:
   - `.env.lan.example` - Environment template for LAN deployment
   - `.env` - Active configuration (copied from template)
   - `docker-compose.lan.yml` - Docker Compose config for LAN
   - `apps/web/nginx.lan.conf` - Nginx config optimized for LAN access

2. **Deployment Scripts**:
   - `deploy-lan.sh` - Linux server deployment script (run on server)
   - `deploy-to-server.ps1` - Windows transfer script (run on your laptop)

3. **Documentation**:
   - `docs/LAN_DEPLOYMENT_GUIDE.md` - Complete deployment guide with architecture, risks, and troubleshooting

---

## 🚀 Quick Start (3 Steps)

### Step 1: Transfer to Server

**On your Windows laptop**, run:

```powershell
cd C:\Users\lenovo\Desktop\python_ide1
.\deploy-to-server.ps1 -ServerIP "192.168.1.100" -Username "your-server-username"
```

Replace with your actual server IP and username.

**Alternative (Manual)**:
```powershell
# Using SCP
scp -r C:\Users\lenovo\Desktop\python_ide1 user@192.168.1.100:~/pyide
```

### Step 2: Deploy on Server

**SSH into your server**:
```bash
ssh user@192.168.1.100
cd ~/pyide
chmod +x deploy-lan.sh
./deploy-lan.sh
```

The script will:
- ✓ Check Docker installation
- ✓ Generate secure passwords
- ✓ Build and start all services
- ✓ Show you the access URLs

### Step 3: Access from Laptop

Open your browser and go to:
```
http://YOUR_SERVER_IP:3000
```

Example: `http://192.168.1.100:3000`

Register an account and start coding!

---

## 🏗️ Architecture Overview

```
Your Laptop (Browser)
    ↓ HTTP/WS
Server Port 3000 (Web UI - Nginx)
    ↓ Proxy
Server Port 8000 (API - FastAPI)
    ↓
PostgreSQL + Redis + Python Kernels
```

**What runs on the server**:
- Web interface (React + Nginx)
- Backend API (FastAPI)
- Database (PostgreSQL)
- Cache (Redis)
- Python execution engines (one per user)

**What runs on your laptop**:
- Just a web browser!

---

## ⚠️ Important Risks & Considerations

### Critical Security Notes

1. **NO ENCRYPTION**: Traffic is unencrypted (HTTP, not HTTPS)
   - ✅ OK for trusted home/office LAN
   - ❌ NOT OK for public networks
   - **Fix**: Enable HTTPS (see `docs/LAN_DEPLOYMENT_GUIDE.md` Section 7)

2. **CHANGE DEFAULT PASSWORDS**: 
   - The `.env` file has a generated secret key
   - Verify it's strong before deploying

3. **FIREWALL**: 
   - Ports 3000 and 8000 will be open on your server
   - Restrict to your IP range if possible

4. **FILE ACCESS**:
   - Python code runs on the server
   - Users can read/write files the server has access to
   - Don't deploy on a server with sensitive data

5. **RESOURCE LIMITS**:
   - No CPU/RAM limits by default
   - One user could potentially use all resources
   - **Fix**: Configure Docker resource limits

### When This Setup is Appropriate

✅ **Good for**:
- Home network development
- Small team (5-10 people) on trusted LAN
- Testing and prototyping
- Learning environment

❌ **Not appropriate for**:
- Public internet exposure
- Production with sensitive data
- Untrusted networks
- Large teams (>20 users)

---

## 📊 What You'll Get

### Features Available

- ✅ **Multi-user support**: Each user gets isolated workspace
- ✅ **Python execution**: Full Python 3.12 environment
- ✅ **File management**: Create, edit, organize files
- ✅ **WebSocket terminals**: Real-time code execution
- ✅ **JWT authentication**: Secure login system
- ✅ **Package installation**: pip install works
- ✅ **MCP integration**: Model Context Protocol support
- ✅ **Skills system**: Extensible capabilities

### Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Web IDE | `http://SERVER_IP:3000` | Main interface |
| API | `http://SERVER_IP:8000` | REST API |
| API Docs | `http://SERVER_IP:8000/docs` | Swagger UI |
| Health | `http://SERVER_IP:8000/health` | Status check |

---

## 🔧 Common Commands

### On Server

```bash
# View logs
docker compose -f docker-compose.lan.yml logs -f

# Stop services
docker compose -f docker-compose.lan.yml down

# Restart services
docker compose -f docker-compose.lan.yml restart

# Update PyIDE
git pull
docker compose -f docker-compose.lan.yml up -d --build

# Backup database
docker exec python_ide1-db-1 pg_dump -U pyide_user pyide > backup.sql
```

### Check Status

```bash
# See running containers
docker compose -f docker-compose.lan.yml ps

# Check resource usage
docker stats
```

---

## 📖 Full Documentation

For complete details, see:
- **`docs/LAN_DEPLOYMENT_GUIDE.md`** - Architecture, risks, deployment steps, troubleshooting

Key sections:
- Section 1: Architecture & Implementation Principles
- Section 2: Security Risks & Mitigations (⚠️ READ THIS)
- Section 3: Step-by-Step Deployment
- Section 4: First-Time Usage
- Section 5: Maintenance
- Section 6: Troubleshooting

---

## 🆘 Troubleshooting Quick Fixes

### Can't access from laptop?

```bash
# On server, check if services are running
docker compose -f docker-compose.lan.yml ps

# Check if ports are listening
sudo netstat -tlnp | grep -E '3000|8000'

# Check firewall
sudo ufw status
```

### Database errors?

```bash
# Wait 10 seconds for PostgreSQL to start
sleep 10

# Restart services
docker compose -f docker-compose.lan.yml restart
```

### Need help?

```bash
# View detailed logs
docker compose -f docker-compose.lan.yml logs -f api
docker compose -f docker-compose.lan.yml logs -f web
```

---

## ✅ Pre-Deployment Checklist

Before deploying, ensure:

- [ ] Server has Docker installed
- [ ] Server has static IP (e.g., 192.168.1.100)
- [ ] Ports 3000 and 8000 are available
- [ ] You have SSH access to server
- [ ] `.env` file has strong passwords (auto-generated by script)
- [ ] Server is on the same LAN as your laptop
- [ ] You understand the security risks (no HTTPS)

---

## 🎯 Next Steps After Deployment

1. **Test basic functionality**:
   - Register account
   - Create Python file
   - Run code
   - Check output

2. **Secure your deployment**:
   - Enable HTTPS (guide in `LAN_DEPLOYMENT_GUIDE.md`)
   - Configure firewall rules
   - Set up automated backups

3. **Customize**:
   - Configure AI providers (OpenAI, etc.)
   - Install MCP servers
   - Add more users

---

## 📞 Support

If you encounter issues:

1. Check `docs/LAN_DEPLOYMENT_GUIDE.md` Section 6 (Troubleshooting)
2. View logs: `docker compose -f docker-compose.lan.yml logs -f`
3. Common issues are documented with solutions

---

**Ready to deploy?** Start with Step 1 above! 🚀

**Estimated deployment time**: 5-15 minutes (depending on network speed)
