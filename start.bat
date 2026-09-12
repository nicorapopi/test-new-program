@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or newer is required. Install Node.js, then run this file again.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4317 in your browser after the server starts.
node server.js
pause
