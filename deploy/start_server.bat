@echo off
REM ============================================================
REM   Electronic Archive — Start Server (FULLY silent)
REM   FIXED: detects port (not just process name) so it works
REM   even if another pythonw is running for a different app.
REM ============================================================
chcp 65001 >nul 2>&1
set "APP_DIR=%~dp0"
set "PORT=5599"

REM Robust check: is the port actually responding?
REM We use PowerShell because netstat output varies by Windows version.
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:%PORT%/api/health' -TimeoutSec 2 -UseBasicParsing).StatusCode } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo Server already running on http://localhost:%PORT%
    start http://localhost:%PORT%
    timeout /t 2 >nul 2>&1
    exit /b 0
)

REM Not running. Launch silent runner via wscript (no console window).
if exist "%APP_DIR%run_silent.vbs" (
    start "" wscript "%APP_DIR%run_silent.vbs"
) else (
    REM Fallback: launch health_loop directly hidden via start /MIN.
    start "" /MIN cmd /c "%APP_DIR%health_loop.bat"
)

echo.
echo ============================================================
echo  Starting Electronic Archive server silently ...
echo  URL: http://localhost:%PORT%
echo  Login: admin / admin123
echo ============================================================
echo.

REM Wait up to 30s for it to come up, then open the browser.
set /a tries=0
:wait
set /a tries+=1
timeout /t 1 >nul 2>&1
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:%PORT%/api/health' -TimeoutSec 1 -UseBasicParsing).StatusCode } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo Server is UP.
    start http://localhost:%PORT%
    timeout /t 2 >nul 2>&1
    exit /b 0
)
if %tries% lss 30 goto wait

echo.
echo [WARN] Server did not respond on port %PORT% within 30 seconds.
echo Check MongoDB is running, then re-run this file.
echo.
timeout /t 5 >nul 2>&1
