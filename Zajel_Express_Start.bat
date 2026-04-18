@echo off
:: Zajel Express Admin - One-Click Launcher
:: Optimized for Windows 7, 10, and 11 (32/64 bit)

title Zajel Express Admin Launcher
color 0A
cls

echo ====================================================
echo        Zajel Express Admin - Startup System
echo ====================================================
echo.

:: 1. Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is NOT installed!
    echo Please install Node.js from: https://nodejs.org/
    echo.
    echo Press any key to open the download page...
    pause >nul
    start https://nodejs.org/
    exit
)

:: 2. Check for .env file
if not exist .env (
    if exist .env.example (
        echo [INFO] Creating .env file from template...
        copy .env.example .env
        echo [WARNING] Please edit the .env file and add your Supabase keys!
    ) else (
        color 0C
        echo [ERROR] .env file is missing and .env.example not found!
        pause
        exit
    )
)

:: 3. Install dependencies if node_modules is missing
if not exist node_modules (
    echo [1/3] Installing dependencies (First time only)...
    echo This may take a few minutes depending on your internet speed...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Installation failed! Check your internet connection.
        pause
        exit
    )
) else (
    echo [1/3] Dependencies already installed.
)

:: 4. Open Browser
echo [2/3] Opening your browser...
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

:: 5. Start the Application
echo [3/3] Starting the server...
echo ----------------------------------------------------
echo  KEEP THIS WINDOW OPEN WHILE USING THE APP
echo  To stop the app, close this window or press Ctrl+C
echo ----------------------------------------------------
echo.

call npm run dev

pause
