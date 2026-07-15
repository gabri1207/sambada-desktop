#!/usr/bin/env bash
# Build the SAMBADA binaries for Linux and place them in ../bin/linux/.
# Requires: g++ (GCC) and cmake.  E.g. Debian/Ubuntu: sudo apt install build-essential cmake
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

echo "Repository root: $ROOT"
command -v cmake >/dev/null 2>&1 || { echo "CMake not found. Install it (sudo apt install cmake)."; exit 1; }

CC="${CC:-gcc}"
CXX="${CXX:-g++}"
command -v "$CXX" >/dev/null 2>&1 || { echo "g++ not found (sudo apt install build-essential)."; exit 1; }
echo "Compiler: $CXX"

cd "$ROOT"
rm -rf build-gui && mkdir build-gui && cd build-gui
cmake .. -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_COMPILER="$CC" -DCMAKE_CXX_COMPILER="$CXX" \
  -DCMAKE_EXE_LINKER_FLAGS="-static-libstdc++ -static-libgcc"
cmake --build . -j4 --target sambada supervision recode-plink recode-plink-lfmm

mkdir -p "$HERE/../bin/linux"
cp binaries/sambada binaries/supervision binaries/recode-plink binaries/recode-plink-lfmm "$HERE/../bin/linux/"
chmod +x "$HERE/../bin/linux/"*
echo ""
echo "OK! Binaries copied to sambada-gui/bin/linux/"
