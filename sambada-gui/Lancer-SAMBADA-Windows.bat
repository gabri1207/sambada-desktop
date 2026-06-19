@echo off
REM Double-cliquez ce fichier pour lancer SAMBADA Studio sur Windows.
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
echo  Python 3 est introuvable.
echo  Installez-le depuis https://www.python.org/downloads/
echo  (cochez "Add Python to PATH" pendant l'installation),
echo  puis relancez ce fichier.
echo ===============================================================
pause
