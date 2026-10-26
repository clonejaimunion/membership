@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM   Electronic Archive - Diagnose LAN (network) access
REM ============================================================

set "SCRIPT_DIR=%~dp0"
set "PY=%SCRIPT_DIR%diagnose_lan.py"

echo.
echo ============================================================
echo   Electronic Archive - LAN Access Diagnostic
echo ============================================================
echo.

if not exist "%PY%" (
    echo [ERROR] diagnose_lan.py was not found.
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

%PYCMD% "%PY%"

echo.
echo Press any key to exit ...
pause >nul
