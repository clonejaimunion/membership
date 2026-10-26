@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM   Electronic Archive - Restore Data from Cloud to Local
REM ============================================================

set "SCRIPT_DIR=%~dp0"
set "PY=%SCRIPT_DIR%restore_data.py"

echo.
echo ============================================================
echo   Electronic Archive - Cloud to Local Data Restore
echo ============================================================
echo.
echo This will download ALL your data from the cloud backend
echo and load it into your LOCAL MongoDB database.
echo.

if not exist "%PY%" (
    echo [ERROR] restore_data.py was not found.
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
echo Press any key to exit ...
pause >nul
