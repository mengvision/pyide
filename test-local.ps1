# PyIDE Automated Local Test Script
# Run this AFTER Docker Desktop is installed and running

$ErrorActionPreference = "Stop"

Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║     PyIDE Local Test Suite               ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Test 1: Verify Docker
Write-Host "[1/8] Checking Docker installation..." -ForegroundColor Cyan
try {
    $dockerVersion = docker --version
    $composeVersion = docker compose version
    Write-Host "  ✓ Docker: $dockerVersion" -ForegroundColor Green
    Write-Host "  ✓ Compose: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Docker is not installed or not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Docker Desktop:" -ForegroundColor Yellow
    Write-Host "  1. Download: https://www.docker.com/products/docker-desktop/" -ForegroundColor White
    Write-Host "  2. Install and restart computer" -ForegroundColor White
    Write-Host "  3. Open Docker Desktop and wait for it to start" -ForegroundColor White
    Write-Host "  4. Run this script again" -ForegroundColor White
    exit 1
}

Write-Host ""

# Test 2: Check if services are already running
Write-Host "[2/8] Checking for existing PyIDE services..." -ForegroundColor Cyan
$runningServices = docker compose -f docker-compose.lan.yml ps --format json 2>$null

if ($runningServices) {
    Write-Host "  ⚠ PyIDE services are already running" -ForegroundColor Yellow
    $stopNow = Read-Host "  Stop and rebuild? (y/n)"
    if ($stopNow -eq "y" -or $stopNow -eq "Y") {
        Write-Host "  Stopping existing services..." -ForegroundColor Yellow
        docker compose -f docker-compose.lan.yml down
    } else {
        Write-Host "  Using existing services" -ForegroundColor Green
    }
}

Write-Host ""

# Test 3: Build and start services
Write-Host "[3/8] Building and starting PyIDE services..." -ForegroundColor Cyan
Write-Host "  This may take 3-5 minutes on first run..." -ForegroundColor Yellow
Write-Host ""

docker compose -f docker-compose.lan.yml up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Failed to start services" -ForegroundColor Red
    Write-Host "  View logs: docker compose -f docker-compose.lan.yml logs" -ForegroundColor Yellow
    exit 1
}

Write-Host "  ✓ Services started" -ForegroundColor Green
Write-Host ""

# Test 4: Wait for services to be ready
Write-Host "[4/8] Waiting for services to initialize..." -ForegroundColor Cyan
Write-Host "  Waiting 15 seconds for database..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Check container status
$status = docker compose -f docker-compose.lan.yml ps --format "table {{.Name}}\t{{.Status}}"
Write-Host $status
Write-Host ""

# Test 5: Test API health
Write-Host "[5/8] Testing API health check..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ API is healthy: $($response.Content)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ API returned status $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ✗ API health check failed" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  View API logs: docker compose -f docker-compose.lan.yml logs api" -ForegroundColor Yellow
}

Write-Host ""

# Test 6: Test Web UI
Write-Host "[6/8] Testing Web UI..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ Web UI is accessible at http://localhost:3000" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ Web UI is not accessible" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  View web logs: docker compose -f docker-compose.lan.yml logs web" -ForegroundColor Yellow
}

Write-Host ""

# Test 7: Test API Documentation
Write-Host "[7/8] Testing API documentation..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/docs" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ API docs available at http://localhost:8000/docs" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠ API docs not accessible (non-critical)" -ForegroundColor Yellow
}

Write-Host ""

# Test 8: Test Registration API
Write-Host "[8/8] Testing user registration API..." -ForegroundColor Cyan
$testUser = @{
    username = "testuser_$(Get-Date -Format 'HHmmss')"
    email = "test$(Get-Date -Format 'HHmmss')@example.com"
    password = "Test123456!"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/auth/register" `
        -Method POST `
        -ContentType "application/json" `
        -Body $testUser
    
    if ($response.access_token) {
        Write-Host "  ✓ Registration API works" -ForegroundColor Green
        Write-Host "  ✓ JWT token received" -ForegroundColor Green
    }
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "  ⚠ User already exists (from previous test)" -ForegroundColor Yellow
    } else {
        Write-Host "  ✗ Registration failed" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║     Test Summary                         ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Show access URLs
Write-Host "Access URLs:" -ForegroundColor Cyan
Write-Host "  🌐 Web IDE:    http://localhost:3000" -ForegroundColor White
Write-Host "  🔌 API:        http://localhost:8000" -ForegroundColor White
Write-Host "  📚 API Docs:   http://localhost:8000/docs" -ForegroundColor White
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host "  2. Register a new account" -ForegroundColor White
Write-Host "  3. Create a Python file and run it" -ForegroundColor White
Write-Host "  4. Verify code execution works" -ForegroundColor White
Write-Host ""

Write-Host "Useful Commands:" -ForegroundColor Cyan
Write-Host "  View logs:          docker compose -f docker-compose.lan.yml logs -f" -ForegroundColor Yellow
Write-Host "  Stop services:      docker compose -f docker-compose.lan.yml down" -ForegroundColor Yellow
Write-Host "  Restart services:   docker compose -f docker-compose.lan.yml restart" -ForegroundColor Yellow
Write-Host "  Container status:   docker compose -f docker-compose.lan.yml ps" -ForegroundColor Yellow
Write-Host ""

# Offer to open browser
$openBrowser = Read-Host "Open Web IDE in browser now? (y/n)"
if ($openBrowser -eq "y" -or $openBrowser -eq "Y") {
    Start-Process "http://localhost:3000"
    Write-Host "  ✓ Browser opened" -ForegroundColor Green
}

Write-Host ""
Write-Host "Happy coding! 🚀" -ForegroundColor Green
