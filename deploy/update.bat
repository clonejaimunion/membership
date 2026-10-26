@echo off
REM ============================================================
REM   تحديث نظام الأرشيف الإلكتروني
REM   Update Electronic Archive
REM ============================================================
chcp 65001 >nul
title تحديث نظام الأرشيف

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

echo.
echo ============================================================
echo  بدء تحديث البرنامج
echo ============================================================
echo.

REM --------- 1. إيقاف الخادم القديم ----------
echo [1/4] إيقاف الخادم القديم ...
taskkill /F /IM pythonw.exe /T >nul 2>&1
taskkill /F /IM uvicorn.exe /T >nul 2>&1
timeout /t 2 >nul

REM --------- 2. نسخة احتياطية إلزامية قبل التحديث ----------
echo [2/5] نسخة احتياطية من البيانات ...
python -m pip install --quiet pymongo >nul 2>&1
if exist "%APP_DIR%deploy\backup_data.py" (
    python "%APP_DIR%deploy\backup_data.py" "%APP_DIR%."
) else (
    python "%APP_DIR%backup_data.py" "%APP_DIR%."
)
if errorlevel 1 (
    echo.
    echo  ✗ فشل النسخ الاحتياطي - تم إيقاف التحديث للحفاظ على بياناتك.
    echo    تأكد أن خدمة MongoDB تعمل ثم أعد المحاولة.
    pause
    exit /b 1
)

REM --------- 3. سحب آخر تحديث من git (لو مستخدم git) ----------
REM git pull لا يمس قاعدة البيانات ولا مجلد storage ولا ملفات .env
where git >nul 2>&1
if not errorlevel 1 (
    if exist .git (
        echo [3/5] جلب آخر تحديث من Git ...
        git stash >nul 2>&1
        git pull origin main
        git stash pop >nul 2>&1
    )
)

REM --------- 4. تحديث مكتبات Python ----------
echo [4/5] تحديث مكتبات Python ...
cd /d "%APP_DIR%backend"
python -m pip install --upgrade -r requirements-local.txt

REM --------- 5. إعادة بناء الواجهة ----------
echo [5/5] إعادة بناء واجهة الويب ...
cd /d "%APP_DIR%frontend"
set "REACT_APP_BACKEND_URL="
call yarn install
call yarn build
if errorlevel 1 (
    call npm install
    call npm run build
)

echo.
echo ============================================================
echo  ✅ التحديث اكتمل
echo  لإعادة تشغيل الخادم: شغّل   start_server.bat
echo ============================================================
echo.
pause
