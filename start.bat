@echo off
setlocal enabledelayedexpansion
title Project Tracker

echo.
echo   Project Tracker -- starting locally
echo   ------------------------------------
echo.

:: Require Node.js 20+ (better-sqlite3 supports only Node 20, 22, 23, 24, 25)
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo         Download it from https://nodejs.org (version 20 or later required^)
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -e "process.stdout.write(process.versions.node.split('.')[0])"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
    echo [ERROR] Node.js 20 or later is required.
    echo         You have Node.js %NODE_MAJOR%.x. Download the latest LTS from https://nodejs.org
    pause
    exit /b 1
)

:: Install pnpm if missing
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] pnpm not found -- installing via npm...
    npm install -g pnpm
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install pnpm. Run: npm install -g pnpm
        pause
        exit /b 1
    )
)

:: Create .env from template on first run
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo [INFO] Created .env from .env.example
    echo        Add your OPENAI_API_KEY to .env to enable AI features
    echo.
)

:: Load .env (skip lines beginning with #)
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    set "line=%%A"
    if not "!line:~0,1!"=="#" (
        if not "%%B"=="" set "%%A=%%B"
    )
)

:: Apply default ports
if "%API_PORT%"=="" set API_PORT=8080
if "%PORT%"==""     set PORT=3000

set API_LOG=%TEMP%\api-server.log
set WEB_LOG=%TEMP%\web.log

echo   Installing dependencies...
call pnpm install --ignore-scripts
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
:: Run lifecycle scripts for native modules (better-sqlite3 needs its install script)
call pnpm rebuild better-sqlite3
if %errorlevel% neq 0 (
    echo [WARN] better-sqlite3 rebuild failed - SQLite mode may not work.
    echo        Make sure you have Visual Studio Build Tools installed.
)
echo.

:: Start the API server in its own window.
:: Call "pnpm run build" then "pnpm run start" directly — avoids the POSIX-only
:: "export" keyword used in the "dev" npm script.
echo   Starting API server  --^>  http://localhost:%API_PORT%
start "API Server" cmd /c "cd artifacts\api-server && set NODE_ENV=development&& set PORT=%API_PORT%&& pnpm run build 1>%API_LOG% 2>&1 && pnpm run start 1>>%API_LOG% 2>&1"

:: Poll /api/healthz until ready (max 30 attempts × 2 s = 60 s)
echo   Waiting for API server...
set /a ATTEMPTS=0
:wait_api
set /a ATTEMPTS+=1
if %ATTEMPTS% GTR 30 (
    echo [ERROR] API server did not respond within 60 seconds.
    echo         Check the log: %API_LOG%
    pause
    exit /b 1
)
timeout /t 2 /nobreak >nul
curl -sf "http://localhost:%API_PORT%/api/healthz" >nul 2>&1
if %errorlevel% neq 0 goto wait_api

:: Start the web app in its own window
echo   Starting web app      --^>  http://localhost:%PORT%
start "Web App" cmd /c "cd artifacts\project-tracker && set NODE_ENV=development&& set PORT=%PORT%&& set BASE_PATH=/&& set API_PORT=%API_PORT%&& pnpm run dev 1>%WEB_LOG% 2>&1"

:: Poll localhost:PORT until Vite is ready (max 40 attempts x 3 s = 120 s)
:: Vite needs time for dep pre-bundling on first run — do not open browser early.
echo   Waiting for web app...
set /a WEB_ATTEMPTS=0
:wait_web
set /a WEB_ATTEMPTS+=1
if %WEB_ATTEMPTS% GTR 40 (
    echo [ERROR] Web app did not respond within 120 seconds.
    echo         Last lines of web log:
    echo         ----------------------
    more %WEB_LOG%
    pause
    exit /b 1
)
timeout /t 3 /nobreak >nul
curl -sf "http://localhost:%PORT%" >nul 2>&1
if %errorlevel% neq 0 goto wait_web

start "" "http://localhost:%PORT%"

echo.
echo   Project Tracker is running!
echo   Web app:    http://localhost:%PORT%
echo   API server: http://localhost:%API_PORT%
echo.
echo   Logs:
echo     API  --^>  %API_LOG%
echo     Web  --^>  %WEB_LOG%
echo.
echo   Close the API Server and Web App windows to stop all servers.
echo   Press any key to dismiss this window.
echo.
pause
