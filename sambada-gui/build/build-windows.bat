@echo off
REM Build the SAMBADA binaries for Windows and place them in ..\bin\windows\.
REM Requires: MinGW-w64 (g++) and CMake in the PATH.
REM Recommended: install MSYS2 (https://www.msys2.org) then, in an MSYS2 MinGW64 shell:
REM   pacman -S mingw-w64-x86_64-gcc mingw-w64-x86_64-cmake
setlocal
set HERE=%~dp0
pushd "%HERE%\..\.."
set ROOT=%CD%
echo Repository root: %ROOT%

where cmake >nul 2>nul || (echo CMake not found in PATH. & popd & pause & exit /b 1)
where g++   >nul 2>nul || (echo g++ ^(MinGW-w64^) not found in PATH. & popd & pause & exit /b 1)

if exist build-gui rmdir /s /q build-gui
mkdir build-gui & cd build-gui

cmake .. -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release ^
  -DCMAKE_EXE_LINKER_FLAGS="-static -static-libstdc++ -static-libgcc"
if errorlevel 1 (echo CMake configuration failed. & popd & pause & exit /b 1)

cmake --build . -j 4 --target sambada supervision recode-plink recode-plink-lfmm
if errorlevel 1 (echo Build failed. & popd & pause & exit /b 1)

if not exist "%HERE%..\bin\windows" mkdir "%HERE%..\bin\windows"
copy /Y binaries\sambada.exe            "%HERE%..\bin\windows\"
copy /Y binaries\supervision.exe        "%HERE%..\bin\windows\"
copy /Y binaries\recode-plink.exe       "%HERE%..\bin\windows\"
copy /Y binaries\recode-plink-lfmm.exe  "%HERE%..\bin\windows\"

echo.
echo OK! Binaries copied to sambada-gui\bin\windows\
popd
pause
