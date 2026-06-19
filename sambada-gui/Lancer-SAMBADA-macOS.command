#!/bin/bash
# Double-cliquez ce fichier pour lancer SAMBADA Studio sur macOS.
cd "$(dirname "$0")" || exit 1

PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done

if [ -z "$PY" ]; then
  echo "==============================================================="
  echo " Python 3 est introuvable."
  echo " Installez-le depuis https://www.python.org/downloads/ puis"
  echo " relancez ce fichier."
  echo "==============================================================="
  read -r -p "Appuyez sur Entrée pour fermer."
  exit 1
fi

exec "$PY" sambada_gui.py
