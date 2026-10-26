# Electronic Archive  - PowerShell one-shot installer / updater
# Works for both FIRST INSTALL and UPDATES. Idempotent.
# Run from PowerShell (Admin):
#   iwr "https://<server>/api/installer/install.ps1" | iex

$ErrorActionPreference = "Stop"
$ServerUrl  = "__SERVER_URL__"
$InstallDir = Join-Path $env:LOCALAPPDATA "ElectronicArchive"
$ZipPath    = Join-Path $env:TEMP "EA.zip"
$Port       = 5599

# Self-elevate if not running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Re-launching as Administrator..." -ForegroundColor Yellow
    $arglist = "-NoProfile -ExecutionPolicy Bypass -Command iwr '$ServerUrl/api/installer/install.ps1' | iex"
    Start-Process powershell -ArgumentList $arglist -Verb RunAs
    exit
}

function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "[$n] $msg" -ForegroundColor Cyan
}

Clear-Host
Write-Host "============================================================"  -ForegroundColor Green
Write-Host "  Electronic Archive  -  Installer / Updater  (PowerShell)"   -ForegroundColor Green
Write-Host "============================================================"  -ForegroundColor Green
Write-Host "  Server:    $ServerUrl"
Write-Host "  Install:   $InstallDir"
Write-Host "  Port:      $Port"
Write-Host "============================================================"
Write-Host ""

# 0. Stop any old server (Python uvicorn + the wscript VBS silent runner)
Write-Step "0/9" "Stopping any old server ..."
Get-Process pythonw -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process python  -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "uvicorn" } | Stop-Process -Force -ErrorAction SilentlyContinue
# Kill the silent VBS runner so the new build is picked up cleanly
Get-Process wscript -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "ElectronicArchive" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process wscript -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
# Free the port if anything else is squatting on it
$portPid = (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
if ($portPid) { Stop-Process -Id $portPid -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Write-Host "    OK"

# 1. Check Python
Write-Step "1/9" "Checking Python ..."
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
    Write-Host "    Installing Python 3.12 via winget ..." -ForegroundColor Yellow
    winget install -e --id Python.Python.3.12 --silent --accept-source-agreements --accept-package-agreements
    $env:PATH = "$env:LOCALAPPDATA\Programs\Python\Python312;$env:LOCALAPPDATA\Programs\Python\Python312\Scripts;$env:PATH"
} else {
    $v = & python --version
    Write-Host "    OK - $v"
}

# 2. Check MongoDB
Write-Step "2/9" "Checking MongoDB ..."
$mongo = Get-Command mongod -ErrorAction SilentlyContinue
if (-not $mongo) {
    Write-Host "    Installing MongoDB Community via winget ..." -ForegroundColor Yellow
    winget install -e --id MongoDB.Server --silent --accept-source-agreements --accept-package-agreements
} else {
    Write-Host "    OK - MongoDB found"
}
# Ensure service is running
$svc = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -ne "Running") {
    Start-Service MongoDB -ErrorAction SilentlyContinue
}

# 3. Check Tesseract (optional - for OCR feature)
Write-Step "3/9" "Checking Tesseract OCR ..."
$tess = Get-Command tesseract -ErrorAction SilentlyContinue
if (-not $tess) {
    Write-Host "    Installing Tesseract via winget ..." -ForegroundColor Yellow
    try { winget install -e --id UB-Mannheim.TesseractOCR --silent --accept-source-agreements --accept-package-agreements } catch { Write-Host "    (Tesseract optional - skipping)" -ForegroundColor Yellow }
} else {
    Write-Host "    OK - Tesseract found"
}

# 4. Download latest ZIP
Write-Step "4/9" "Downloading latest application ZIP ..."
[Net.ServicePointManager]::SecurityProtocol = "Tls12,Tls11,Tls"
Invoke-WebRequest -Uri "$ServerUrl/api/installer/download" -OutFile $ZipPath -UseBasicParsing -TimeoutSec 180
$size = (Get-Item $ZipPath).Length
Write-Host ("    OK - {0:N0} bytes" -f $size)

# 5. Backup user data, extract, restore
Write-Step "5/9" "Extracting files (preserving your data) ..."
if (-not (Test-Path $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null }

$backupRoot = Join-Path $env:TEMP "ea_backup"
if (Test-Path $backupRoot) { Remove-Item -Recurse -Force $backupRoot }
$storageDir = Join-Path $InstallDir "backend\storage"
$envFile    = Join-Path $InstallDir "backend\.env"
if (Test-Path $storageDir) {
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    Copy-Item $storageDir -Destination (Join-Path $backupRoot "storage") -Recurse -Force
}
if (Test-Path $envFile) {
    if (-not (Test-Path $backupRoot)) { New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null }
    Copy-Item $envFile -Destination (Join-Path $backupRoot ".env") -Force
}

Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force
Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue

if (Test-Path (Join-Path $backupRoot "storage")) {
    Copy-Item (Join-Path $backupRoot "storage") -Destination (Join-Path $InstallDir "backend") -Recurse -Force
}
if (Test-Path (Join-Path $backupRoot ".env")) {
    Copy-Item (Join-Path $backupRoot ".env") -Destination $envFile -Force
}
if (Test-Path $backupRoot) { Remove-Item -Recurse -Force $backupRoot }
Write-Host "    OK"

# 6. Install Python requirements (minimal local set)
Write-Step "6/9" "Installing Python libraries ..."
Set-Location (Join-Path $InstallDir "backend")
& python -m pip install --upgrade pip --quiet
$reqFile = if (Test-Path "requirements-local.txt") { "requirements-local.txt" } else { "requirements.txt" }
& python -m pip install -r $reqFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "    [WARN] Some packages failed. Retrying with --no-cache-dir ..." -ForegroundColor Yellow
    & python -m pip install -r $reqFile --no-cache-dir
}
Write-Host "    OK"

# 7. Create .env if missing
if (-not (Test-Path ".env")) {
    @"
MONGO_URL=mongodb://localhost:27017
DB_NAME=electronic_archive
CORS_ORIGINS=http://localhost:5599,http://127.0.0.1:5599
"@ | Out-File -Encoding ASCII .env
}

# 8. Firewall + silent runner + auto-start + shortcut
Write-Step "7/9" "Configuring firewall and auto-start ..."
netsh advfirewall firewall delete rule name="Electronic Archive Server" | Out-Null
netsh advfirewall firewall add rule name="Electronic Archive Server" dir=in action=allow protocol=TCP localport=$Port | Out-Null

$vbsPath = Join-Path $InstallDir "run_silent.vbs"
$backendDir = Join-Path $InstallDir "backend"
@"
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$backendDir"
sh.Run "python -m uvicorn server:app --host 0.0.0.0 --port $Port", 0, False
"@ | Out-File -Encoding ASCII $vbsPath

# Open-archive launcher
$openBat = Join-Path $InstallDir "open_archive.bat"
@"
@echo off
wscript "$vbsPath"
timeout /t 3 >nul
start http://localhost:$Port
"@ | Out-File -Encoding ASCII $openBat

# Scheduled task (auto-start with Windows)
schtasks /Delete /F /TN "ElectronicArchiveServer" 2>$null | Out-Null
schtasks /Create /F /SC ONSTART /RL HIGHEST /TN "ElectronicArchiveServer" /TR "wscript.exe `"$vbsPath`"" | Out-Null

# Desktop shortcut
Write-Step "8/9" "Creating desktop shortcut ..."
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Electronic Archive.lnk"
$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $openBat
$shortcut.WorkingDirectory = $InstallDir
$shortcut.WindowStyle = 7
$shortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll,168"
$shortcut.Description = "Electronic Archive - Open in browser"
$shortcut.Save()
Write-Host "    OK"

# 9. Start the server now
Write-Step "9/9" "Starting server ..."
Start-Process wscript -ArgumentList "`"$vbsPath`"" -WindowStyle Hidden
Start-Sleep -Seconds 5

# Get local IP
$myIp = "localhost"
try {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -match "^192\.168\." -or $_.IPAddress -match "^10\." -or $_.IPAddress -match "^172\.(1[6-9]|2[0-9]|3[0-1])\." } | Select-Object -First 1).IPAddress
    if ($ip) { $myIp = $ip }
} catch {}

# Force-bust browser caches (Service Worker + HTTP) by appending a unique
# query param. The frontend's SW (network-first since v2) plus the cache-bust
# query guarantee the new build is loaded immediately — no manual Ctrl+F5,
# no DevTools, no "clear site data" step needed.
$bust = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$launchUrl = "http://localhost:$Port/?v=$bust"

Clear-Host
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "   [SUCCESS] Electronic Archive is running" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "   On THIS computer:        http://localhost:$Port"
Write-Host "   From OTHER devices:      http://${myIp}:$Port"
Write-Host ""
Write-Host "   Login:    admin / admin123"
Write-Host ""
Write-Host "   * Auto-starts with Windows"
Write-Host "   * Update later: run the same command again"
Write-Host "   * Desktop shortcut: 'Electronic Archive'"
Write-Host "============================================================"
Write-Host ""
Start-Process $launchUrl
Write-Host "Press Enter to close ..."
Read-Host
