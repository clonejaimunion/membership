# =====================================================
#  تحديث الأرشيف الإلكتروني (member.union) من GitHub
#  يُشغَّل بأمر واحد من PowerShell:
#    [Net.ServicePointManager]::SecurityProtocol='Tls12'; iex (irm 'https://raw.githubusercontent.com/Fraction2026/member.union/main/release/update.ps1')
#  - نسخة احتياطية كاملة تلقائية أولاً (قاعدة البيانات + المستندات + الإعدادات)
#  - يحدّث ملفات البرنامج فقط ولا يحذف قاعدة البيانات أو المستندات أو ملفات .env
#  - الواجهة مبنية جاهزة (لا يحتاج Node.js) — التشغيل على http://localhost:5599
# =====================================================
& {
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$zipUrl = 'https://raw.githubusercontent.com/Fraction2026/member.union/main/release/member_union_update.zip'
$port = 5599

function Fail($msg) {
    Write-Host "✗ $msg" -ForegroundColor Red
    Write-Host '  لم يتم حذف أو تغيير أي بيانات.' -ForegroundColor Yellow
}

# 1) مجلد البرنامج
$t = @(
    "$env:LOCALAPPDATA\ElectronicArchive",
    "$env:APPDATA\ElectronicArchive",
    "$env:ProgramFiles\ElectronicArchive",
    "C:\ElectronicArchive"
) | Where-Object { Test-Path "$_\backend\server.py" } | Select-Object -First 1
if (-not $t) {
    $t = "$env:LOCALAPPDATA\ElectronicArchive"
    Write-Host "لم يتم العثور على تثبيت سابق — سيتم التثبيت في: $t" -ForegroundColor Yellow
}
Write-Host "مجلد البرنامج: $t" -ForegroundColor Cyan

# 2) Python
$py = @("$t\backend\venv\Scripts\python.exe", "C:\Python314\python.exe", "C:\Python313\python.exe", "C:\Python312\python.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $py) { $c = Get-Command python -ErrorAction SilentlyContinue; if ($c) { $py = $c.Source } }
if (-not $py) { Fail 'Python غير مثبت. ثبّته من https://www.python.org (مع اختيار Add to PATH) ثم أعد المحاولة.'; return }

# 3) تحميل الحزمة
Write-Host 'جارٍ تحميل حزمة التحديث من GitHub...' -ForegroundColor Cyan
$tmp = Join-Path $env:TEMP ('mu_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$zip = Join-Path $tmp 'update.zip'
try { Invoke-WebRequest -UseBasicParsing -Uri $zipUrl -OutFile $zip } catch { Fail "فشل التحميل: $_"; return }
Expand-Archive -Path $zip -DestinationPath $tmp -Force
$p = $tmp
if (-not (Test-Path "$p\backend\server.py")) {
    $d = Get-ChildItem -Path $tmp -Recurse -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'backend\server.py') } | Select-Object -First 1
    if ($d) { $p = $d.FullName }
}
if (-not (Test-Path "$p\backend\server.py") -or -not (Test-Path "$p\frontend\build\index.html")) { Fail 'ملفات التحديث غير صحيحة'; return }

# 4) إيقاف الخادم فقط (لا نوقف MongoDB)
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*uvicorn*server:app*' -or $_.CommandLine -like '*health_loop.bat*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

# 5) نسخة احتياطية إلزامية
$backupRoot = "$env:LOCALAPPDATA\ElectronicArchive_Backups"
if (Test-Path "$t\backend\server.py") {
    Write-Host 'نسخة احتياطية من البيانات...' -ForegroundColor Cyan
    & $py -m pip install --quiet --disable-pip-version-check pymongo 2>&1 | Out-Null
    & $py "$p\deploy\backup_data.py" $t $backupRoot
    if ($LASTEXITCODE -ne 0) { Fail 'فشل النسخ الاحتياطي — تم إيقاف التحديث. تأكد أن خدمة MongoDB تعمل ثم أعد المحاولة.'; return }
    $b = "$backupRoot\code_$(Get-Date -Format yyyyMMdd_HHmmss)"
    New-Item -ItemType Directory -Force -Path $b | Out-Null
    Copy-Item "$t\backend\server.py" "$b\server.py" -Force
    if (Test-Path "$t\frontend\build") { Copy-Item "$t\frontend\build" "$b\frontend_build" -Recurse -Force }
}

# 6) تطبيق التحديث (robocopy بدون /MIR لا يحذف أي ملف، ونستثني storage و .env)
Write-Host 'تطبيق التحديث...' -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $t | Out-Null
robocopy $p $t /E /NFL /NDL /NJH /NJS /NP /XD storage venv node_modules .git /XF .env update.zip | Out-Null
if ($LASTEXITCODE -ge 8) { Fail "فشل نسخ الملفات (robocopy $LASTEXITCODE)"; return }
# استبدال ملفات الواجهة القديمة بالمبنية الجديدة
robocopy "$p\frontend\build" "$t\frontend\build" /MIR /NFL /NDL /NJH /NJS /NP | Out-Null

if (-not (Test-Path "$t\backend\.env")) { Copy-Item "$t\deploy\backend.env.example" "$t\backend\.env" }
New-Item -ItemType Directory -Force -Path "$t\backend\storage" | Out-Null
foreach ($f in 'health_loop.bat', 'run_silent.vbs', 'start_server.bat', 'stop_server.bat', 'update.bat') {
    if (Test-Path "$t\deploy\$f") { Copy-Item "$t\deploy\$f" "$t\$f" -Force }
}

# 7) المكتبات
Write-Host 'تحديث مكتبات Python...' -ForegroundColor Cyan
& $py -m pip install --quiet --disable-pip-version-check -r "$t\backend\requirements-local.txt"
if ($LASTEXITCODE -ne 0) { Write-Host '! تعذّر تحديث بعض المكتبات (تحقق من الإنترنت)' -ForegroundColor Yellow }

# 8) التشغيل
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Start-Process wscript -ArgumentList "`"$t\run_silent.vbs`""
$up = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 1
    try { Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$port/api/health" -TimeoutSec 2 | Out-Null; $up = $true; break } catch {}
}
if ($up) {
    Write-Host "✓ تم التحديث بنجاح — البرنامج يعمل على http://localhost:$port" -ForegroundColor Green
    Start-Process "http://localhost:$port"
} else {
    Write-Host '! تم التحديث لكن الخادم لم يستجب بعد. تأكد أن MongoDB يعمل وراجع:' -ForegroundColor Yellow
    Write-Host "  $t\server.log" -ForegroundColor Yellow
}
Write-Host "النسخ الاحتياطية: $backupRoot" -ForegroundColor White
}
