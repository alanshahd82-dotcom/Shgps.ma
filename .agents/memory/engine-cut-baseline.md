---
name: Engine cut baseline
description: Engine cut/resume works in production; full verified description lives in docs/ENGINE_CUT_BASELINE.md.
---

Engine cut/resume is the most valuable working feature. Full flow, payload profiles, state machine, frontend behaviour, test baseline and sha256 fingerprints were recorded at commit `1cb568d` in `docs/ENGINE_CUT_BASELINE.md`.

**Why:** The owner reports it works correctly in production and must not be lost; the tests do not import the real engine modules, so a regression would not be caught automatically.

**How to apply:** Read that document before any change touching `engineCommands.js`, `traccar.js` (command functions), `devices.js` command routes, `useEngineControl.js`, or the engine power-cooldown. Keep changes additive, never add auto-restore, never derive button state from telemetry, compare fingerprints after any change.
