#!/usr/bin/env bash
# Double-click (or run: bash Launch-SAMBADA-Linux.sh) to launch SAMBADA Studio.
cd "$(dirname "$0")" || exit 1

PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done

if [ -z "$PY" ]; then
  echo "Python 3 was not found. Install it, for example:"
  echo "  sudo apt install python3      (Debian/Ubuntu)"
  echo "  sudo dnf install python3      (Fedora)"
  read -r -p "Press Enter to close."
  exit 1
fi

exec "$PY" sambada_gui.py
