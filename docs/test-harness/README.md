# Browser test harness (local, no production access)

Used in the 2026-09 sessions to prove UI and engine-button behaviour with a headless Chromium and a mock API.

Setup once: `cd docs/test-harness && npm init -y && npm i playwright-core` and make sure a Chromium exists
(`/opt/pw-browsers/chromium-*/chrome-linux/chrome` in the cloud session; fix the path in `lib.mjs` if it differs).

- `bash dev.sh start` starts `mock3.mjs` (mock API + WebSocket on :3001, records every request at `/__seen`) and Vite on :5173; `bash dev.sh stop` stops them.
  The mock keeps STATE between scripts (a cut stays cut). For a clean run restart the mock. Run the engine scripts in this order on a fresh mock:
  `p12-cut` -> `p15-queue` -> `p19-sent` -> `p20-password` -> `p21-admin`.
- Do not kill processes by pattern from a shell whose own command line contains the pattern (it kills the shell). Kill by pid (`mock.pid`, `vite.pid`).
- Other scripts: `p22-native` (phone-app simulation: API/WS go to https://athargps.com), `session.mjs` (stay-signed-in scenarios),
  `sub-custom.mjs` / `sub-quick.mjs` (custom subscription period), `hero.mjs` (home hero screenshots), `p18-tiles`.
