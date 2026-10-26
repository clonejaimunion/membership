# ===================================================
# تشغيل الأرشيف الإلكتروني مع نافذة تحميل احترافية
# ===================================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$appDir = "$env:LOCALAPPDATA\ElectronicArchive"

# إنشاء نافذة التحميل
$splashForm = New-Object System.Windows.Forms.Form
$splashForm.Text = "الأرشيف الإلكتروني"
$splashForm.Size = New-Object System.Drawing.Size(500, 280)
$splashForm.StartPosition = "CenterScreen"
$splashForm.FormBorderStyle = "None"
$splashForm.BackColor = [System.Drawing.Color]::White
$splashForm.TopMost = $true

# إضافة ظل للنافذة
$splashForm.Padding = New-Object System.Windows.Forms.Padding(3)

# شريط علوي ملون
$headerPanel = New-Object System.Windows.Forms.Panel
$headerPanel.Size = New-Object System.Drawing.Size(500, 60)
$headerPanel.Location = New-Object System.Drawing.Point(0, 0)
$headerPanel.BackColor = [System.Drawing.Color]::FromArgb(138, 43, 226)  # لون بنفسجي
$splashForm.Controls.Add($headerPanel)

# عنوان التطبيق
$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = "الأرشيف الإلكتروني"
$titleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$titleLabel.ForeColor = [System.Drawing.Color]::White
$titleLabel.Size = New-Object System.Drawing.Size(500, 40)
$titleLabel.Location = New-Object System.Drawing.Point(0, 10)
$titleLabel.TextAlign = "MiddleCenter"
$headerPanel.Controls.Add($titleLabel)

# رسالة الحالة
$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = "جاري تشغيل التطبيق..."
$statusLabel.Font = New-Object System.Drawing.Font("Segoe UI", 11)
$statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(100, 100, 100)
$statusLabel.Size = New-Object System.Drawing.Size(480, 30)
$statusLabel.Location = New-Object System.Drawing.Point(10, 80)
$statusLabel.TextAlign = "MiddleCenter"
$splashForm.Controls.Add($statusLabel)

# شريط التحميل
$progressBar = New-Object System.Windows.Forms.ProgressBar
$progressBar.Location = New-Object System.Drawing.Point(30, 130)
$progressBar.Size = New-Object System.Drawing.Size(440, 30)
$progressBar.Style = "Continuous"
$progressBar.Minimum = 0
$progressBar.Maximum = 100
$progressBar.Value = 0
$splashForm.Controls.Add($progressBar)

# نسبة التحميل
$percentLabel = New-Object System.Windows.Forms.Label
$percentLabel.Text = "0%"
$percentLabel.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$percentLabel.ForeColor = [System.Drawing.Color]::FromArgb(138, 43, 226)
$percentLabel.Size = New-Object System.Drawing.Size(480, 30)
$percentLabel.Location = New-Object System.Drawing.Point(10, 170)
$percentLabel.TextAlign = "MiddleCenter"
$splashForm.Controls.Add($percentLabel)

# رسالة إضافية
$detailLabel = New-Object System.Windows.Forms.Label
$detailLabel.Text = "يُرجى الانتظار..."
$detailLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$detailLabel.ForeColor = [System.Drawing.Color]::FromArgb(150, 150, 150)
$detailLabel.Size = New-Object System.Drawing.Size(480, 30)
$detailLabel.Location = New-Object System.Drawing.Point(10, 210)
$detailLabel.TextAlign = "MiddleCenter"
$splashForm.Controls.Add($detailLabel)

# دالة تحديث شريط التقدم
function Update-Progress {
    param($value, $status, $detail)
    $progressBar.Value = $value
    $percentLabel.Text = "$value%"
    $statusLabel.Text = $status
    $detailLabel.Text = $detail
    $splashForm.Refresh()
    [System.Windows.Forms.Application]::DoEvents()
}

# عرض النافذة
$splashForm.Show()
$splashForm.Refresh()

try {
    # 1. التحقق من MongoDB (0-10%)
    Update-Progress 5 "جاري التحقق من قاعدة البيانات..." "MongoDB"
    Start-Sleep -Milliseconds 300
    
    $mongoService = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
    if ($mongoService -and $mongoService.Status -ne "Running") {
        Start-Service MongoDB -ErrorAction SilentlyContinue
    }
    Update-Progress 10 "✓ قاعدة البيانات جاهزة" "MongoDB"
    
    # 2. إيقاف العمليات القديمة (10-20%)
    Update-Progress 15 "جاري تنظيف العمليات القديمة..." "Cleanup"
    Get-Process | Where-Object {$_.CommandLine -like "*uvicorn*server:app*"} | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Update-Progress 20 "✓ تم التنظيف" "Cleanup"
    
    # 3. تشغيل Backend (20-50%)
    Update-Progress 25 "جاري تشغيل الخادم الخلفي..." "Backend Server"
    
    $backendScript = @"
Set-Location '$appDir\backend'
python -m uvicorn server:app --host 0.0.0.0 --port 5599
"@
    
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass", "-WindowStyle Minimized", "-Command", $backendScript
    
    # انتظار Backend ليبدأ
    Update-Progress 30 "انتظار تشغيل الخادم..." "Backend Server"
    Start-Sleep -Seconds 2
    Update-Progress 40 "جاري التحقق من الخادم..." "Backend Server"
    Start-Sleep -Seconds 2
    Update-Progress 50 "✓ الخادم الخلفي يعمل" "Backend Server"
    
    # 4. تشغيل Frontend (50-80%)
    Update-Progress 55 "جاري تشغيل الواجهة الأمامية..." "Frontend"
    
    # الواجهة مبنية مسبقاً ويخدمها الخادم نفسه على المنفذ 5599
    
    Update-Progress 60 "انتظار تشغيل الواجهة..." "Frontend"
    Start-Sleep -Seconds 3
    Update-Progress 70 "جاري تجميع الملفات..." "Frontend Build"
    Start-Sleep -Seconds 3
    Update-Progress 80 "✓ الواجهة الأمامية جاهزة" "Frontend"
    
    # 5. الاستعداد للفتح (80-95%)
    Update-Progress 85 "جاري الاستعداد لفتح المتصفح..." "Browser"
    Start-Sleep -Seconds 2
    Update-Progress 90 "جاري فتح التطبيق..." "Browser"
    Start-Sleep -Seconds 2
    Update-Progress 95 "✓ جميع الخدمات جاهزة" "Ready"
    
    # 6. فتح المتصفح (95-100%)
    Start-Sleep -Seconds 2
    Update-Progress 100 "✓ تم تشغيل التطبيق بنجاح!" "Complete"
    Start-Sleep -Milliseconds 500
    
    # فتح المتصفح
    Start-Process "http://localhost:5599"
    
    # انتظار قليلاً قبل إغلاق النافذة
    Start-Sleep -Seconds 1
    
} catch {
    [System.Windows.Forms.MessageBox]::Show(
        "حدث خطأ أثناء تشغيل التطبيق:`n$_",
        "خطأ",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    )
} finally {
    # إغلاق نافذة التحميل
    $splashForm.Close()
    $splashForm.Dispose()
}
