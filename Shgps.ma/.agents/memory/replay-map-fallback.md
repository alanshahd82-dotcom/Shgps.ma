---
name: Replay map fallback
description: Replay maps must not depend on an optional Geoapify key or leave an opaque loading layer after tile failures.
---

Use a server-side keyless street-tile fallback for replay maps, and let the loading surface dismiss after all tile sources fail so route controls remain usable.

**Why:** The replay screen can disable satellite mode while Geoapify is unconfigured; starting with that provider left the map visually stuck even though Leaflet and the route data were valid.

**How to apply:** Keep replay basemap fallback independent from optional provider credentials, and test both the tile endpoint and a short or zero-duration replay range.