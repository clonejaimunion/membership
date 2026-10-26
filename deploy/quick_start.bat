@echo off
title Electronic Archive - Quick Start
setlocal enableextensions

REM ============================================================
REM   Electronic Archive - QUICK START (frontend pre-built)
REM   No Node.js, no npm. Just Python + MongoDB.
REM ============================================================

cls
echo.
echo ============================================================
echo  Electronic Archive  -  Quick Start  (v3)
echo ============================================================
echo.
echo  If you can SEE this, the script is running fine.
echo  Press any key to start ...
pause

set "SERVER_URL=__SERVER_URL__"
set "INSTALL_DIR=%LOCALAPPDATA%\ElectronicArchive"
set "ZIP_PATH=%TEMP%\EA.zip"
set "PORT=5599"

echo.
echo  Install dir: %INSTALL_DIR%
echo  Port: %PORT%
echo.

REM 1. Stop old server
echo [1/5] Stopping old server (if any) ...
taskkill /F /IM pythonw.exe /T >nul 2>&1
taskkill /F /IM python.exe /FI "WINDOWTITLE eq Electronic Archive*" /T >nul 2>&1
echo [OK]

REM 2. Download ZIP (includes pre-built frontend)
echo.
echo [2/5] Downloading latest version ...
curl -L -o "%ZIP_PATH%" "%SERVER_URL%/api/installer/download"
if errorlevel 1 (
    echo [ERROR] Download failed. Check internet.
    pause
    exit /b 1
)
echo [OK]

REM 3. Extract (preserves backend/storage and .env)
echo.
echo [3/5] Extracting files ...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if exist "%INSTALL_DIR%\deploy\backup_data.py" (
    echo  - Full data backup before update ...
    python -m pip install --quiet pymongo >nul 2>&1
    python "%INSTALL_DIR%\deploy\backup_data.py" "%INSTALL_DIR%"
    if errorlevel 1 (
        echo [ERROR] Backup failed - update stopped, nothing was changed. Start MongoDB and retry.
        pause
        exit /b 1
    )
)
if exist "%INSTALL_DIR%\backend\storage" (
    if exist "%TEMP%\ea_storage_backup" rmdir /S /Q "%TEMP%\ea_storage_backup" >nul 2>&1
    xcopy "%INSTALL_DIR%\backend\storage" "%TEMP%\ea_storage_backup" /E /I /Q /Y >nul
)
if exist "%INSTALL_DIR%\backend\.env" (
    copy /Y "%INSTALL_DIR%\backend\.env" "%TEMP%\ea_env_backup" >nul
)
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP_PATH%' -DestinationPath '%INSTALL_DIR%' -Force"
if errorlevel 1 (
    echo [ERROR] Extract failed.
    pause
    exit /b 1
)
if exist "%TEMP%\ea_storage_backup" (
    xcopy "%TEMP%\ea_storage_backup" "%INSTALL_DIR%\backend\storage" /E /I /Q /Y >nul
    rmdir /S /Q "%TEMP%\ea_storage_backup" >nul 2>&1
)
if exist "%TEMP%\ea_env_backup" (
    copy /Y "%TEMP%\ea_env_backup" "%INSTALL_DIR%\backend\.env" >nul
    del /Q "%TEMP%\ea_env_backup" >nul 2>&1
)
del /Q "%ZIP_PATH%" >nul 2>&1
echo [OK]

REM 4. Install minimal Python libs (no emergentintegrations, no AI libs)
echo.
echo [4/5] Installing minimal Python libraries (3-5 min) ...
cd /d "%INSTALL_DIR%\backend"
python -m pip install --upgrade pip --quiet
python -m pip install -r requirements-local.txt --quiet
if errorlevel 1 (
    echo [WARN] pip install had warnings - trying with --no-cache-dir
    python -m pip install -r requirements-local.txt --no-cache-dir
)

REM Create .env if missing
if not exist .env (
    (echo MONGO_URL=mongodb://localhost:27017& echo DB_NAME=electronic_archive& echo CORS_ORIGINS=http://localhost:5599,http://127.0.0.1:5599) > .env
)
echo [OK]

REM 5. Firewall + Start
echo.
echo [5/5] Opening firewall and starting server ...
netsh advfirewall firewall delete rule name="Electronic Archive Server" >nul 2>&1
netsh advfirewall firewall add rule name="Electronic Archive Server" dir=in action=allow protocol=TCP localport=%PORT% >nul

REM Make sure MongoDB is running
sc query MongoDB >nul 2>&1
if not errorlevel 1 net start MongoDB >nul 2>&1

REM Create silent runner (no CMD window ever)
REM health_loop.bat / run_silent.vbs are already in the ZIP under deploy/.
REM Copy them next to backend/ for easy access.
copy /Y "%INSTALL_DIR%\deploy\health_loop.bat" "%INSTALL_DIR%\health_loop.bat" >nul 2>&1
copy /Y "%INSTALL_DIR%\deploy\run_silent.vbs"  "%INSTALL_DIR%\run_silent.vbs"  >nul 2>&1
copy /Y "%INSTALL_DIR%\deploy\start_server.bat" "%INSTALL_DIR%\start_server.bat" >nul 2>&1
copy /Y "%INSTALL_DIR%\deploy\stop_server.bat"  "%INSTALL_DIR%\stop_server.bat"  >nul 2>&1
copy /Y "%INSTALL_DIR%\deploy\update.bat"       "%INSTALL_DIR%\update.bat"       >nul 2>&1

REM Auto-start: run the silent VBS at every Windows boot (delayed 30s for MongoDB).
schtasks /Delete /F /TN "ElectronicArchiveServer" >nul 2>&1
schtasks /Create /F /SC ONSTART /DELAY 0000:30 /RL HIGHEST /TN "ElectronicArchiveServer" /TR "wscript \"%INSTALL_DIR%\run_silent.vbs\"" >nul 2>&1

REM Desktop shortcut
set "DESKTOP=%USERPROFILE%\Desktop"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%DESKTOP%\Electronic Archive.lnk'); $s.TargetPath='http://localhost:%PORT%'; $s.Save()" >nul 2>&1

REM Start now (silent, hidden window via wscript)
start "" wscript "%INSTALL_DIR%\run_silent.vbs"
timeout /t 4 >nul

echo.
echo ============================================================
echo  [SUCCESS] Server is running.
echo ============================================================
echo.
echo  On THIS computer:        http://localhost:%PORT%
echo  Login:    admin / admin123
echo.
echo  * Auto-starts with Windows
echo  * To update: run this file again
echo  * Desktop shortcut created: "Electronic Archive"
echo.
echo  If the browser shows error, wait 5 sec and refresh.
echo ============================================================
echo.
start http://localhost:%PORT%
pause
