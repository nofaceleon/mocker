@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   MockHub - Universal Mock Service
echo ========================================

where pnpm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] pnpm not found. Please install: npm install -g pnpm
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call pnpm install
    if errorlevel 1 (
        echo [ERROR] Dependency installation failed.
        pause
        exit /b 1
    )
)

echo [INFO] Starting backend (localhost:3000) + frontend (localhost:5173)
call pnpm dev
if errorlevel 1 (
    pause
)
