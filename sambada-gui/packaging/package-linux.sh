#!/usr/bin/env bash
# Produit l'exécutable Linux autonome : sambada-gui/dist/SAMBADA-Studio-Linux.tar.gz
# (contient l'exécutable unique "SambadaStudio", aucune dépendance Python pour l'utilisateur final)
# Prérequis : g++ (build-essential), cmake, python3 (>=3.9) + venv.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
GUI="$(cd "$HERE/.." && pwd)"

echo "==> 1/4  Compilation des binaires SAMBADA (si nécessaire)"
if [ ! -f "$GUI/bin/linux/sambada" ]; then
  bash "$GUI/build/build-linux.sh"
fi

echo "==> 2/4  Environnement Python + PyInstaller"
cd "$GUI"
PY="$(command -v python3.12 || command -v python3.11 || command -v python3)"
echo "    Python : $PY"
[ -d .venv ] || "$PY" -m venv .venv
.venv/bin/python -m pip install --quiet --upgrade pip
.venv/bin/python -m pip install --quiet pyinstaller pywebview  # pywebview = fenêtre native (repli navigateur si webkit2gtk absent)

echo "==> 3/4  Empaquetage (PyInstaller)"
.venv/bin/pyinstaller --noconfirm --clean --distpath dist --workpath build/pyi packaging/SambadaStudio.spec

echo "==> 4/4  Archive téléchargeable"
cd dist
chmod +x SambadaStudio
rm -f SAMBADA-Studio-Linux.tar.gz
tar czf SAMBADA-Studio-Linux.tar.gz SambadaStudio
echo ""
echo "OK -> sambada-gui/dist/SAMBADA-Studio-Linux.tar.gz"
