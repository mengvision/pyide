# Remote Kernel Configuration Guide

## Problem Solved

The IDE was continuously trying to connect to `ws://127.0.0.1:8765` (localhost) even though you configured the server URL to `http://172.17.10.162:8001`. This happened because:

1. **Default Mode**: The IDE defaults to `local` kernel mode, which always connects to localhost
2. **Hidden Settings**: The server URL was only used in `remote` mode, but there was no easy way to switch modes or edit the URL
3. **Multiple Endpoints**: Remote kernel requires coordinated configuration of HTTP API and WebSocket endpoints

## Solution Implemented

### 1. Unified Configuration Panel

The **Settings → Session** panel now provides:

- **Server URL Editing**: Click the ✏️ icon to edit the server URL
- **Kernel Mode Switching**: One-click button to switch from Local to Remote mode
- **Connection Status**: Real-time status display
- **Session Management**: Authentication status and logout

### 2. How It Works

#### Local Mode (Default)
```
WebSocket: ws://127.0.0.1:8765
HTTP API:  N/A (direct process communication)
Use Case:  Development on local machine
```

#### Remote Mode
```
HTTP API:  http://172.17.10.162:8001 (configurable)
WebSocket: ws://172.17.10.162:8001/kernel/ws (auto-derived)
Use Case:  Production server, shared resources
```

### 3. Configuration Steps

#### Step 1: Open Settings
- Press `Ctrl+,` or click the gear icon

#### Step 2: Navigate to Session
- Click "Session" in the left sidebar

#### Step 3: Configure Server URL
1. Click the ✏️ (edit) icon next to Server URL
2. Enter your server URL: `http://172.17.10.162:8001`
3. Click "Save"
4. The URL is persisted in `~/.pyide/settings.json`

#### Step 4: Switch to Remote Mode
1. Click the "Switch to Remote" button
2. The IDE will switch kernel modes
3. If you have running code, a migration dialog will appear

#### Step 5: Start the Kernel
- The kernel will automatically connect to your remote server
- WebSocket URL is automatically derived: `ws://172.17.10.162:8001/kernel/ws`
- Authentication token is appended for security

## Architecture

### Connection Flow (Remote Mode)

```
1. User starts kernel in IDE
   ↓
2. IDE authenticates with server (JWT token)
   ↓
3. IDE requests kernel start: POST http://172.17.10.162:8001/api/kernel/start
   ↓
4. Server starts kernel, returns kernel_id
   ↓
5. IDE gets WebSocket token: POST /api/kernel/{id}/ws-token
   ↓
6. IDE connects WebSocket: ws://172.17.10.162:8001/kernel/ws?token={jwt}
   ↓
7. Bidirectional JSON-RPC communication established
```

### Settings Storage

Settings are stored in: `~/.pyide/settings.json`

```json
{
  "serverUrl": "http://172.17.10.162:8001",
  "theme": "dark",
  "vimMode": false,
  "fontSize": 14,
  "aiConfig": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "",
    "modelId": "gpt-4o"
  }
}
```

## Server-Side Requirements

Your Ubuntu server needs to expose these endpoints:

### HTTP API
- `POST /api/v1/auth/login` - Authentication
- `POST /api/kernel/start` - Start kernel
- `POST /api/kernel/{id}/ws-token` - Get WebSocket token
- `GET /api/environment/templates` - List environment templates

### WebSocket
- `GET /kernel/ws?token={jwt}` - Kernel WebSocket connection

### Ports
All services should be accessible through a single port (8001 in your case):
- HTTP API: `http://172.17.10.162:8001`
- WebSocket: `ws://172.17.10.162:8001/kernel/ws`

The nginx proxy on your server should route:
- `/api/*` → FastAPI backend
- `/kernel/ws` → WebSocket proxy to kernel service

## Troubleshooting

### IDE Still Connecting to Localhost

**Problem**: IDE shows "connecting to ws://127.0.0.1:8765"

**Solution**:
1. Check kernel mode in status bar (bottom of IDE)
2. If it says "local kernel", click it to switch to remote
3. Or go to Settings → Session → Click "Switch to Remote"

### Cannot Edit Server URL

**Problem**: Settings UI doesn't allow editing

**Solution**: 
- The new UI now supports editing directly in the Session panel
- Alternatively, manually edit `~/.pyide/settings.json`:
  ```json
  {
    "serverUrl": "http://172.17.10.162:8001"
  }
  ```

### WebSocket Connection Fails

**Problem**: "Remote kernel WebSocket connection failed"

**Checklist**:
1. ✅ Server URL is correct in Settings → Session
2. ✅ You are authenticated (check Session panel)
3. ✅ Server is running and accessible: `curl http://172.17.10.162:8001/api/health`
4. ✅ Firewall allows port 8001
5. ✅ Nginx is proxying WebSocket connections correctly

### Nginx WebSocket Configuration

Ensure your nginx config includes:

```nginx
location /kernel/ws {
    proxy_pass http://backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Quick Reference

### Switch to Remote Mode
```
Status Bar → Click "Mode: local" → Switch to Remote
```

### Change Server URL
```
Settings (Ctrl+,) → Session → Edit URL → Save
```

### Login to Remote Server
```
1. Switch to remote mode
2. Login screen appears automatically
3. Enter username + password
4. Click "Sign In"
```

**⚠️ Important:** Credentials are NOT stored in config files. They are entered once via the login dialog, and a secure token is saved automatically.

For detailed authentication guide, see: [AUTHENTICATION_CONFIGURATION.md](./AUTHENTICATION_CONFIGURATION.md)

### Check Connection
```
Settings → Session → Check Status indicator
```

### Reset to Local
```
Status Bar → Click "Mode: remote" → Switch to Local
```

## Next Steps

1. **Verify Server Setup**: Ensure your Ubuntu server has all endpoints running
2. **Test Connection**: Switch to remote mode and start kernel
3. **Configure Environment**: Select Python environment template if needed
4. **Set Up Auto-Start**: Consider making remote mode the default for your workflow

## Support

If you encounter issues:
1. Check the IDE console (F12 → Console)
2. Check server logs on Ubuntu
3. Verify network connectivity: `ping 172.17.10.162`
4. Test API endpoint: `curl http://172.17.10.162:8001/api/health`
