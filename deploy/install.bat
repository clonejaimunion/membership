@echo off
REM ============================================================
REM   نظام الأرشيف الإلكتروني - مُثبِّت Windows التلقائي
REM   Electronic Archive System - Windows Auto-Installer
REM ============================================================
chcp 65001 >nul
title تثبيت نظام الأرشيف الإلكتروني

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

echo.
echo ============================================================
echo  بدء تثبيت نظام الأرشيف الإلكتروني
echo  Electronic Archive - Auto Installer
echo ============================================================
echo.

REM --------- 1. التأكد من Python ----------
where python >nul 2>&1
if errorlevel 1 (
    echo [1/6] تثبيت Python 3.11 ...
    winget install -e --id Python.Python.3.11 --silent --accept-source-agreements --accept-package-agreements
    if errorlevel 1 (
        echo فشل تثبيت Python. الرجاء تثبيته يدوياً من https://www.python.org/downloads/
        pause & exit /b 1
    )
) else (
    echo [1/6] Python موجود.
)

REM --------- 2. التأكد من Node.js ----------
where node >nul 2>&1
if errorlevel 1 (
    echo [2/6] تثبيت Node.js LTS ...
    winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
) else (
    echo [2/6] Node.js موجود.
)

REM --------- 3. التأكد من MongoDB ----------
where mongod >nul 2>&1
if errorlevel 1 (
    echo [3/6] تثبيت MongoDB Community ...
    winget install -e --id MongoDB.Server --silent --accept-source-agreements --accept-package-agreements
    echo MongoDB يُثبَّت كخدمة وتبدأ تلقائياً مع Windows.
) else (
    echo [3/6] MongoDB موجود.
)

REM --------- 4. تثبيت Tesseract + Poppler (للـ OCR) ----------
where tesseract >nul 2>&1
if errorlevel 1 (
    echo [4/6] تثبيت Tesseract OCR ...
    winget install -e --id UB-Mannheim.TesseractOCR --silent --accept-source-agreements --accept-package-agreements
) else (
    echo [4/6] Tesseract موجود.
)

REM --------- 5. تثبيت اعتمادات الـ backend ----------
echo [5/6] تثبيت مكتبات Python ...
cd /d "%APP_DIR%backend"
python -m pip install --upgrade pip >nul
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo فشل تثبيت مكتبات Python.
    pause & exit /b 1
)

REM --------- 6. بناء الواجهة (Frontend) ----------
echo [6/6] بناء واجهة الويب ...
cd /d "%APP_DIR%frontend"
if not exist node_modules (
    call yarn install
    if errorlevel 1 call npm install
)
REM بناء بدون REACT_APP_BACKEND_URL ليستخدم مسارات نسبية
set "REACT_APP_BACKEND_URL="
call yarn build
if errorlevel 1 call npm run build

echo.
echo ============================================================
echo  ✅ التثبيت اكتمل بنجاح
echo ============================================================
echo.
echo لتشغيل البرنامج: شغّل ملف   start_server.bat
echo للوصول من جهاز آخر في الشبكة افتح المتصفح على:
ipconfig | findstr /R /C:"IPv4"
echo  والرابط:  http://[IP-من-فوق]:5599
echo.
pause
