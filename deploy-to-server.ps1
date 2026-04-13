# PyIDE LAN Deployment - Windows Transfer Script
# Run this on your Windows laptop to transfer PyIDE to your server

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerIP,
    
    [Parameter(Mandatory=$true)]
    [string]$Username,
    
    [string]$RemotePath="~/pyide"
)

Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║     PyIDE Server Transfer Script         ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

$sourcePath = "C:\Users\lenovo\Desktop\python_ide1"

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Source:      $sourcePath"
Write-Host "  Server:      $Username@$ServerIP"
Write-Host "  Remote Path: $RemotePath"
Write-Host ""

# Test SSH connection
Write-Host "Testing SSH connection..." -ForegroundColor Yellow
try {
    ssh -o ConnectTimeout=5 -o BatchMode=yes "$Username@$ServerIP" "echo 'Connection successful'" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "SSH connection failed"
    }
} catch {
    Write-Host "✗ Cannot connect to server via SSH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please ensure:" -ForegroundColor Yellow
    Write-Host "  1. SSH is configured (ssh-keygen + ssh-copy-id)" -ForegroundColor Yellow
    Write-Host "  2. Server is reachable at $ServerIP" -ForegroundColor Yellow
    Write-Host "  3. Username '$Username' exists on server" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Setup SSH:" -ForegroundColor Cyan
    Write-Host "  ssh-keygen -t rsa -b 4096" -ForegroundColor White
    Write-Host "  ssh-copy-id $Username@$ServerIP" -ForegroundColor White
    exit 1
}

Write-Host "✓ SSH connection successful" -ForegroundColor Green
Write-Host ""

# Create remote directory
Write-Host "Creating remote directory..." -ForegroundColor Yellow
ssh "$Username@$ServerIP" "mkdir -p $RemotePath"

# Transfer files using SCP
Write-Host ""
Write-Host "Transferring files (this may take a few minutes)..." -ForegroundColor Yellow
Write-Host ""

# Use robocopy to create a temporary clean copy (excluding unnecessary files)
$tempDir = "$env:TEMP\pyide-transfer"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}

Write-Host "Preparing files for transfer..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Copy necessary files (exclude node_modules, .git, etc.)
$excludeDirs = @("/node_modules", "/.git", "/dist", "/target", "/.qoder", "__pycache__")
$excludeFiles = @("*.log", "*.pyc")

robocopy $sourcePath $tempDir /E /NFL /NDL /NJH /NJS /nc /ns /np `
    /XD "node_modules" ".git" "dist" "target" ".qoder" "__pycache__" `
    /XF "*.log" "*.pyc" "test_pyide.db"

# Transfer using scp
Write-Host "Uploading to server..." -ForegroundColor Yellow
scp -r "$tempDir\*" "$Username@${ServerIP}:${RemotePath}"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Files transferred successfully" -ForegroundColor Green
} else {
    Write-Host "✗ File transfer failed" -ForegroundColor Red
    exit 1
}

# Clean up temp directory
Remove-Item $tempDir -Recurse -Force

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║     Transfer Complete!                   ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. SSH into your server:" -ForegroundColor White
Write-Host "     ssh $Username@$ServerIP" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Navigate to PyIDE directory:" -ForegroundColor White
Write-Host "     cd $RemotePath" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. Make deployment script executable:" -ForegroundColor White
Write-Host "     chmod +x deploy-lan.sh" -ForegroundColor Yellow
Write-Host ""
Write-Host "  4. Run deployment:" -ForegroundColor White
Write-Host "     ./deploy-lan.sh" -ForegroundColor Yellow
Write-Host ""
Write-Host "  5. Access from your browser:" -ForegroundColor White
Write-Host "     http://${ServerIP}:3000" -ForegroundColor Yellow
Write-Host ""

# Option to run deployment automatically
$autoDeploy = Read-Host "Would you like to run deployment now? (y/n)"
if ($autoDeploy -eq "y" -or $autoDeploy -eq "Y") {
    Write-Host ""
    Write-Host "Running deployment on server..." -ForegroundColor Yellow
    Write-Host ""
    
    ssh "$Username@$ServerIP" "cd $RemotePath && chmod +x deploy-lan.sh && ./deploy-lan.sh"
}
