@echo off
REM ============================================================
REM   Electronic Archive — Health-Check Loop (auto-restart)
REM   FIXED: explicit error messages on first failed start so
REM   if something goes wrong it can be diagnosed.
REM   This runs hidden via run_silent.vbs.
REM ============================================================
chcp 65001 >nul 2>&1
setlocal enableextensions

set "APP_DIR=%~dp0"
set "PORT=5599"
set "HOST=0.0.0.0"
set "LOG=%APP_DIR%server.log"

cd /d "%APP_DIR%backend" 2>nul
if errorlevel 1 (
    echo [ERROR] backend folder not found under %APP_DIR% >> "%LOG%"
    exit /b 1
)

if not exist .env (
    > .env echo MONGO_URL=mongodb://localhost:27017
    >> .env echo DB_NAME=electronic_archive
    >> .env echo CORS_ORIGINS=http://localhost:5599,http://127.0.0.1:5599
)

REM Best-effort start MongoDB (service name "MongoDB" on default installs).
sc query MongoDB >nul 2>&1
if not errorlevel 1 net start MongoDB >nul 2>&1

REM Loop forever: launch uvicorn (hidden) and restart if it exits.
:run
echo [%date% %time%] Starting uvicorn on %HOST%:%PORT% >> "%LOG%"
pythonw -m uvicorn server:app --host %HOST% --port %PORT% --workers 1 >> "%LOG%" 2>&1
echo [%date% %time%] uvicorn exited, restarting in 5s >> "%LOG%"
timeout /t 5 /nobreak >nul 2>&1
goto run
