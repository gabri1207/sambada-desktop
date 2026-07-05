<p align="center">
  <img src="web/assets/sambada-wordmark.png" alt="SAMBADA Studio" height="84">
</p>

# SAMBADA Studio — graphical interface for SAMBADA

A friendly application to use **SAMBADA** (landscape genomics) **without the command line**:
file selection, a parameter form with built-in help, one-click execution, and bundled
documentation. Designed so a student can get started in minutes.

> **SAMBADA Studio does not change** how SAMBADA works. It is a thin wrapper that prepares the
> parameter file and calls the official programs (`sambada`, `supervision`, `recode-plink`,
> `recode-plink-lfmm`). Results are identical to the command line.

---

## For the student: download and run (no installation)

Download the executable for your system (the repository's **Releases** page), then:

### 🍎 macOS — `SAMBADA-Studio-macOS.zip`
1. Double-click the `.zip` to extract it → you get **`SAMBADA Studio.app`**.
2. **Right-click the app → Open** (first time only), then confirm.
   *(macOS blocks unsigned downloaded apps by default; right-click → Open bypasses this.)*
3. The app opens in **its own window**. To quit, close the window.

### 🪟 Windows — `SAMBADA-Studio-Windows.zip`
1. Extract the `.zip`, then run **`SambadaStudio.exe`**.
2. If "Windows protected your PC" appears: **More info → Run anyway**
   *(normal for an unsigned executable).*
3. The app opens in its own window (via WebView2, included in Windows 10/11).

### 🐧 Linux — `SAMBADA-Studio-Linux.tar.gz`
```bash
tar xzf SAMBADA-Studio-Linux.tar.gz
chmod +x SambadaStudio
./SambadaStudio
```
*(On Linux the interface shows in a native window if `webkit2gtk` is present, otherwise it opens
in your default browser — usage is identical.)*

**No Python or SAMBADA installation is required**: everything is bundled in the executable.

---

## For the instructor: building the executables

An executable is **specific to each system** and must be **built on that system**. Two options:

### A. Automatic via GitHub Actions (recommended)
The workflow [`.github/workflows/sambada-studio.yml`](../.github/workflows/sambada-studio.yml) builds and
packages **all three** executables (macOS, Windows, Linux) on GitHub's servers:

- **Manual**: *Actions* tab → *SAMBADA Studio — downloadable executables* → *Run workflow*.
  The three archives appear as run *artifacts*.
- **Release**: push a `studio-vX.Y` tag (e.g. `git tag studio-v1.0 && git push --tags`) → a
  **Release** is created with the three archives ready to download.

### B. Locally (one OS at a time)
Requires **GCC**, **CMake** and **Python 3.11/3.12** on the target machine.
> ⚠️ Use **GCC** (not Clang): the bundled Scythe library uses C++ features removed from recent
> Clang/libc++ versions.

| System | Command | Produces |
|---|---|---|
| macOS | `bash sambada-gui/packaging/package-macos.sh` | `dist/SAMBADA-Studio-macOS.zip` |
| Linux | `bash sambada-gui/packaging/package-linux.sh` | `dist/SAMBADA-Studio-Linux.tar.gz` |
| Windows | `sambada-gui\packaging\package-windows.bat` | `dist\SAMBADA-Studio-Windows.zip` |

(Tools: macOS → `brew install gcc cmake`; Linux → `sudo apt install build-essential cmake`;
Windows → MSYS2 + `pacman -S mingw-w64-x86_64-gcc mingw-w64-x86_64-cmake`.)

### Code signing (important for distribution)
The produced executables are **not code-signed or notarized**. When downloaded, macOS
(Gatekeeper) and Windows (SmartScreen) will warn that the app is from an unidentified
developer — students must use the *right-click → Open* / *More info → Run anyway* steps
above. To remove those warnings you would need an Apple Developer ID (sign + `notarytool`)
and a Windows Authenticode certificate; this is optional and not required for the app to run.

---

## Lightweight alternative: run without packaging

If Python 3 is installed, you can run the app directly, without building an executable, via the
double-click launchers: `Launch-SAMBADA-macOS.command`, `Launch-SAMBADA-Windows.bat`,
`Launch-SAMBADA-Linux.sh`. (The SAMBADA binaries must then be present in `bin/<system>/`;
see the `build/` scripts.) For a native window, also install `pywebview` (`pip install pywebview`).

---

## Folder layout

```
sambada-gui/
├── sambada_gui.py                  ← the local server (Python, standard library)
├── web/                            ← the interface (HTML/CSS/JS) + assets (logo, icon)
├── docs/                           ← documentation (shown in the "Documentation" tab)
├── examples/                       ← example dataset
├── bin/<macos|windows|linux>/      ← compiled SAMBADA binaries
├── build/                          ← C++ COMPILATION scripts (build-*.{sh,bat})
├── packaging/                      ← spec + EXECUTABLE packaging scripts + app icons
│   ├── SambadaStudio.spec          ← PyInstaller recipe (cross-platform)
│   └── package-*.{sh,bat}
├── Launch-SAMBADA-*.{command,bat,sh}  ← "lightweight" launchers (require Python)
└── dist/                           ← produced executables (generated, not versioned)
```

## Portability note

A **single portability fix** was applied to the bundled Scythe library: the obsolete `finite(x)`
call was replaced with the standard equivalent `std::isfinite(x)` (5 occurrences in
`ext/scythestat-1.0.3/`). These functions are **strictly equivalent**; SAMBADA's numerical behaviour
is unchanged.

## Licence

SAMBADA is distributed under **GPL v3** (see `COPYING` and `AUTHORS` at the repository root).
