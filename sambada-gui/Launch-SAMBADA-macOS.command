#!/bin/bash
# Double-click this file to launch SAMBADA Studio on macOS.
cd "$(dirname "$0")" || exit 1

PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done

if [ -z "$PY" ]; then
  echo "==============================================================="
  echo " Python 3 was not found."
  echo " Install it from https://www.python.org/downloads/ and then"
  echo " run this file again."
  echo "==============================================================="
  read -r -p "Press Enter to close."
  exit 1
fi

exec "$PY" sambada_gui.py
