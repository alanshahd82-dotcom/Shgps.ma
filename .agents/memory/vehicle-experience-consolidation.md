---
name: Vehicle experience consolidation
description: Durable navigation and map invariants for the ATHAR client vehicle experience.
---

All client vehicle entry points must resolve to the single existing Device Detail screen, and all-vehicles maps must reuse the shared MapLayers and LiveVehicleMarker path.

**Why:** Parallel vehicle detail and map implementations created inconsistent behavior, especially after returning from More/Profile and when opening vehicles from different client surfaces.

**How to apply:** When adding or changing a client vehicle link, use the canonical device-detail route. For map changes, preserve the shared fallback and marker infrastructure rather than introducing a second provider or marker renderer.