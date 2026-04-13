# PyIDE Local Testing Checklist

## Pre-requisites
- [ ] Docker Desktop installed
- [ ] Docker Desktop running (whale icon in system tray)
- [ ] PowerShell terminal open
- [ ] Current directory: `C:\Users\lenovo\Desktop\python_ide1`

## Step 1: Verify Docker Installation

```powershell
# Run these commands
docker --version
docker compose version
docker run hello-world
```

**Expected**: All commands succeed with version numbers and "Hello from Docker!" message

---

## Step 2: Build and Start PyIDE

```powershell
# Navigate to project directory
cd C:\Users\lenovo\Desktop\python_ide1

# Build and start all services
docker compose -f docker-compose.lan.yml up -d --build
```

**Expected Output**:
```
[+] Building x.xs (xx/x)
[+] Running 4/4
  ✔ Network python_ide1_pyide-network  Created
  ✔ Container python_ide1-db-1         Started
  ✔ Container python_ide1-redis-1      Started
  ✔ Container python_ide1-api-1        Started
  ✔ Container python_ide1-web-1        Started
```

**Wait Time**: First build takes 3-5 minutes (downloading images, building)

---

## Step 3: Verify Services Are Running

```powershell
# Check container status
docker compose -f docker-compose.lan.yml ps
```

**Expected**: All 4 containers show "Up" status

```
NAME                    IMAGE                STATUS          PORTS
python_ide1-db-1        postgres:16          Up (healthy)    5432/tcp
python_ide1-redis-1     redis:7              Up              6379/tcp
python_ide1-api-1       python_ide1-api      Up              0.0.0.0:8000->8000/tcp
python_ide1-web-1       python_ide1-web      Up              0.0.0.0:3000->3000/tcp
```

---

## Step 4: Test API Health Check

```powershell
# Wait 10 seconds for database to initialize
Start-Sleep -Seconds 10

# Test API health
curl http://localhost:8000/health
```

**Expected**: JSON response like `{"status": "ok"}`

---

## Step 5: Test Web UI

Open browser and navigate to:
```
http://localhost:3000
```

**Expected**: PyIDE login/registration page loads

---

## Step 6: Register a Test Account

1. Click "Register" or go to `http://localhost:3000/register`
2. Fill in:
   - Username: `testuser`
   - Email: `test@example.com`
   - Password: `Test123456!`
3. Click "Register"

**Expected**: 
- Registration succeeds
- You're automatically logged in
- Redirected to IDE interface

---

## Step 7: Test Python Code Execution

1. In the IDE, create a new file: `test.py`
2. Write test code:
   ```python
   print("Hello from PyIDE!")
   import sys
   print(f"Python version: {sys.version}")
   print(f"Current directory: {__file__}")
   ```
3. Run the code (click Run button or use shortcut)

**Expected**:
- Kernel starts automatically (may take 2-3 seconds first time)
- Output shows in terminal panel
- No error messages

---

## Step 8: Test File Management

1. Create another file: `math_test.py`
2. Write:
   ```python
   import math
   print(f"Pi = {math.pi}")
   print(f"Square root of 16 = {math.sqrt(16)}")
   ```
3. Run it

**Expected**: Code executes successfully with correct output

---

## Step 9: Test Package Installation

Create `install_test.py`:
```python
# Try importing a standard library
import json
import datetime

data = {"test": "success", "timestamp": str(datetime.datetime.now())}
print(json.dumps(data, indent=2))
```

**Expected**: Runs successfully

---

## Step 10: View Logs (For Debugging)

```powershell
# View all logs
docker compose -f docker-compose.lan.yml logs -f

# View specific service logs
docker compose -f docker-compose.lan.yml logs -f api
docker compose -f docker-compose.lan.yml logs -f web
```

---

## Step 11: Test API Documentation

Open browser:
```
http://localhost:8000/docs
```

**Expected**: Swagger UI loads with all API endpoints listed

---

## Step 12: Multi-User Test (Optional)

1. Open incognito/private browser window
2. Go to `http://localhost:3000`
3. Register a different account: `user2`
4. Create files and verify they're separate from `testuser`

**Expected**: Each user has isolated workspace

---

## Troubleshooting

### Issue: Containers won't start

```powershell
# Check Docker is running
docker info

# Check for port conflicts
netstat -ano | findstr ":3000"
netstat -ano | findstr ":8000"

# If ports are in use, stop those services or change ports in docker-compose.lan.yml
```

### Issue: Database connection errors

```powershell
# Restart services
docker compose -f docker-compose.lan.yml down
docker compose -f docker-compose.lan.yml up -d

# Wait longer for PostgreSQL
Start-Sleep -Seconds 15
```

### Issue: Web UI not loading

```powershell
# Check web container logs
docker compose -f docker-compose.lan.yml logs web

# Rebuild web container
docker compose -f docker-compose.lan.yml up -d --build web
```

### Issue: WebSocket connection fails

```powershell
# Check API logs
docker compose -f docker-compose.lan.yml logs api

# Verify nginx config
docker exec python_ide1-web-1 cat /etc/nginx/conf.d/default.conf
```

---

## Cleanup (When Done Testing)

```powershell
# Stop all services
docker compose -f docker-compose.lan.yml down

# Stop and remove volumes (deletes all data)
docker compose -f docker-compose.lan.yml down -v

# View disk usage
docker system df

# Clean up unused images
docker system prune
```

---

## Success Criteria ✅

All tests pass if:
- [x] All 4 containers running
- [x] API health check returns OK
- [x] Web UI loads at http://localhost:3000
- [x] Can register account
- [x] Can create and run Python files
- [x] Code execution produces correct output
- [x] Multiple users have isolated workspaces
- [x] API docs accessible at http://localhost:8000/docs

---

## Next Steps After Successful Test

1. ✅ **Test passed**: Ready for server deployment!
2. Review `docs/LAN_DEPLOYMENT_GUIDE.md` for server deployment
3. Use `deploy-to-server.ps1` to transfer to server
4. Deploy on server using `deploy-lan.sh`

---

**Estimated Test Time**: 15-20 minutes (including Docker build)
