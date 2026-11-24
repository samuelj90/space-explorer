@echo off
call npm --prefix "%~dp0" run build:ui
if errorlevel 1 exit /b %errorlevel%
set PORT=%1
if "%PORT%"=="" set PORT=3888

echo Starting Space Explorer on http://127.0.0.1:%PORT% ...
start "" "http://127.0.0.1:%PORT%"
python "%~dp0server\app.py" %PORT%
