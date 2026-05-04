@echo off
setlocal enabledelayedexpansion
title Project Tracker

echo.
echo   Project Tracker -- starting locally
echo   ------------------------------------
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo         Download it from https://nodejs.org (version 20 or later required)
    pause
    exit /b 1
)

:: Check Node.js major version (requires 20+ for better-sqlite3)
for /f "tokens=*" %%v in ('node -e "process.stdout.write(process.versions.node.split('.')[0])"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
    echo [ERROR] Node.js 20 or later is required.
    echo         You have Node.js %NODE_MAJOR%.x. Download the latest LTS from https://nodejs.org
    pause
    exit /b 1
)

:: Check pnpm
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] pnpm not found -- installing via npm...
    npm install -g pnpm
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install pnpm. Please install it manually: npm install -g pnpm
        pause
        exit /b 1
    )
)

:: Copy .env if it doesn't exist
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo [INFO] Created .env from .env.example
    echo        Edit .env and add your OPENAI_API_KEY to enable AI features
    echo.
)

:: Load .env (skip comment lines starting with #)
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    set "line=%%A"
    if not "!line:~0,1!"=="#" (
        if not "%%B"=="" set "%%A=%%B"
    )
)

:: Set default ports
if "%API_PORT%"=="" set API_PORT=8080
if "%PORT%"=="" set PORT=3000

echo   Installing dependencies...
call pnpm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo.

:: Push the SQLite schema (creates/updates local.db table structure)
if "%DATABASE_URL%"=="" (
    echo   Syncing local SQLite schema...
    call pnpm --filter @workspace/db db:push:local --accept-warnings >nul 2>&1
    echo.
)

:: Start API server in a new window.
:: We call "pnpm run build" then "pnpm run start" directly so we avoid the
:: POSIX-only "export" in the "dev" script.
echo   Starting API server  --^>  http://localhost:%API_PORT%
start "API Server" cmd /c "cd artifacts\api-server && set NODE_ENV=development&& set PORT=%API_PORT%&& pnpm run build && pnpm run start 2>&1 | tee %TEMP%\api-server.log"

:: Wait for API to be ready (max 30 attempts, 2 seconds each)
echo   Waiting for API server...
set /a ATTEMPTS=0
:wait_api
set /a ATTEMPTS+=1
if %ATTEMPTS% GTR 30 (
    echo [ERROR] API server did not start within 60 seconds.
    echo         Check the log: %TEMP%\api-server.log
    pause
    exit /b 1
)
timeout /t 2 /nobreak >nul
curl -sf "http://localhost:%API_PORT%/api/healthz" >nul 2>&1
if %errorlevel% neq 0 goto wait_api

:: Start web app
echo   Starting web app      --^>  http://localhost:%PORT%
start "Web App" cmd /c "cd artifacts\project-tracker && set NODE_ENV=development&& set PORT=%PORT%&& set BASE_PATH=/&& set API_PORT=%API_PORT%&& pnpm run dev 2>&1 | tee %TEMP%\web.log"

timeout /t 3 /nobreak >nul
start "" "http://localhost:%PORT%"

echo.
echo   Project Tracker is running!
echo   Web app:    http://localhost:%PORT%
echo   API server: http://localhost:%API_PORT%
echo.
echo   API logs:  %TEMP%\api-server.log
echo   Web logs:  %TEMP%\web.log
echo.
echo   Close the API Server and Web App windows to stop all servers.
echo   Press any key to dismiss this window.
echo.
pause
