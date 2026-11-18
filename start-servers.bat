@echo off
title CarbonCredit - Launching Servers
set "ROOT_DIR=%~dp0"

echo Starting CarbonCredit Backend (FastAPI on port 8000)...
start "CarbonCredit Backend" cmd /k "cd /d "%ROOT_DIR%backend" && .\.venv\Scripts\uvicorn.exe main:app --reload --port 8000"

echo Starting CarbonCredit Frontend (Next.js on port 3000)...
start "CarbonCredit Frontend" cmd /k "cd /d "%ROOT_DIR%frontend" && npm run dev"

timeout /t 4 /nobreak >nul
start "" "http://localhost:3000"

echo Both servers started! Close the two server windows when you want to stop them.
