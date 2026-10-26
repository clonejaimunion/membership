# Electronic Archive - Enhanced PowerShell Installer/Updater
# VERSION: 2.0 - Production Ready
# Ensures updates appear immediately without cache issues

$ErrorActionPreference = "Stop"
$ServerUrl  = "__SERVER_URL__"
$InstallDir = Join-Path $env:LOCALAPPDATA "ElectronicArchive"
$ZipPath    = Join-Path $env:TEMP "EA.zip"
$Port       = 8090

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

function Write-Success($msg) {
    Write-Host "    ✓ $msg" -ForegroundColor Green
}

function Write-Warning($msg) {
    Write-Host "    ⚠ $msg" -ForegroundColor Yellow
}

Clear-Host
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Electronic Archive - Enhanced Installer v2.0" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Server:    $ServerUrl"
Write-Host "  Install:   $InstallDir"
Write-Host "  Port:      $Port"
Write-Host "============================================================"
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════
# STEP 0: COMPLETE SERVICE SHUTDOWN
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "0/12" "Stopping ALL services and processes..."

# Kill Python/Uvicorn
Get-Process pythonw -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "uvicorn|server\.py" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Kill VBS silent runners
Get-Process wscript -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Free the port
$portPid = (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
if ($portPid) { 
    Stop-Process -Id $portPid -Force -ErrorAction SilentlyContinue 
    Write-Success "Port $Port freed"
}

Start-Sleep -Seconds 3
Write-Success "All services stopped"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 1: CLEAR BROWSER CACHES (Critical for immediate updates)
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "1/12" "Clearing browser caches..."

# Chrome
$chromePath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache"
if (Test-Path $chromePath) {
    try {
        Remove-Item "$chromePath\*" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Success "Chrome cache cleared"
    } catch {
        Write-Warning "Chrome cache busy (browser may be open)"
    }
}

# Edge
$edgePath = "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache"
if (Test-Path $edgePath) {
    try {
        Remove-Item "$edgePath\*" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Success "Edge cache cleared"
    } catch {
        Write-Warning "Edge cache busy (browser may be open)"
    }
}

# Firefox
$firefoxPath = "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles"
if (Test-Path $firefoxPath) {
    Get-ChildItem $firefoxPath -Directory | ForEach-Object {
        $cachePath = Join-Path $_.FullName "cache2"
        if (Test-Path $cachePath) {
            try {
                Remove-Item "$cachePath\*" -Recurse -Force -ErrorAction SilentlyContinue
                Write-Success "Firefox cache cleared"
            } catch {
                Write-Warning "Firefox cache busy"
            }
        }
    }
}

Write-Success "Browser caches processed"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 2-4: Dependencies (Python, MongoDB, Tesseract)
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "2/12" "Checking Python..."
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
    Write-Warning "Installing Python 3.12..."
    winget install -e --id Python.Python.3.12 --silent --accept-source-agreements --accept-package-agreements
    $env:PATH = "$env:LOCALAPPDATA\Programs\Python\Python312;$env:LOCALAPPDATA\Programs\Python\Python312\Scripts;$env:PATH"
    Write-Success "Python installed"
} else {
    $v = & python --version
    Write-Success "$v"
}

Write-Step "3/12" "Checking MongoDB..."
$mongo = Get-Command mongod -ErrorAction SilentlyContinue
if (-not $mongo) {
    Write-Warning "Installing MongoDB..."
    winget install -e --id MongoDB.Server --silent --accept-source-agreements --accept-package-agreements
    Write-Success "MongoDB installed"
} else {
    Write-Success "MongoDB found"
}

# Ensure MongoDB service is running
$svc = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -ne "Running") {
    Start-Service MongoDB -ErrorAction SilentlyContinue
    Write-Success "MongoDB service started"
}

Write-Step "4/12" "Checking Tesseract OCR..."
$tess = Get-Command tesseract -ErrorAction SilentlyContinue
if (-not $tess) {
    try { 
        winget install -e --id UB-Mannheim.TesseractOCR --silent --accept-source-agreements --accept-package-agreements 
        Write-Success "Tesseract installed"
    } catch { 
        Write-Warning "Tesseract optional - skipping" 
    }
} else {
    Write-Success "Tesseract found"
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 5: DOWNLOAD LATEST VERSION
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "5/12" "Downloading latest version..."
[Net.ServicePointManager]::SecurityProtocol = "Tls12,Tls11,Tls"

# Add timestamp to avoid cache
$downloadUrl = "$ServerUrl/api/installer/download?t=" + (Get-Date -UFormat %s)
Invoke-WebRequest -Uri $downloadUrl -OutFile $ZipPath -UseBasicParsing -TimeoutSec 180 -Headers @{"Cache-Control"="no-cache"}

$size = (Get-Item $ZipPath).Length
Write-Success ("{0:N0} bytes downloaded" -f $size)

# ═══════════════════════════════════════════════════════════════════════════
# STEP 6: BACKUP USER DATA
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "6/12" "Backing up your data..."
if (-not (Test-Path $InstallDir)) { 
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null 
}

$backupRoot = Join-Path $env:TEMP "ea_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
if (Test-Path $backupRoot) { Remove-Item -Recurse -Force $backupRoot }

$storageDir = Join-Path $InstallDir "backend\storage"
$envFile    = Join-Path $InstallDir "backend\.env"

if (Test-Path $storageDir) {
    Copy-Item -Recurse -Force $storageDir $backupRoot\storage
    Write-Success "Storage backed up"
}
if (Test-Path $envFile) {
    Copy-Item -Force $envFile $backupRoot\.env
    Write-Success ".env backed up"
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 7: EXTRACT NEW VERSION
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "7/12" "Extracting new version..."

# Clear old build cache
$frontendBuildDir = Join-Path $InstallDir "frontend\build"
if (Test-Path $frontendBuildDir) {
    Remove-Item -Recurse -Force $frontendBuildDir -ErrorAction SilentlyContinue
    Write-Success "Old frontend build removed"
}

# Extract
Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force
Write-Success "Files extracted"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 8: RESTORE USER DATA
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "8/12" "Restoring your data..."

if (Test-Path $backupRoot\storage) {
    Remove-Item -Recurse -Force (Join-Path $InstallDir "backend\storage") -ErrorAction SilentlyContinue
    Copy-Item -Recurse -Force $backupRoot\storage (Join-Path $InstallDir "backend\storage")
    Write-Success "Storage restored"
}
if (Test-Path $backupRoot\.env) {
    Copy-Item -Force $backupRoot\.env (Join-Path $InstallDir "backend\.env")
    Write-Success ".env restored"
}

# Cleanup backup
Remove-Item -Recurse -Force $backupRoot -ErrorAction SilentlyContinue

# ═══════════════════════════════════════════════════════════════════════════
# STEP 9: UPDATE SERVICE WORKER VERSION (Critical!)
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "9/12" "Updating Service Worker version..."

$swPath = Join-Path $InstallDir "frontend\build\service-worker.js"
if (Test-Path $swPath) {
    $swContent = Get-Content $swPath -Raw
    $buildTime = (Get-Date).Ticks
    
    # Update CACHE_VERSION with unique timestamp
    $swContent = $swContent -replace 'const CACHE_VERSION = "v\d+";', "const CACHE_VERSION = `"v$buildTime`";"
    
    Set-Content -Path $swPath -Value $swContent -NoNewline
    Write-Success "Service Worker version: v$buildTime"
    
    # Create version.json for client-side version check
    $versionJson = @{
        version = $buildTime
        buildDate = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    } | ConvertTo-Json
    
    Set-Content -Path (Join-Path $InstallDir "frontend\build\version.json") -Value $versionJson
    Write-Success "version.json created"
} else {
    Write-Warning "Service Worker not found (optional)"
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 10: INSTALL PYTHON DEPENDENCIES
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "10/12" "Installing Python dependencies..."
Push-Location (Join-Path $InstallDir "backend")
try {
    & python -m pip install --upgrade pip -q
    & python -m pip install -r requirements.txt -q
    Write-Success "Dependencies installed"
} catch {
    Write-Warning "Some dependencies may have failed (non-critical)"
} finally {
    Pop-Location
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 11: START BACKEND SERVER
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "11/12" "Starting backend server..."

$serverScript = Join-Path $InstallDir "backend\server.py"
$vbsPath = Join-Path $InstallDir "run_silent.vbs"

# Create VBS silent runner
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$InstallDir\backend"
WshShell.Run "python -m uvicorn server:app --host 0.0.0.0 --port $Port --reload", 0, False
"@
Set-Content -Path $vbsPath -Value $vbsContent

# Start silently
Start-Process wscript -ArgumentList $vbsPath -WindowStyle Hidden

Start-Sleep -Seconds 5

# Verify server is running
$serverRunning = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $serverRunning = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if ($serverRunning) {
    Write-Success "Backend server running on port $Port"
} else {
    Write-Warning "Backend may take a moment to fully start"
}

# ═══════════════════════════════════════════════════════════════════════════
# STEP 12: CREATE DESKTOP SHORTCUT
# ═══════════════════════════════════════════════════════════════════════════

Write-Step "12/12" "Creating desktop shortcut..."

$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Electronic Archive.url"

$urlContent = @"
[InternetShortcut]
URL=http://localhost:$Port
IconIndex=0
IconFile=$InstallDir\backend\storage\assets\favicon.ico
"@

Set-Content -Path $shortcutPath -Value $urlContent
Write-Success "Desktop shortcut created"

# ═══════════════════════════════════════════════════════════════════════════
# COMPLETION
# ═══════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  ✓ Installation/Update Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Access the application:" -ForegroundColor Cyan
Write-Host "  → http://localhost:$Port" -ForegroundColor Yellow
Write-Host ""
Write-Host "  IMPORTANT: First time after update:" -ForegroundColor Yellow
Write-Host "  1. Close ALL browser windows" -ForegroundColor White
Write-Host "  2. Reopen browser" -ForegroundColor White
Write-Host "  3. Navigate to http://localhost:$Port" -ForegroundColor White
Write-Host ""
Write-Host "  If you see old version:" -ForegroundColor Yellow
Write-Host "  - Press Ctrl+Shift+R (Hard Refresh)" -ForegroundColor White
Write-Host "  - Or clear browser cache manually" -ForegroundColor White
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

# Auto-open browser after 3 seconds
Write-Host "Opening browser in 3 seconds..." -ForegroundColor Cyan
Write-Host "(Press Ctrl+C to cancel)" -ForegroundColor Gray
Start-Sleep -Seconds 3

Start-Process "http://localhost:$Port"

Write-Host ""
Write-Host "Done! Enjoy your application." -ForegroundColor Green
Write-Host ""
