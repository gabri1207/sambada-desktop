# SAMBADA Desktop — repository guide

This repo contains **SAMBADA** (the C/C++ landscape-genomics engine, EPFL/LaSIG)
plus **SAMBADA Studio**, a local graphical interface for it, under `sambada-gui/`.

> **Golden rule:** never change SAMBADA's scientific behaviour. Everything in
> `sambada-gui/` is a thin overlay (it only builds the parameter file and calls
> the official binaries). The single source change ever made to the engine is a
> portability fix (`finite(x)` → `std::isfinite(x)` in `ext/scythestat-1.0.3/`),
> which is behaviour-identical.

---

## Building the Windows executable (main task on a Windows PC)

The goal is to produce **`sambada-gui/dist/SAMBADA-Studio-Windows.zip`**, containing
a single `SambadaStudio.exe` with no dependency for the end user.

### Option A — let GitHub Actions build it (no local toolchain needed)
This repo has a workflow that builds all three OSes on GitHub's servers:
- Go to the repo's **Actions** tab → **"SAMBADA Studio — downloadable executables"** → **Run workflow**, or
- push a tag `studio-vX.Y` (e.g. `git tag studio-v1.0 && git push origin studio-v1.0`)
  to also create a **Release** with the ready-to-download `.zip`.

The Windows artifact appears under the run's **Artifacts** (or on the Release page).

### Option B — build locally on Windows
**Prerequisites (install once):**
1. **MSYS2** — https://www.msys2.org — then, in an *MSYS2 MinGW64* shell:
   ```bash
   pacman -S mingw-w64-x86_64-gcc mingw-w64-x86_64-cmake mingw-w64-x86_64-ninja
   ```
   Make sure `C:\msys64\mingw64\bin` is on the Windows `PATH` (so `g++` and `cmake` resolve).
2. **Python 3.11 or 3.12** — https://www.python.org/downloads/ (tick *Add Python to PATH*).

**Build (one command, from a normal Windows `cmd`/PowerShell at the repo root):**
```bat
sambada-gui\packaging\package-windows.bat
```
This script: (1) compiles the SAMBADA binaries with MinGW into `sambada-gui\bin\windows\`,
(2) creates a Python venv and installs PyInstaller + pywebview, (3) packages the app,
(4) writes `sambada-gui\dist\SAMBADA-Studio-Windows.zip`.

**Must use GCC/MinGW, not MSVC or Clang:** the bundled Scythe library uses C++
features (`std::ptr_fun`, `bind1st/2nd`, `random_shuffle`) removed from modern
MSVC/libc++. Only the four product targets are built
(`sambada supervision recode-plink recode-plink-lfmm`); the `test/` targets are not
needed and may not compile on Windows.

### Troubleshooting
- **`cmake`/`g++ not found`** → the MinGW64 `bin` folder is not on `PATH`. Open the
  *MSYS2 MinGW64* shell, or add `C:\msys64\mingw64\bin` to `PATH`, and retry.
- **CMake picks MSVC** → run from the MSYS2 MinGW64 shell, or pass
  `-G "MinGW Makefiles"` (already done by `build\build-windows.bat`).
- **PyInstaller/pywebview install fails** → needs internet; re-run once connected.
- **The .exe warns "Windows protected your PC"** on the target machine → normal for an
  unsigned executable: *More info → Run anyway*. Code signing is optional (see README).
- **Rebuild from scratch** → delete `build-gui\`, `sambada-gui\bin\windows\*.exe`,
  `sambada-gui\.venv\`, `sambada-gui\dist\`, then re-run the script.

---

## Verifying the wrapper (optional, any OS)
```bash
cd sambada-gui
python3 -m unittest discover -s tests -v
```
Covers the p-value maths, results parsing, demo pre-fill, and the local-API
authorization (token + Host check). No third-party packages required.

## Layout
- `sambada-gui/` — the GUI: `sambada_gui.py` (local server), `web/` (interface),
  `docs/`, `examples/`, `bin/<os>/` (compiled engine), `build/` (C++ build scripts),
  `packaging/` (PyInstaller spec + `package-*` scripts), `tests/`.
- `src/`, `ext/`, `CMakeLists.txt` — the SAMBADA engine source (built by the scripts above).
- `.github/workflows/sambada-studio.yml` — the 3-OS build/release CI.
