#!/bin/bash
# usage: dev.sh start | stop   (local test servers only; uses pid files, never pattern kills)
SP="$(cd "$(dirname "$0")" && pwd)"   # this folder
ROOT="$(cd "$SP/../.." && pwd)"          # repo root
stop() {
  for f in "$SP/mock.pid" "$SP/vite.pid"; do
    [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null
    rm -f "$f"
  done
  # vite starts child processes; free the port the polite way too
  for port in 3001 5173; do
    pid=$(ss -ltnp 2>/dev/null | grep ":$port " | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
    [ -n "$pid" ] && kill "$pid" 2>/dev/null
  done
  sleep 1
}
case "$1" in
  stop) stop ;;
  start)
    stop
    (cd "$SP" && nohup node "$SP/mock3.mjs" > "$SP/mock.log" 2>&1 & echo $! > "$SP/mock.pid")
    (cd "$ROOT" && VITE_WS_URL=ws://127.0.0.1:3001/api/socket BACKEND_PORT=3001 nohup npx vite --port 5173 --host 127.0.0.1 > "$SP/vite.log" 2>&1 & echo $! > "$SP/vite.pid")
    sleep 5
    curl -s -o /dev/null -w "vite:%{http_code}\n" http://127.0.0.1:5173/
    curl -s http://127.0.0.1:3001/__sockets; echo
    ;;
esac
