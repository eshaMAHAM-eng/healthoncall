@echo off
cd /d "%~dp0"
echo.
echo  HealthOnCall local server
echo  Open in browser:  http://127.0.0.1:5500/index.html
echo  Press Ctrl+C to stop.
echo.
python -m http.server 5500
pause
