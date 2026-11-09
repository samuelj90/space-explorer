@echo off
set PORT=%1
if "%PORT%"=="" set PORT=3888

echo Starting Space Explorer on http://127.0.0.1:%PORT% ...
start "" "http://127.0.0.1:%PORT%"
python "%~dp0server\app.py" %PORT%
