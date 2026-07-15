#!/usr/bin/env bash
# Build the SAMBADA binaries for macOS and place them in ../bin/macos/.
# Requires: Homebrew GCC (brew install gcc) and CMake (brew install cmake).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"   # repository root (where CMakeLists.txt lives)

echo "Repository root: $ROOT"
command -v cmake >/dev/null 2>&1 || { echo "CMake not found. Install it: brew install cmake"; exit 1; }

GXX="$(ls /opt/homebrew/bin/g++-* /usr/local/bin/g++-* 2>/dev/null | sort -V | tail -1)"
if [ -z "$GXX" ]; then
  echo "GCC not found. Install it: brew install gcc"
  echo "(Apple's Clang compiler is not suitable for the Scythe library.)"
  exit 1
fi
GCC="${GXX/g++/gcc}"
echo "Compiler: $GXX"

cd "$ROOT"
rm -rf build-gui && mkdir build-gui && cd build-gui
cmake .. -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_COMPILER="$GCC" -DCMAKE_CXX_COMPILER="$GXX" \
  -DCMAKE_EXE_LINKER_FLAGS="-static-libstdc++ -static-libgcc"
cmake --build . -j4 --target sambada supervision recode-plink recode-plink-lfmm

mkdir -p "$HERE/../bin/macos"
cp binaries/sambada binaries/supervision binaries/recode-plink binaries/recode-plink-lfmm "$HERE/../bin/macos/"
chmod +x "$HERE/../bin/macos/"*
echo ""
echo "OK! Binaries copied to sambada-gui/bin/macos/"
