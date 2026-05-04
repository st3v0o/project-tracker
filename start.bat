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
    echo         Download it from https://nodejs.org (version 18 or later required)
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

:: Load .env
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

echo   Starting API server  --^>  http://localhost:%API_PORT%
start "API Server" cmd /c "cd artifacts\api-server && set PORT=%API_PORT%&& set NODE_ENV=development && pnpm dev > %TEMP%\api-server.log 2>&1"

echo   Waiting for API server...
:wait_api
timeout /t 2 /nobreak >nul
curl -sf "http://localhost:%API_PORT%/api/health" >nul 2>&1
if %errorlevel% neq 0 goto wait_api

echo   Starting web app      --^>  http://localhost:%PORT%
start "Web App" cmd /c "cd artifacts\project-tracker && set PORT=%PORT%&& set BASE_PATH=/&& set API_PORT=%API_PORT%&& set NODE_ENV=development && pnpm dev > %TEMP%\web.log 2>&1"

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
echo   Close this window or press Ctrl+C to stop all servers.
echo.
pause
