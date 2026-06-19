@echo off
REM Produit l'executable Windows autonome : sambada-gui\dist\SambadaStudio.exe
REM (executable unique, aucune dependance Python pour l'utilisateur final)
REM Prerequis : MinGW-w64 (g++) + CMake dans le PATH, et Python 3 (py / python).
setlocal
set HERE=%~dp0
pushd "%HERE%\.."
set GUI=%CD%

echo ==^> 1/4  Compilation des binaires SAMBADA (si necessaire)
if not exist "%GUI%\bin\windows\sambada.exe" (
  call "%GUI%\build\build-windows.bat"
)

echo ==^> 2/4  Environnement Python + PyInstaller
where py >nul 2>nul && (set PY=py) || (set PY=python)
if not exist .venv ( %PY% -m venv .venv )
call .venv\Scripts\activate.bat
python -m pip install --quiet --upgrade pip
python -m pip install --quiet pyinstaller pywebview

echo ==^> 3/4  Empaquetage (PyInstaller)
pyinstaller --noconfirm --clean --distpath dist --workpath build\pyi packaging\SambadaStudio.spec
if errorlevel 1 ( echo Echec PyInstaller & popd & pause & exit /b 1 )

echo ==^> 4/4  Archive telechargeable
cd dist
powershell -Command "Compress-Archive -Force -Path 'SambadaStudio.exe' -DestinationPath 'SAMBADA-Studio-Windows.zip'"
echo.
echo OK -^> sambada-gui\dist\SAMBADA-Studio-Windows.zip
popd
pause
