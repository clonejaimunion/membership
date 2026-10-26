@echo off
REM ============================================================
REM   فتح منفذ 5599 في جدار حماية Windows (مطلوب للشبكة المحلية)
REM   Open port 5599 in Windows Firewall (for LAN access)
REM ============================================================
chcp 65001 >nul

echo فتح المنفذ 5599 في جدار حماية Windows ...

netsh advfirewall firewall add rule name="Electronic Archive Server" ^
    dir=in action=allow protocol=TCP localport=5599

if errorlevel 1 (
    echo ⚠️ فشل! شغّل هذا الملف كمسؤول (Run as Administrator).
    pause & exit /b 1
)

echo ✅ المنفذ 5599 مفتوح. الأجهزة الأخرى في الشبكة يمكنها الوصول الآن.
echo.
pause
