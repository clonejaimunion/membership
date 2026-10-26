@echo off
REM ============================================================
REM   Register Electronic Archive as Windows Scheduled Task
REM   Runs silently in background at every Windows startup.
REM ============================================================
chcp 65001 >nul 2>&1
setlocal

set "APP_DIR=%~dp0"
set "VBS=%APP_DIR%run_silent.vbs"

echo.
echo ============================================================
echo   Registering Electronic Archive auto-start (silent)
echo ============================================================
echo.

REM Delete any existing entry first so re-registration is idempotent.
schtasks /Delete /F /TN "ElectronicArchiveServer" >nul 2>&1

REM ONSTART + DELAY 30s so MongoDB has time to come up first.
schtasks /Create /F /SC ONSTART /DELAY 0000:30 /RL HIGHEST ^
    /TN "ElectronicArchiveServer" ^
    /TR "wscript \"%VBS%\""

if errorlevel 1 (
    echo.
    echo [ERROR] Registration failed. Run this file As Administrator.
    pause
    exit /b 1
)

echo.
echo [OK] Auto-start registered successfully.
echo The server will launch silently 30s after every Windows boot.
echo.
echo To remove the auto-start later, run:
echo   schtasks /Delete /F /TN ElectronicArchiveServer
echo.
pause
