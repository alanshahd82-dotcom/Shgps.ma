---
name: Fleet WS stale-closure pattern
description: Why FleetContext WS callbacks use refs instead of useState values.
---

# Fleet WebSocket Stale-Closure Pattern

## The Rule
WS `onmessage` handlers defined inside `useCallback` must NOT read React state values directly. They capture state at the time the callback was created and go stale.

## Why
In `FleetContext.tsx`, the `deviceStale` WS handler needs the current vehicle name to compose an alert. Reading `vehicles` directly from the closure returns the value at callback-creation time (usually `SEED_VEHICLES`), not the live list.

## How to Apply
- Keep a `vehiclesRef = useRef<Vehicle[]>(SEED_VEHICLES)` synced via `useEffect(() => { vehiclesRef.current = vehicles }, [vehicles])`.
- Similarly `deviceNamesRef` for the Traccar name map.
- In the WS handler, read `vehiclesRef.current.find(...)` — always returns current data.
- Do NOT use the `setVehicles(prev => { /* side effects here */ return prev })` anti-pattern to sneak reads inside a setter.
