# Install Docker Desktop on Windows

## Download & Install

1. **Download Docker Desktop**:
   - Visit: https://www.docker.com/products/docker-desktop/
   - Click "Download for Windows"
   - Or use direct link: https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe

2. **Install**:
   - Run the installer
   - During installation, ensure "Use WSL 2 instead of Hyper-V" is checked (recommended)
   - Click "OK" to complete installation
   - Restart your computer when prompted

3. **First Launch**:
   - Open Docker Desktop from Start Menu
   - Accept the terms of service
   - Wait for Docker to start (whale icon in system tray will stop animating)
   - You may need to log in with Docker Hub account (free) or skip

## Verify Installation

Open PowerShell and run:

```powershell
# Check Docker version
docker --version

# Check Docker Compose version
docker compose version

# Test with a simple container
docker run hello-world
```

Expected output:
```
Docker version 24.x.x, build xxxxxxx
Docker Compose version v2.x.x

Hello from Docker!
This message shows that your installation appears to be working correctly.
```

## Configure Docker (Optional but Recommended)

1. **Increase Resource Limits** (Docker Desktop Settings):
   - Right-click whale icon → Settings
   - Resources → Advanced
   - Recommended settings:
     - CPUs: 4
     - Memory: 8 GB
     - Swap: 2 GB
     - Disk image size: 50 GB

2. **Enable WSL 2 Backend** (if not already):
   - Settings → General
   - Check "Use the WSL 2 based engine"
   - Apply & restart

## Next Steps

After Docker is installed and running, come back and I'll help you:
1. Build and start PyIDE locally
2. Test all features
3. Verify everything works before server deployment

---

**Installation Time**: ~10-15 minutes (including download)
**Download Size**: ~600 MB
