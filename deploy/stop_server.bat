@echo off
REM ============================================================
REM   Electronic Archive — Stop Server
REM   Kills the silent uvicorn process gracefully.
REM ============================================================
chcp 65001 >nul 2>&1
echo.
echo Stopping Electronic Archive server ...
taskkill /F /IM pythonw.exe /T >nul 2>&1
taskkill /F /IM wscript.exe /FI "WINDOWTITLE eq run_silent*" /T >nul 2>&1
echo.
echo [OK] Server stopped.
echo To restart, run start_server.bat
echo.
timeout /t 3 >nul 2>&1
