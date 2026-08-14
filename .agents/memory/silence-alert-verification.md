---
name: Silence alert verification
description: Silence-based power-disconnect alerts must be verified against Traccar REST before firing
---
Rule: a "device went silent" disconnect alert is only a suspicion — the WebSocket bridge can miss packets even while Traccar keeps receiving them. Before firing, query Traccar REST positions; if a fresh position exists, cancel the alert and feed the live position back into telemetry state. If Traccar is unreachable, defer and retry — never alert blindly.

**Why:** idle devices repeatedly triggered false "power disconnected" notifications every idle period, followed by false "restored" alerts, in an endless loop; the owner considered this unprofessional.

**How to apply:** any new alert path based on absence of data (silence, missing packets) needs (1) an independent verification source, (2) an `alerting` reservation set *before* awaited verification to prevent concurrent double alerts, and (3) a hard timeout on the verification call routed into the retry path. Explicit device-signal alerts (externalPower:false, powerCut) need no extra verification.
