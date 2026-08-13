---
name: LiveMap safety constraint
description: Durable guidance for future LiveMap maintenance after prior black-screen regressions.
---

LiveMap changes must remain additive and surgical: hide or reposition UI without removing the existing Leaflet lifecycle, follow, route, marker, or device-sheet logic.

**Why:** An earlier broad LiveMap cleanup caused a black-screen crash; the stable version was restored before applying smaller guards and layout changes.

**How to apply:** Prefer guards, conditional rendering, and isolated CSS adjustments. Avoid replacing the map structure or deleting state/handlers unless the full live-map flow is reverified.