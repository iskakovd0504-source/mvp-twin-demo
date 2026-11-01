#!/usr/bin/env bash
# Демо-стенд MVP Twin — запуск статики на http://localhost:8080
set -e
cd "$(dirname "$0")"

PORT=8080
echo "=== MVP Twin Demo ==="
echo "Открывай http://localhost:$PORT"
echo "Остановка: Ctrl+C"

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT"
else
  echo "[ERROR] Python не найден. Установи с python.org" >&2
  exit 1
fi
