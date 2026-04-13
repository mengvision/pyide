# 🚀 PyIDE Quick Start Guide

## Current Status
⏳ **Waiting for**: Docker Desktop installation

---

## What You Need to Do (In Order)

### Step 1: Install Docker Desktop (~10 minutes)

1. **Download**: https://www.docker.com/products/docker-desktop/
2. **Install**: Run installer, restart computer
3. **Launch**: Open Docker Desktop, wait for whale icon to stop animating
4. **Verify**: Open PowerShell and run:
   ```powershell
   docker --version
   ```

📖 Detailed guide: [`DOCKER_INSTALL_GUIDE.md`](DOCKER_INSTALL_GUIDE.md)

---

### Step 2: Run Automated Test (~5 minutes)

Once Docker is installed and running:

```powershell
cd C:\Users\lenovo\Desktop\python_ide1
.\test-local.ps1
```

This script will automatically:
- ✅ Build all Docker containers
- ✅ Start all services (Database, API, Web UI)
- ✅ Test API health
- ✅ Test Web UI accessibility
- ✅ Test user registration
- ✅ Open browser for you

---

### Step 3: Manual Testing (~5 minutes)

After the script completes:

1. **Browser opens** at `http://localhost:3000`
2. **Register** a new account
3. **Create** a Python file
4. **Run** code and see output
5. **Verify** everything works!

📋 Detailed checklist: [`LOCAL_TEST_CHECKLIST.md`](LOCAL_TEST_CHECKLIST.md)

---

### Step 4: Deploy to Server (Later)

Once local testing is successful:

```powershell
# Transfer to your server
.\deploy-to-server.ps1 -ServerIP "192.168.1.100" -Username "your-username"

# Then SSH to server and run:
./deploy-lan.sh
```

📖 Server guide: [`docs/LAN_DEPLOYMENT_GUIDE.md`](docs/LAN_DEPLOYMENT_GUIDE.md)

---

## Files Created for You

| File | Purpose |
|------|---------|
| `test-local.ps1` | **← START HERE** - Automated test script |
| `LOCAL_TEST_CHECKLIST.md` | Manual testing steps |
| `DOCKER_INSTALL_GUIDE.md` | Docker installation guide |
| `deploy-to-server.ps1` | Transfer to server script |
| `docker-compose.lan.yml` | Docker configuration for LAN |
| `.env` | Environment configuration |
| `docs/LAN_DEPLOYMENT_GUIDE.md` | Complete server deployment guide |

---

## Quick Reference Commands

### Start PyIDE
```powershell
docker compose -f docker-compose.lan.yml up -d --build
```

### Stop PyIDE
```powershell
docker compose -f docker-compose.lan.yml down
```

### View Logs
```powershell
docker compose -f docker-compose.lan.yml logs -f
```

### Check Status
```powershell
docker compose -f docker-compose.lan.yml ps
```

---

## Access URLs (When Running)

- **Web IDE**: http://localhost:3000
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## Architecture (What's Running)

```
Your Browser (localhost:3000)
    ↓
Nginx Web Server
    ↓ (proxies /api and /ws)
FastAPI Backend (localhost:8000)
    ↓
PostgreSQL + Redis + Python Kernels
```

All running in Docker containers on your machine!

---

## Troubleshooting

### Docker not found?
→ Install Docker Desktop first (Step 1)

### Port already in use?
→ Stop other services using port 3000 or 8000

### Build fails?
→ Check Docker Desktop is running (whale icon in tray)

### Can't access localhost:3000?
→ Wait 15 seconds after starting, then refresh

### Need help?
→ View logs: `docker compose -f docker-compose.lan.yml logs -f`

---

## Estimated Total Time

- Docker installation: **10-15 minutes**
- First build & start: **3-5 minutes**
- Testing: **5-10 minutes**
- **Total: ~20-30 minutes**

---

## Next Action

👉 **Install Docker Desktop now**, then run:
```powershell
.\test-local.ps1
```

That's it! The script does everything else automatically. 🎉
