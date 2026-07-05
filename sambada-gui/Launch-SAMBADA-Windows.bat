@echo off
REM Double-click this file to launch SAMBADA Studio on Windows.
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
    py sambada_gui.py
    goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
    python sambada_gui.py
    goto :eof
)

echo ===============================================================
echo  Python 3 was not found.
echo  Install it from https://www.python.org/downloads/
echo  (tick "Add Python to PATH" during installation),
echo  then run this file again.
echo ===============================================================
pause
