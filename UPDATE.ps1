# ===================================================
# تحديث / تثبيت الأرشيف الإلكتروني — نسخة آمنة
# - يأخذ نسخة احتياطية كاملة من البيانات قبل أي تغيير ويتوقف لو فشلت
# - يحدّث ملفات البرنامج فقط: لا يحذف مجلد البرنامج ولا قاعدة البيانات
#   ولا مجلد المستندات (storage) ولا ملفات الإعدادات (.env)
# - يشغّل البرنامج على http://localhost:5599
# ===================================================
param(
    [string]$AppDir = "$env:LOCALAPPDATA\ElectronicArchive",
    [string]$BackupRoot = "$env:LOCALAPPDATA\ElectronicArchive_Backups",
    [string]$ZipUrl = "https://github.com/clonejaimunion/membership/archive/refs/heads/main.zip",
    [int]$Port = 5599
)

$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Step($t) { Write-Host ""; Write-Host "» $t" -ForegroundColor Yellow }
function Ok($t) { Write-Host "   ✓ $t" -ForegroundColor Green }
function Fail($t) {
    Write-Host "   ✗ $t" -ForegroundColor Red
    Write-Host "   لم يتم حذف أو استبدال أي بيانات." -ForegroundColor Yellow
    Read-Host "اضغط Enter للخروج"
    exit 1
}

function Find-Python {
    foreach ($p in @("$AppDir\backend\venv\Scripts\python.exe", "C:\Python314\python.exe", "C:\Python313\python.exe", "C:\Python312\python.exe")) {
        if (Test-Path $p) { return $p }
    }
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $cmd = Get-Command py -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

Write-Host "=================================" -ForegroundColor Cyan
Write-Host " تحديث الأرشيف الإلكتروني (آمن)" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Cyan
Write-Host " مجلد البرنامج: $AppDir"
Write-Host " النسخ الاحتياطية: $BackupRoot"

$isUpdate = Test-Path "$AppDir\backend"
$python = Find-Python
if (-not $python) { Fail "Python غير مثبت. ثبّته من https://www.python.org ثم أعد المحاولة." }
Ok "Python: $python"

# 1) إيقاف الخادم
Step "إيقاف الخادم الحالي..."
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*uvicorn*server:app*" -or $_.CommandLine -like "*health_loop.bat*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Ok "تم"

# 2) تحميل التحديث (قبل لمس أي شيء)
Step "تحميل آخر نسخة..."
$tempDir = Join-Path $env:TEMP ("EA_Update_" + (Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
$zipPath = "$tempDir\repo.zip"
try { Invoke-WebRequest -Uri $ZipUrl -OutFile $zipPath -UseBasicParsing } catch { Fail "فشل التحميل: $_" }
Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
$src = Get-ChildItem -Path $tempDir -Directory | Select-Object -First 1
if (-not $src -or -not (Test-Path "$($src.FullName)\backend\server.py")) { Fail "ملف التحديث غير صالح" }
Ok "تم التحميل"

# 3) نسخة احتياطية إلزامية
if ($isUpdate) {
    Step "نسخة احتياطية من البيانات..."
    & $python -m pip install --quiet pymongo 2>&1 | Out-Null
    $backupScript = "$($src.FullName)\deploy\backup_data.py"
    & $python $backupScript $AppDir $BackupRoot
    if ($LASTEXITCODE -ne 0) { Fail "فشل النسخ الاحتياطي — تم إيقاف التحديث للحفاظ على بياناتك." }
    Ok "النسخة الاحتياطية محفوظة في $BackupRoot"
}

# 4) تحديث الملفات فقط (بدون حذف) — robocopy بدون /MIR أو /PURGE لا يحذف شيئاً
Step "تحديث ملفات البرنامج..."
New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
robocopy $src.FullName $AppDir /E /NFL /NDL /NJH /NJS /NP /XD storage venv node_modules .git build /XF .env | Out-Null
if ($LASTEXITCODE -ge 8) { Fail "فشل نسخ الملفات (robocopy code $LASTEXITCODE)" }
Ok "تم تحديث الملفات"

# 5) الإعدادات — تُنشأ فقط إن لم تكن موجودة، ولا يتغير DB_NAME أبداً
$backendEnv = "$AppDir\backend\.env"
if (-not (Test-Path $backendEnv)) {
    Copy-Item "$AppDir\deploy\backend.env.example" $backendEnv
    Ok "تم إنشاء backend\.env"
}
New-Item -ItemType Directory -Path "$AppDir\backend\storage" -Force | Out-Null
# الواجهة تُخدَم من نفس الخادم، لذا يكون العنوان نسبياً (يعمل على localhost وعلى الشبكة)
Set-Content -Path "$AppDir\frontend\.env" -Value "REACT_APP_BACKEND_URL=" -Encoding ASCII

# 6) المكتبات وبناء الواجهة
Step "تثبيت مكتبات Python..."
& $python -m pip install --quiet -r "$AppDir\backend\requirements-local.txt"
if ($LASTEXITCODE -ne 0) { Fail "فشل تثبيت مكتبات Python" }
Ok "تم"

Step "بناء الواجهة (قد يستغرق بضع دقائق)..."
Push-Location "$AppDir\frontend"
if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) { npm install -g yarn | Out-Null }
yarn install --silent
$env:REACT_APP_BACKEND_URL = ""
yarn build
$buildOk = $LASTEXITCODE -eq 0
Pop-Location
if (-not $buildOk) { Fail "فشل بناء الواجهة. تأكد من تثبيت Node.js" }
Ok "تم"

# 7) سكريبتات التشغيل في جذر البرنامج
foreach ($f in @("health_loop.bat", "run_silent.vbs", "start_server.bat", "stop_server.bat", "update.bat")) {
    if (Test-Path "$AppDir\deploy\$f") { Copy-Item "$AppDir\deploy\$f" "$AppDir\$f" -Force }
}

# 8) التشغيل
Step "تشغيل البرنامج على المنفذ $Port..."
Start-Process wscript -ArgumentList "`"$AppDir\run_silent.vbs`""
$up = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 1
    try { Invoke-WebRequest -Uri "http://localhost:$Port/api/health" -TimeoutSec 2 -UseBasicParsing | Out-Null; $up = $true; break } catch {}
}
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
if ($up) {
    Write-Host "✓ اكتمل التحديث — البرنامج يعمل: http://localhost:$Port" -ForegroundColor Green
    Start-Process "http://localhost:$Port"
} else {
    Write-Host "! تم التحديث لكن الخادم لم يستجب بعد." -ForegroundColor Yellow
    Write-Host "  تأكد أن خدمة MongoDB تعمل، وراجع السجل: $AppDir\server.log" -ForegroundColor Yellow
}
Write-Host "  بياناتك لم تُمس. النسخ الاحتياطية في: $BackupRoot" -ForegroundColor White
Read-Host "اضغط Enter للخروج"
