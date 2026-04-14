# Server Account Management Guide

## 🎯 Quick Answer: How to Create/Test Accounts

### Option 1: Self-Registration (Easiest - Recommended for Testing)

**You don't need to create accounts on the server!** The IDE has a built-in registration feature.

**Steps:**
1. Open your Windows IDE
2. Switch to remote mode
3. On the login screen, click **"Register"**
4. Fill in:
   - Username: `testuser` (or any name you want)
   - Email: `test@example.com` (can be fake for testing)
   - Password: `test123456` (or any password)
5. Click "Register"
6. ✅ Account created automatically, you're logged in!

### Option 2: Use API to Create Account

If you prefer command line:

```bash
# On your Ubuntu server, run:
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "test123456"
  }'

# Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

Then use `testuser` / `test123456` to login from the IDE.

### Option 3: Admin Panel (For Production)

If you already have an admin account, you can create users via admin API.

---

## 📋 Complete Account Management Guide

### 1. Understanding the Authentication System

#### How It Works
```
User Registration/Login
         ↓
   FastAPI Server (packages/server)
         ↓
   PostgreSQL Database (users table)
         ↓
   Password hashed with bcrypt
         ↓
   JWT token generated (valid for 30 minutes)
```

#### User Data Model
```sql
Table: users
├── id (Integer, Primary Key)
├── username (String, Unique)
├── email (String, Unique)
├── hashed_password (String, bcrypt)
├── is_active (Boolean, default: True)
├── is_admin (Boolean, default: False)
├── cpu_limit (Integer, nullable)
├── memory_limit (Integer, nullable)
└── created_at (DateTime)
```

---

### 2. Account Creation Methods

#### Method A: Self-Registration via IDE (Recommended)

**When to use:** Testing, personal use, small teams

**Steps:**
1. Launch PyIDE on Windows
2. Switch to remote mode (Settings → Session → "Switch to Remote")
3. Login screen appears
4. Click "Register" link at the bottom
5. Fill in the form:
   ```
   Username:  your_username
   Email:     your@email.com
   Password:  your_password
   Server URL: http://172.17.10.162:8001
   ```
6. Click "Register"
7. ✅ Account created and logged in automatically

**API Endpoint:**
```
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

#### Method B: Registration via curl

**When to use:** Scripting, automation, testing

```bash
# From your Windows machine (PowerShell):
$serverUrl = "http://172.17.10.162:8001"

Invoke-RestMethod -Uri "$serverUrl/api/v1/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"testuser","email":"test@example.com","password":"test123456"}'

# From Linux/Mac:
curl -X POST http://172.17.10.162:8001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "test123456"
  }'
```

#### Method C: Admin Creates User (Production)

**When to use:** Team management, production environment

**Prerequisites:** You need an admin account first

**Step 1: Login as admin to get token**
```bash
curl -X POST http://172.17.10.162:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin_password"}'

# Save the access_token from response
ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

**Step 2: Create user via admin API**
```bash
curl -X POST http://172.17.10.162:8001/api/v1/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "username": "newuser",
    "email": "newuser@company.com",
    "password": "secure_password",
    "is_admin": false
  }'
```

---

### 3. How to Create the First Admin Account

**Important:** There's no default admin account. You need to create one.

#### Option A: Register First, Then Promote to Admin

**Step 1: Register a normal account**
```bash
curl -X POST http://172.17.10.162:8001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@yourdomain.com",
    "password": "strong_admin_password"
  }'
```

**Step 2: Access PostgreSQL to promote to admin**

```bash
# SSH to your Ubuntu server
ssh user@172.17.10.162

# Enter the database container
docker compose -f docker-compose.lan.yml exec db psql -U pyide_user -d pyide_db

# In PostgreSQL prompt:
psql> UPDATE users SET is_admin = true WHERE username = 'admin';
psql> SELECT id, username, email, is_admin FROM users;
psql> \q
```

#### Option B: Direct Database Insert (Advanced)

```bash
# SSH to server
ssh user@172.17.10.162

# Enter database container
docker compose -f docker-compose.lan.yml exec db psql -U pyide_user -d pyide_db

# Generate password hash (Python bcrypt)
# You can use this one-time Python script:
docker compose -f docker-compose.lan.yml exec api python3 -c "
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
print(pwd_context.hash('your_admin_password'))
"

# Copy the hash output, then insert into database:
psql> INSERT INTO users (username, email, hashed_password, is_admin, is_active)
      VALUES ('admin', 'admin@yourdomain.com', '$2b$12$...', true, true);
psql> \q
```

---

### 4. Testing Your Setup

#### Test 1: Verify Server is Running

```bash
# From Windows PowerShell:
curl http://172.17.10.162:8001/health

# Expected response:
{"status": "ok", "version": "x.x.x"}
```

#### Test 2: Create Test Account

```powershell
# Windows PowerShell:
$response = Invoke-RestMethod -Uri "http://172.17.10.162:8001/api/v1/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"testuser","email":"test@test.com","password":"test123"}'

Write-Host "Token: $($response.access_token)"
```

#### Test 3: Login with Test Account

```powershell
# Windows PowerShell:
$response = Invoke-RestMethod -Uri "http://172.17.10.162:8001/api/v1/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"testuser","password":"test123"}'

Write-Host "Login successful! Token: $($response.access_token)"
```

#### Test 4: Verify Token Works

```powershell
# Windows PowerShell:
$token = $response.access_token

$headers = @{
  "Authorization" = "Bearer $token"
}

Invoke-RestMethod -Uri "http://172.17.10.162:8001/api/v1/auth/me" `
  -Headers $headers

# Expected response:
# id, username, email, is_active, is_admin, etc.
```

---

### 5. Account Management Commands

#### List All Users (Admin Only)

```bash
# Get admin token first
ADMIN_TOKEN=$(curl -s -X POST http://172.17.10.162:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin_password"}' | jq -r '.access_token')

# List users
curl http://172.17.10.162:8001/api/v1/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

#### Reset User Password (Admin Only)

```bash
curl -X POST http://172.17.10.162:8001/api/v1/admin/users/1/reset-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"new_password": "new_secure_password"}'
```

#### Disable User Account (Admin Only)

```bash
curl -X POST http://172.17.10.162:8001/api/v1/admin/users/1/disable \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Direct Database Queries

```bash
# SSH to server
ssh user@172.17.10.162

# Access database
docker compose -f docker-compose.lan.yml exec db psql -U pyide_user -d pyide_db

# View all users
psql> SELECT id, username, email, is_admin, is_active, created_at FROM users;

# View specific user
psql> SELECT * FROM users WHERE username = 'testuser';

# Count users
psql> SELECT COUNT(*) FROM users;

# Delete user (be careful!)
psql> DELETE FROM users WHERE username = 'testuser';

psql> \q
```

---

### 6. Recommended Testing Workflow

#### For Development/Testing

```
1. Deploy server to Ubuntu
   ↓
2. From Windows IDE, switch to remote mode
   ↓
3. Click "Register" on login screen
   ↓
4. Create account: testuser / test123456
   ↓
5. Start using the IDE!
```

**That's it!** No server-side configuration needed for basic testing.

#### For Production/Team Use

```
1. Deploy server to Ubuntu
   ↓
2. Create first admin account (via API or DB)
   ↓
3. Login as admin
   ↓
4. Create team member accounts via admin API
   ↓
5. Distribute credentials to team members
   ↓
6. Team members login from their IDEs
```

---

### 7. Quick Reference: Test Credentials

Here are some example credentials you can use for testing:

| Username | Email | Password | Purpose |
|----------|-------|----------|---------|
| `testuser` | `test@example.com` | `test123456` | General testing |
| `developer1` | `dev1@company.com` | `dev123456` | Developer account |
| `admin` | `admin@company.com` | `Admin@123456` | Admin account |
| `demo` | `demo@test.com` | `demo123` | Demo/presentation |

**To create any of these:**

```bash
curl -X POST http://172.17.10.162:8001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "test123456"
  }'
```

---

### 8. Troubleshooting

#### Problem: "Username or email already registered"

**Solution:** Choose a different username or email, or login with existing credentials.

#### Problem: "Incorrect username or password"

**Solutions:**
1. Check if account exists:
   ```bash
   docker compose -f docker-compose.lan.yml exec db psql -U pyide_user -d pyide_db \
     -c "SELECT username, email FROM users WHERE username='testuser';"
   ```

2. Reset password (if you have admin access):
   ```bash
   curl -X POST http://172.17.10.162:8001/api/v1/admin/users/{user_id}/reset-password \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"new_password": "new_password"}'
   ```

#### Problem: Registration not working

**Check:**
1. Server is running: `curl http://172.17.10.162:8001/health`
2. Database is connected: `docker compose -f docker-compose.lan.yml logs db`
3. API logs for errors: `docker compose -f docker-compose.lan.yml logs api`

#### Problem: Can't login from IDE

**Checklist:**
- ✅ Server URL correct: `http://172.17.10.162:8001`
- ✅ Account exists and is active
- ✅ Username/password correct (case-sensitive)
- ✅ Network connectivity: `ping 172.17.10.162`
- ✅ Firewall allows port 8001

---

### 9. Security Best Practices

#### For Testing
- ✅ Use simple passwords (e.g., `test123456`)
- ✅ Fake emails are OK (e.g., `test@test.com`)
- ⚠️ Don't expose test server to internet

#### For Production
- ✅ Strong passwords (12+ characters, mixed case, numbers, symbols)
- ✅ Real email addresses (for password recovery)
- ✅ HTTPS enabled
- ✅ Regular password rotation
- ✅ Admin accounts limited (2-3 max)
- ✅ Disable unused accounts
- ✅ Monitor audit logs

---

### 10. Summary

**For Testing (Your Current Need):**

1. **No server configuration needed!**
2. Just open IDE → Switch to remote → Click "Register"
3. Create any username/password you want
4. Start using immediately

**Example Test Account:**
```
Username: testuser
Password: test123456
Email: test@example.com
Server: http://172.17.10.162:8001
```

**Create it via IDE or API:**
```bash
curl -X POST http://172.17.10.162:8001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"test123456"}'
```

Then login from your Windows IDE with these credentials! 🎉
