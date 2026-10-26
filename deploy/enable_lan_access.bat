@echo off
setlocal

REM ============================================================
REM   Electronic Archive - Enable LAN Access (Pure ASCII)
REM   Adds Windows Firewall rule for inbound TCP on port 5599.
REM   MUST be run as Administrator.
REM ============================================================

set "PORT=5599"
set "RULE=Electronic Archive Server (LAN)"

echo.
echo ============================================================
echo   Enabling LAN access for Electronic Archive
echo ============================================================
echo.

REM Check admin rights
net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] This file must be run As Administrator.
    echo Right-click the file then choose: Run as administrator
    echo.
    pause
    exit /b 1
)

REM Delete any existing rule for idempotency
netsh advfirewall firewall delete rule name="%RULE%" >nul 2>&1

REM Allow inbound TCP on the chosen port
netsh advfirewall firewall add rule name="%RULE%" dir=in action=allow protocol=TCP localport=%PORT% profile=private,domain

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to add firewall rule.
    pause
    exit /b 1
)

echo.
echo [OK] Firewall rule added successfully.
echo.
echo Other devices on your LAN can now reach the server at:
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    for /f "tokens=* delims= " %%b in ("%%a") do echo    http://%%b:%PORT%
)

echo.
echo Username: admin
echo Password: admin123
echo.
echo To remove this rule later:
echo    netsh advfirewall firewall delete rule name="%RULE%"
echo.
pause
