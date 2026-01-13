@echo off
title Telephasma Launcher
echo ============================================
echo        TELEPHASMA - Setup and Launch
echo ============================================
echo.

:: Backend setup
echo [1/4] Creating Python virtual environment...
cd /d "%~dp0backend"
if not exist ".venv" (
    python -m venv .venv
    if errorlevel 1 (
        echo ERROR: Could not create Python venv!
        echo Make sure Python 3.10+ is installed.
        pause
        exit /b 1
    )
)
echo      Virtual environment ready!

echo.
echo [2/4] Installing backend dependencies...
call .venv\Scripts\activate.bat
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo ERROR: pip install failed!
    pause
    exit /b 1
)
echo      Dependencies installed!

:: Frontend setup
echo.
echo [3/4] Installing frontend dependencies...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed!
        echo Make sure Node.js 18+ is installed.
        pause
        exit /b 1
    )
)
echo      Frontend ready!

:: Start the application
echo.
echo [4/4] Starting application...
echo.
echo ============================================
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo ============================================
echo.
echo Close this window to stop the servers.
echo.

:: Start backend in new window
cd /d "%~dp0backend"
start "Telephasma Backend" cmd /k "call .venv\Scripts\activate.bat && python main.py"

:: Wait 2 seconds
timeout /t 2 /nobreak > nul

:: Start frontend in new window
cd /d "%~dp0frontend"
start "Telephasma Frontend" cmd /k "npm run dev"

:: Wait 3 seconds and open browser
timeout /t 3 /nobreak > nul
start "" http://localhost:5173

echo.
echo Browser opened! You can now use the application.
echo You can close this window.
pause
