# 🚀 Quick Start: Create Test Account

## ⚡ Fastest Way (30 seconds)

### Option 1: From IDE (Easiest)

1. Open PyIDE on Windows
2. Settings → Session → "Switch to Remote"
3. Login screen appears
4. Click **"Register"**
5. Fill in:
   - Username: `testuser`
   - Email: `test@example.com`
   - Password: `test123456`
6. Click "Register" → ✅ Done!

### Option 2: From Command Line

```powershell
# Windows PowerShell - Run this one command:
Invoke-RestMethod -Uri "http://172.17.10.162:8001/api/v1/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"testuser","email":"test@example.com","password":"test123456"}'
```

Then login with:
- **Username:** `testuser`
- **Password:** `test123456`

---

## 📝 Ready-to-Use Test Accounts

Pick any of these (create via Option 1 or 2 above):

| Username | Password | Email | Use Case |
|----------|----------|-------|----------|
| `testuser` | `test123456` | `test@example.com` | General testing |
| `demo` | `demo123` | `demo@test.com` | Quick demo |
| `developer` | `dev123456` | `dev@test.com` | Development |

---

## ✅ Verify It Works

```powershell
# Test login:
Invoke-RestMethod -Uri "http://172.17.10.162:8001/api/v1/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"testuser","password":"test123456"}'

# Should return a token if successful
```

---

## 🎯 That's It!

No server configuration needed. No admin setup. Just register and go! 🎉
