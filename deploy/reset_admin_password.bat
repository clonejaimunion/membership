@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM   Electronic Archive - Reset Admin Password
REM   Auto-installs pymongo if missing, then runs the reset script.
REM ============================================================

set "SCRIPT_DIR=%~dp0"
set "PY=%SCRIPT_DIR%reset_admin_password.py"

echo.
echo ============================================================
echo   Electronic Archive - Reset Admin Password
echo ============================================================
echo.

if not exist "%PY%" (
    echo [ERROR] reset_admin_password.py was not found.
    pause
    exit /b 1
)

set "PYCMD="
where py >nul 2>&1
if not errorlevel 1 set "PYCMD=py"
if "%PYCMD%"=="" (
    where python >nul 2>&1
    if not errorlevel 1 set "PYCMD=python"
)
if "%PYCMD%"=="" (
    echo [ERROR] Python is not installed or not on PATH.
    pause
    exit /b 1
)

%PYCMD% -c "import pymongo" >nul 2>&1
if errorlevel 1 (
    echo Installing pymongo ...
    %PYCMD% -m pip install --quiet --disable-pip-version-check pymongo
)

%PYCMD% "%PY%"
echo.
pause
