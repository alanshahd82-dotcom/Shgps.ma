---
name: Power episode restoration
description: Durable rule for preventing duplicate disconnect alerts when tracker packets omit charge state
---

A telemetry-triggered external-power disconnect episode must stay active until
the tracker provides affirmative restoration evidence. A packet that merely
lacks a loss signal is not enough, because sleeping GT06 devices can omit or
fluctuate charge-related fields while still running on internal battery.

**Why:** Treating a normal packet as restoration cleared the per-device episode
flag between packets and allowed the next loss packet to create a duplicate
disconnect alert.

**How to apply:** Keep per-device disconnect state persistent across reducer
calls and async alert races; permit automatic recovery for silence-triggered
episodes only when the existing silence contract says it is valid, otherwise
require an explicit restore signal.