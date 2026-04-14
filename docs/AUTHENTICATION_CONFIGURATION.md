# Authentication & Credentials Configuration Guide

## 🔐 How Authentication Works

### Important: Credentials Are NOT Stored in Config Files

The IDE **does not store your username and password** in any configuration file. Instead, it uses a secure authentication flow:

```
1. User enters credentials in Login dialog (one time)
   ↓
2. IDE sends credentials to server
   POST http://172.17.10.162:8001/api/v1/auth/login
   Body: { "username": "your_user", "password": "your_password" }
   ↓
3. Server validates and returns JWT token
   Response: { "access_token": "eyJhbGciOiJIUzI1NiIs..." }
   ↓
4. IDE stores token securely (via Tauri secure storage)
   ↓
5. Token is used for all future requests automatically
```

## 📍 Where to Enter Credentials

### Method 1: Automatic Login Screen (Recommended)

When you switch to **remote kernel mode**, the IDE automatically shows a full-screen login dialog:

**Steps:**
1. Open Settings → Session
2. Click "Switch to Remote"
3. **Login screen appears automatically**
4. Enter your credentials:
   - **Username**: Your server account username
   - **Password**: Your server account password
   - **Server URL**: Pre-filled with your configured URL (http://172.17.10.162:8001)
5. Click "Sign In"

**Login Screen Layout:**
```
┌──────────────────────────────────────────┐
│                                          │
│        Login to PyIDE                    │
│                                          │
│   Username:  [___________________]       │
│                                          │
│   Password:  [___________________]       │
│                                          │
│   Server URL:                            │
│   [http://172.17.10.162:8001       ]     │
│                                          │
│   [        Sign In        ]              │
│                                          │
│   Don't have an account? Register        │
│                                          │
└──────────────────────────────────────────┘
```

### Method 2: Re-login After Logout

If you logout and need to login again:
1. Settings → Session → Click "Logout"
2. IDE will show the login screen again
3. Enter your credentials

## 🗂️ What Is Stored Where

| Information | Storage Location | Encrypted? |
|------------|------------------|------------|
| **Username** | NOT stored | N/A |
| **Password** | NOT stored | N/A |
| **JWT Token** | Tauri secure storage | ✅ Yes |
| **Server URL** | `~/.pyide/settings.json` | ❌ No |

### Token Storage Details

**Desktop App (Tauri):**
- Location: Tauri's secure storage (OS-level encryption)
- Windows: Windows Credential Manager / DPAPI
- macOS: Keychain
- Linux: libsecret / Keyring

**Settings File:**
```
Location: C:\Users\YourName\.pyide\settings.json

Content:
{
  "serverUrl": "http://172.17.10.162:8001",
  "theme": "dark",
  "vimMode": false,
  ...
}
```

**Note:** Only the server URL is stored in plain text. Your credentials are never saved.

## 🔄 Authentication Lifecycle

### Initial Setup
```
1. Configure server URL (Settings → Session)
   ↓
2. Switch to remote mode
   ↓
3. Login dialog appears automatically
   ↓
4. Enter username + password
   ↓
5. Token saved, IDE connects to remote kernel
```

### Daily Use
```
1. Open IDE
   ↓
2. Token is loaded automatically from secure storage
   ↓
3. If token is valid → Connected immediately
   ↓
4. If token expired → Login dialog appears
```

### Token Refresh
```
The IDE automatically refreshes tokens before they expire.
You typically won't need to login again unless:
- Token expires (default: 24 hours)
- You manually logout
- Server invalidates the token
```

## 🛠️ Troubleshooting

### Problem: Login Screen Doesn't Appear

**Symptoms:** Switched to remote mode but no login dialog

**Solutions:**
1. Check status bar - should show "Mode: remote"
2. Go to Settings → Session
3. Click "Reset Connection"
4. Stop the kernel and start it again
5. Login screen should appear

### Problem: Authentication Failed

**Error Message:** "Authentication failed" or "Invalid credentials"

**Checklist:**
- ✅ Username is correct (case-sensitive)
- ✅ Password is correct (check caps lock)
- ✅ Server URL is correct: `http://172.17.10.162:8001`
- ✅ Server is running: `curl http://172.17.10.162:8001/api/health`
- ✅ Network connectivity: `ping 172.17.10.162`

### Problem: Token Expired

**Symptoms:** Suddenly disconnected, asked to login again

**Solution:**
1. Simply login again with your credentials
2. New token will be saved automatically
3. Consider asking server admin to increase token expiry time

### Problem: Want to Change Account

**Solution:**
1. Settings → Session → Click "Logout"
2. Login screen appears
3. Enter different username/password
4. New account will be used

## 📋 Server Account Management

### Creating a New Account

If you don't have an account yet:

**Option 1: Through IDE**
1. On login screen, click "Register"
2. Fill in:
   - Username
   - Email
   - Password
3. Click "Register"
4. Account created, automatically logged in

**Option 2: Through API**
```bash
curl -X POST http://172.17.10.162:8001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "email": "your@email.com",
    "password": "your_password"
  }'
```

**Option 3: Server Admin**
Contact your server administrator to create an account.

### Password Reset

If you forgot your password:

**Option 1: Re-register** (if allowed by server)
1. Click "Register" on login screen
2. Use same username with new password

**Option 2: Contact Admin**
Ask your server administrator to reset your password.

## 🔒 Security Best Practices

### What's Secure ✅
- Passwords are never stored locally
- Tokens are encrypted in OS secure storage
- All communication uses HTTP/HTTPS
- JWT tokens have expiration times

### What to Watch Out For ⚠️
- **Server URL uses HTTP** (not HTTPS) - credentials sent in plain text
  - **Recommendation**: Configure HTTPS on your server
  - **Risk**: Network eavesdropping could capture credentials
- **Settings file is plain text** - server URL visible
  - **Risk**: Low - only contains server address, no credentials

### Recommendations
1. **Use HTTPS** for production servers
2. **Strong passwords** - at least 12 characters
3. **Regular token rotation** - logout/login periodically
4. **Network security** - use VPN or secure network
5. **Server hardening** - enable rate limiting, fail2ban, etc.

## 🧪 Testing Authentication

### Test Server Connectivity
```bash
# Check if server is running
curl http://172.17.10.162:8001/api/health

# Expected response:
{"status": "ok"}
```

### Test Login Endpoint
```bash
curl -X POST http://172.17.10.162:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'

# Expected response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

### Test Token Validity
```bash
curl http://172.17.10.162:8001/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Expected response:
{
  "username": "your_username",
  "email": "your@email.com"
}
```

## 📊 Quick Reference

| Action | Where to Go | What to Do |
|--------|------------|------------|
| **First time login** | Switch to remote mode | Enter credentials on auto-shown login screen |
| **Change server URL** | Settings → Session | Edit URL, then logout/login |
| **Logout** | Settings → Session | Click "Logout" button |
| **Re-login** | After logout | Login screen appears automatically |
| **Check login status** | Settings → Session | See "Authenticated" status |
| **Reset connection** | Settings → Session | Click "Reset Connection" |
| **Create account** | Login screen | Click "Register" link |

## 🎯 Summary

**Key Points:**
1. ✅ **No config file for credentials** - they're entered via login dialog
2. ✅ **Login screen appears automatically** when switching to remote mode
3. ✅ **Token stored securely** - encrypted by OS
4. ✅ **Auto token refresh** - rarely need to login again
5. ✅ **Easy to switch accounts** - just logout and login

**Your Workflow:**
```
1. Set server URL: http://172.17.10.162:8001
2. Switch to remote mode
3. Login screen appears → Enter username + password
4. Done! Token saved, auto-authenticated from now on
```
