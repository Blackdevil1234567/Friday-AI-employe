@echo off
title FRIDAY AI Employee Launcher
echo ===================================================
echo             FRIDAY AI EMPLOYEE COCKPIT
echo ===================================================
echo.
echo [INFO] Checking environment dependencies...
echo.

:: Check workspace root node_modules
if not exist node_modules (
    echo [INFO] Root node_modules not found. Installing...
    call npm install --legacy-peer-deps
) else (
    echo [OK] Root dependencies present.
)

:: Check backend node_modules
if not exist backend\node_modules (
    echo [INFO] Backend node_modules not found. Installing...
    call npm install --prefix backend --legacy-peer-deps
) else (
    echo [OK] Backend dependencies present.
)

:: Check frontend node_modules
if not exist frontend\node_modules (
    echo [INFO] Frontend node_modules not found. Installing...
    call npm install --prefix frontend --legacy-peer-deps
) else (
    echo [OK] Frontend dependencies present.
)

echo.
echo ===================================================
echo [OK] All dependencies checked. Starting cockpit engine...
echo      Backend service: http://localhost:5000
echo      Frontend interface: http://localhost:5173 (usually)
echo ===================================================
echo.

:: Free port 5000 if previously occupied by background Node process
powershell -Command "Get-Process -Id (Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force" >nul 2>&1

:: Start concurrent dev server
call npm run dev
