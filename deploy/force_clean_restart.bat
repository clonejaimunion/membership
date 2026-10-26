@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM   Electronic Archive - Force Clean Restart
REM   Kills ALL Python/wscript processes on this machine, frees
REM   port 5599, and starts a single fresh instance.
REM   Use this when "two servers" are running by accident.
REM ============================================================

set "SCRIPT_DIR=%~dp0"
set "APP_DIR=%SCRIPT_DIR%..\"
set "PORT=5599"

echo.
echo ============================================================
echo   Electronic Archive - Force Clean Restart
echo ============================================================
echo.

echo Step 1: Killing all python.exe / pythonw.exe / wscript.exe ...
taskkill /F /IM pythonw.exe /T  >nul 2>&1
taskkill /F /IM python.exe  /T  >nul 2>&1
taskkill /F /IM wscript.exe /T  >nul 2>&1
echo   Done.
echo.

echo Step 2: Waiting 3 seconds for ports to release ...
timeout /t 3 /nobreak >nul

echo.
echo Step 3: Checking port %PORT% is free ...
netstat -ano -p TCP | findstr ":%PORT% " | findstr "LISTENING" >nul
if errorlevel 1 (
    echo   [OK] Port %PORT% is free.
) else (
    echo   [WARN] Port %PORT% is STILL in use by:
    netstat -ano -p TCP | findstr ":%PORT% " | findstr "LISTENING"
    echo.
    echo   Trying to kill the PID using the port ...
    for /f "tokens=5" %%P in ('netstat -ano -p TCP ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
        echo     killing PID %%P
        taskkill /F /PID %%P /T >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)

echo.
echo Step 4: Starting fresh server (silent, in background) ...
if exist "%APP_DIR%run_silent.vbs" (
    start "" wscript "%APP_DIR%run_silent.vbs"
) else if exist "%SCRIPT_DIR%..\run_silent.vbs" (
    start "" wscript "%SCRIPT_DIR%..\run_silent.vbs"
) else (
    echo   [ERROR] run_silent.vbs not found.
    echo   Looked in:
    echo     %APP_DIR%run_silent.vbs
    pause
    exit /b 1
)

echo   Waiting up to 30 seconds for the API to come up ...
set /a tries=0
:wait_loop
set /a tries+=1
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:%PORT%/api/health' -TimeoutSec 1 -UseBasicParsing).StatusCode } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo.
    echo   [OK] Server is UP and healthy.
    goto verify
)
if %tries% lss 30 goto wait_loop

echo.
echo   [WARN] Server did not respond after 30 seconds.
echo          Check %APP_DIR%server.log for errors.
pause
exit /b 2

:verify
echo.
echo ============================================================
echo Step 5: Verifying API works on every interface ...
echo ============================================================
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    for /f "tokens=* delims= " %%b in ("%%a") do (
        set "ip=%%b"
        powershell -NoProfile -Command "try { $r=(Invoke-WebRequest -Uri 'http://!ip!:%PORT%/api/health' -TimeoutSec 2 -UseBasicParsing); Write-Host '  [OK]   http://!ip!:%PORT%  ->  '$r.StatusCode } catch { Write-Host '  [FAIL] http://!ip!:%PORT%  ->  '$_.Exception.Message }"
    )
)

echo.
echo ============================================================
echo   Restart complete.
echo ============================================================
echo.
echo To open on the SAME PC:    http://localhost:%PORT%
echo To open on OTHER devices:  use the [OK] URL shown above.
echo.
echo IMPORTANT on the other device:
echo   Press Ctrl + Shift + R in the browser to clear cached old JS.
echo.
pause
