#!/usr/bin/env bash
# Double-cliquez (ou exécutez : bash Lancer-SAMBADA-Linux.sh) pour lancer SAMBADA Studio.
cd "$(dirname "$0")" || exit 1

PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done

if [ -z "$PY" ]; then
  echo "Python 3 est introuvable. Installez-le, par ex. :"
  echo "  sudo apt install python3      (Debian/Ubuntu)"
  echo "  sudo dnf install python3      (Fedora)"
  read -r -p "Appuyez sur Entrée pour fermer."
  exit 1
fi

exec "$PY" sambada_gui.py
