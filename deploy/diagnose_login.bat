@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM   Electronic Archive - Diagnose Login Tool
REM   Auto-installs pymongo if missing, then runs the diagnostic.
REM ============================================================

set "SCRIPT_DIR=%~dp0"
set "PY=%SCRIPT_DIR%diagnose_login.py"

echo.
echo ============================================================
echo   Electronic Archive Login Diagnostic Tool
echo ============================================================
echo.

if not exist "%PY%" (
    echo [ERROR] diagnose_login.py was not found at:
    echo         %PY%
    pause
    exit /b 1
)

REM Detect python command
set "PYCMD="
where py >nul 2>&1
if not errorlevel 1 set "PYCMD=py"
if "%PYCMD%"=="" (
    where python >nul 2>&1
    if not errorlevel 1 set "PYCMD=python"
)
if "%PYCMD%"=="" (
    echo [ERROR] Python is not installed or not on PATH.
    echo Install Python 3 from https://python.org and re-run.
    pause
    exit /b 1
)

echo Using Python via: %PYCMD%
echo.

REM Ensure pymongo is installed (silent if already there).
echo Checking pymongo ...
%PYCMD% -c "import pymongo" >nul 2>&1
if errorlevel 1 (
    echo pymongo is missing. Installing it now ...
    %PYCMD% -m pip install --quiet --disable-pip-version-check pymongo
    if errorlevel 1 (
        echo [ERROR] Failed to install pymongo automatically.
        echo Try running this command manually:
        echo         %PYCMD% -m pip install pymongo
        pause
        exit /b 1
    )
    echo [OK] pymongo installed.
) else (
    echo [OK] pymongo is already installed.
)
echo.

%PYCMD% "%PY%"

echo.
echo Press any key to exit ...
pause >nul
