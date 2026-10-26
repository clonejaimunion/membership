@echo off
title Electronic Archive - Starting...
color 0A

echo ========================================
echo   Electronic Archive
echo   تشغيل الارشيف الالكتروني
echo ========================================
echo.

echo [1/3] Checking MongoDB...
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] MongoDB is running
) else (
    echo [!] MongoDB not running - trying to start...
    start "" "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath "C:\data\db"
    timeout /t 3 >nul
)

echo.
echo [2/3] Starting Backend Server...
cd /d "%LOCALAPPDATA%\ElectronicArchive\backend"

tasklist /FI "IMAGENAME eq python.exe" /FI "WINDOWTITLE eq *uvicorn*" 2>NUL | find /I /N "python.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [!] Server already running - stopping it first...
    taskkill /F /IM python.exe /FI "WINDOWTITLE eq *uvicorn*" >nul 2>&1
    timeout /t 2 >nul
)

start "Electronic Archive Backend" /MIN python -m uvicorn server:app --host 0.0.0.0 --port 5599

echo [OK] Backend started
echo.
echo [3/3] Waiting for server...
timeout /t 5 >nul

echo [OK] Opening browser...
start http://localhost:5599

echo.
echo ========================================
echo   Server is running!
echo   الخادم يعمل الآن
echo ========================================
echo.
echo   URL: http://localhost:5599
echo.
echo   Press any key to STOP the server
echo   اضغط اي زر لايقاف الخادم
echo ========================================
pause >nul

echo.
echo Stopping server...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *Electronic Archive Backend*" >nul 2>&1
echo Done!
timeout /t 2 >nul
