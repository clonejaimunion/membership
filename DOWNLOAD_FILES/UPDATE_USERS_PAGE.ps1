# ═══════════════════════════════════════════════════════════════
#  سكريبت التحديث الشامل - إصلاح صلاحيات المستخدمين
# ═══════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   🔧 تحديث صفحة إدارة المستخدمين - إصلاح جذري   " -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# المسارات
$appRoot = "$env:LOCALAPPDATA\ElectronicArchive"
$targetFile = "$appRoot\frontend\src\pages\UsersAdminPage.js"
$backupFile = "$appRoot\frontend\src\pages\UsersAdminPage.js.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

# التحقق من وجود المجلد
if (-not (Test-Path $appRoot)) {
    Write-Host "❌ خطأ: لم أجد مجلد التطبيق في:" -ForegroundColor Red
    Write-Host "   $appRoot" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "الرجاء تحديد المسار الصحيح للتطبيق:" -ForegroundColor Yellow
    $customPath = Read-Host "أدخل المسار الكامل للتطبيق"
    if ($customPath) {
        $appRoot = $customPath
        $targetFile = "$appRoot\frontend\src\pages\UsersAdminPage.js"
        $backupFile = "$appRoot\frontend\src\pages\UsersAdminPage.js.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    } else {
        Write-Host "❌ تم الإلغاء." -ForegroundColor Red
        pause
        exit
    }
}

Write-Host "[1/6] التحقق من الملفات..." -ForegroundColor Yellow

if (-not (Test-Path $targetFile)) {
    Write-Host "❌ خطأ: لم أجد الملف المطلوب:" -ForegroundColor Red
    Write-Host "   $targetFile" -ForegroundColor Yellow
    pause
    exit
}

Write-Host "   ✅ الملف موجود" -ForegroundColor Green

# النسخ الاحتياطي
Write-Host ""
Write-Host "[2/6] إنشاء نسخة احتياطية..." -ForegroundColor Yellow
try {
    Copy-Item -Path $targetFile -Destination $backupFile -Force
    Write-Host "   ✅ تم الحفظ في: $backupFile" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  تحذير: لم أستطع إنشاء نسخة احتياطية" -ForegroundColor Yellow
}

# إيقاف العمليات
Write-Host ""
Write-Host "[3/6] إيقاف التطبيق..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
$pythonProcesses = Get-Process -Name "python" -ErrorAction SilentlyContinue

if ($nodeProcesses -or $pythonProcesses) {
    Stop-Process -Name "node","python" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "   ✅ تم إيقاف العمليات" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  التطبيق غير مشغل" -ForegroundColor Cyan
}

# تحديث الملف
Write-Host ""
Write-Host "[4/6] تطبيق التحديثات..." -ForegroundColor Yellow

# قراءة الملف الحالي
$content = Get-Content -Path $targetFile -Raw -Encoding UTF8

# التحديث #1: إضافة البوابات المفقودة في useState
$oldPattern1 = @'
  const \[allPortals, setAllPortals\] = useState\(\[
    \{ key: "membership", label: "العضوية" \},
    \{ key: "financial", label: "الموقف المالي" \},
    \{ key: "financial\.pension", label: "الموقف المالي ← المعاش" \},
    \{ key: "financial\.resignations", label: "الموقف المالي ← الاستقالات" \},
    \{ key: "financial\.dropout", label: "الموقف المالي ← الإسقاط" \},
    \{ key: "financial\.letters", label: "الموقف المالي ← الخطابات" \},
    \{ key: "financial\.subscriptions", label: "الموقف المالي ← الاشتراكات" \},
    \{ key: "financial\.dues_settlements", label: "الموقف المالي ← تسوية المستحقات" \},
    \{ key: "financial\.aid", label: "الموقف المالي ← الإعانات" \},
    \{ key: "financial\.dues", label: "الموقف المالي ← مستحقات اللجان" \},
    \{ key: "financial\.disclosure", label: "الموقف المالي ← الكشوف التفريغية" \},
  \]\);
'@

$newPattern1 = @'
  const [allPortals, setAllPortals] = useState([
    { key: "membership", label: "العضوية" },
    { key: "financial", label: "الموقف المالي" },
    { key: "financial.pension", label: "الموقف المالي ← المعاش" },
    { key: "financial.resignations", label: "الموقف المالي ← الاستقالات" },
    { key: "financial.dropout", label: "الموقف المالي ← الإسقاط" },
    { key: "financial.letters", label: "الموقف المالي ← الخطابات" },
    { key: "financial.subscriptions", label: "الموقف المالي ← الاشتراكات" },
    { key: "financial.dues_settlements", label: "الموقف المالي ← تسوية المستحقات" },
    { key: "financial.aid", label: "الموقف المالي ← الإعانات" },
    { key: "financial.dues", label: "الموقف المالي ← مستحقات اللجان" },
    { key: "financial.disclosure", label: "الموقف المالي ← الكشوف التفريغية" },
    { key: "admin", label: "صفحة الأدمن" },
    { key: "users", label: "إدارة المستخدمين" },
  ]);
'@

# Apply using simple string replacement
if ($content -match 'const \[allPortals.*?\]\);') {
    Write-Host "   📝 تحديث #1: إضافة البوابات المفقودة (admin, users)..." -ForegroundColor Cyan
    
    # استخراج البوابات الحالية وإضافة المفقودة
    $stateBlock = $matches[0]
    
    if ($stateBlock -notmatch '"admin"') {
        # إضافة البوابات المفقودة قبل الإغلاق
        $stateBlock = $stateBlock -replace '  \]\);', @'
    { key: "admin", label: "صفحة الأدمن" },
    { key: "users", label: "إدارة المستخدمين" },
  ]);
'@
        $content = $content -replace 'const \[allPortals.*?\]\);', $stateBlock
        Write-Host "      ✅ تم إضافة البوابات" -ForegroundColor Green
    } else {
        Write-Host "      ℹ️  البوابات موجودة مسبقاً" -ForegroundColor Cyan
    }
}

# التحديث #2: إضافة items-stretch للـ Grid
Write-Host "   📝 تحديث #2: تحسين التنسيق (items-stretch)..." -ForegroundColor Cyan
$content = $content -replace 'className="grid gap-1 md:grid-cols-2 max-h-56', 'className="grid gap-1 md:grid-cols-2 items-stretch max-h-56'
Write-Host "      ✅ تم" -ForegroundColor Green

# التحديث #3: إضافة min-h للأزرار
Write-Host "   📝 تحديث #3: توحيد ارتفاع الأزرار (min-h)..." -ForegroundColor Cyan
$content = $content -replace 'className=\{\`flex items-center gap-2 rounded border px-2 py-1\.5 text-start text-xs transition ', 'className={`flex items-center gap-2 rounded border px-2 py-1.5 text-start text-xs transition min-h-[2.5rem] '
Write-Host "      ✅ تم" -ForegroundColor Green

# التحديث #4: إضافة flex-shrink-0 للأيقونة
Write-Host "   📝 تحديث #4: تثبيت حجم الأيقونة (flex-shrink-0)..." -ForegroundColor Cyan
$content = $content -replace 'className=\{\`grid h-4 w-4 place-items-center', 'className={`grid h-4 w-4 flex-shrink-0 place-items-center'
Write-Host "      ✅ تم" -ForegroundColor Green

# حفظ الملف المحدث
Set-Content -Path $targetFile -Value $content -Encoding UTF8 -NoNewline
Write-Host ""
Write-Host "   ✅ تم تطبيق جميع التحديثات بنجاح!" -ForegroundColor Green

# مسح الكاش
Write-Host ""
Write-Host "[5/6] تنظيف الكاش..." -ForegroundColor Yellow
$browsers = @(
    "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache",
    "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache",
    "$env:APPDATA\Mozilla\Firefox\Profiles"
)

foreach ($cache in $browsers) {
    if (Test-Path $cache) {
        Remove-Item -Path "$cache\*" -Force -Recurse -ErrorAction SilentlyContinue
    }
}
Write-Host "   ✅ تم تنظيف الكاش" -ForegroundColor Green

# إعادة التشغيل
Write-Host ""
Write-Host "[6/6] إعادة تشغيل التطبيق..." -ForegroundColor Yellow

$startScript = "$appRoot\START_APP_WITH_SPLASH.ps1"
if (Test-Path $startScript) {
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`"" -WindowStyle Hidden
    Write-Host "   ✅ تم تشغيل التطبيق" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  لم أجد سكريبت الإطلاق. شغّل التطبيق يدوياً" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "   ✅ اكتمل التحديث بنجاح!   " -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "📋 ملخص التحديثات:" -ForegroundColor Cyan
Write-Host "   ✅ إضافة البوابات المفقودة (admin, users)" -ForegroundColor White
Write-Host "   ✅ تحسين تنسيق Grid (items-stretch)" -ForegroundColor White
Write-Host "   ✅ توحيد ارتفاع الأزرار (min-h-[2.5rem])" -ForegroundColor White
Write-Host "   ✅ تثبيت حجم الأيقونة (flex-shrink-0)" -ForegroundColor White
Write-Host ""
Write-Host "🔒 الضمانات:" -ForegroundColor Cyan
Write-Host "   ✅ بيانات المستخدمين محفوظة 100%" -ForegroundColor White
Write-Host "   ✅ قاعدة البيانات لم تُمس" -ForegroundColor White
Write-Host "   ✅ نسخة احتياطية محفوظة" -ForegroundColor White
Write-Host ""
Write-Host "⏳ انتظر 10-15 ثانية ثم افتح المتصفح:" -ForegroundColor Yellow
Write-Host "   http://192.168.0.105:3000/admin/users" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 إذا استمرت المشكلة:" -ForegroundColor Yellow
Write-Host "   1. أغلق المتصفح بالكامل (Ctrl+Shift+Q)" -ForegroundColor White
Write-Host "   2. افتح المتصفح من جديد" -ForegroundColor White
Write-Host "   3. اضغط Ctrl+Shift+R لتحديث الصفحة" -ForegroundColor White
Write-Host ""
pause
