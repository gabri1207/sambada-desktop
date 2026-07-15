@echo off
REM Produces the standalone Windows executable: sambada-gui\dist\SambadaStudio.exe
REM (single executable; no Python dependency for the end user)
REM Requirements: MinGW-w64 (g++) + CMake in the PATH, and Python 3 (py / python).
setlocal
set HERE=%~dp0
pushd "%HERE%\.."
set GUI=%CD%

echo ==^> 1/4  Building the SAMBADA binaries (if needed)
if not exist "%GUI%\bin\windows\sambada.exe" (
  call "%GUI%\build\build-windows.bat"
)

echo ==^> 2/4  Python environment + PyInstaller
where py >nul 2>nul && (set PY=py) || (set PY=python)
if not exist .venv ( %PY% -m venv .venv )
call .venv\Scripts\activate.bat
python -m pip install --quiet --upgrade pip
python -m pip install --quiet pyinstaller pywebview

echo ==^> 3/4  Packaging (PyInstaller)
pyinstaller --noconfirm --clean --distpath dist --workpath build\pyi packaging\SambadaStudio.spec
if errorlevel 1 ( echo PyInstaller failed & popd & pause & exit /b 1 )

echo ==^> 4/4  Downloadable archive
cd dist
powershell -Command "Compress-Archive -Force -Path 'SambadaStudio.exe' -DestinationPath 'SAMBADA-Studio-Windows.zip'"
echo.
echo OK -^> sambada-gui\dist\SAMBADA-Studio-Windows.zip
popd
pause
