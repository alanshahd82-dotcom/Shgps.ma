---
name: Trip replay timing
description: GPS replay must preserve movement samples even when Traccar returns equal timestamps.
---

Replay history can contain valid GPS fixes with identical timestamps. Treating equal-time movement as impossible speed collapses the route, and using raw timestamps for playback can skip the movement. Preserve those samples, validate speed only when time advances, and use a strictly increasing internal replay clock.

**Why:** A replay with one remaining point renders a stationary vehicle; repeated React/Leaflet updates can also freeze the map when driven directly from every animation frame.

**How to apply:** Keep the internal playback clock separate from displayed fix times, throttle visual state updates, and avoid starting a new map animation on every frame.