# Athar GPS — Task Log

This file records the completed replay-related work and the current import audit fix.

## LiveMap — only devices launcher and search icon

- Deleted the rendered green Live/reconnecting indicator, the auto-follow control, the hidden status-legend JSX, the recenter control, the drag handle/status-chip bottom-sheet header, and the full-width bottom-sheet container from `src/pages/client/LiveMap.jsx`.
- Replaced the removed sheet trigger with one small `أجهزتي` / `Mes appareils` button that is the only control that opens the device list. The existing device filtering, selection, route, Google Maps, Waze, popup, marker, and movement logic remain unchanged inside a bounded floating card with `45vh` maximum height and internal scrolling.
- Changed search from a permanent bar to one magnifier icon. The icon reveals the existing search input and its X closes the input and clears the query. `MapContainer` keeps `zoomControl={false}` and no `<ZoomControl>` remains.
- Grep proof after the edit: `ZoomControl` = `0`; `aria-pressed={autoFollow}` = `0`; no `athar-map-legend`, `athar-map-recenter`, `Bottom Panel`, `Live indicator`, or `تتبع تلقائي` remains. `setPanelOpen` appears only on the devices launcher handler, and the Live-text grep is empty.
- Files changed: `src/pages/client/LiveMap.jsx` and this log. MapContainer, MapLayers, FlyTo, FlyToUser, markers, Polyline, Popups, WebSocket/live position updates, engine commands, replay, subscriptions, and ErrorBoundary were not changed.

### Verification

- [x] `npm run build` passes.
- [x] Largest generated JavaScript asset is below 500 KB (`383.15 KB`).
- [x] `git diff --check` passes.
- [x] LiveMap control-removal grep checks pass.

## LiveMap visual cleanup — cosmetic only

- Fix B — `src/pages/client/LiveMap.jsx:392-393`: moved the existing auto-follow control from the upper-left stack to the upper-right. Its click handler, state, local-storage preference, and map-follow behavior remain unchanged.
- Fix C — `src/pages/client/LiveMap.jsx:94`: reduced the expanded device-sheet height from `480px` to `380px` so the map remains visible when the sheet is open. The sheet content, device selection, route loading, and navigation actions remain unchanged.
- Fix D — `src/components/LiveVehicleMarker.jsx:83`: hid only the ambiguous voltage text from the vehicle marker label. Voltage calculation, color selection, marker movement/rotation, and the detailed popup voltage value remain unchanged.
- These are cosmetic, reversible changes only. The map instance, tile layers, markers, movement smoothing, engine cut/start, replay, subscriptions, settings, WebSocket flow, and ErrorBoundary were not changed.

### Verification

- [x] `npm run build` passed after each of the three fixes.
- [x] `git diff --check` passes.
- [x] Existing live map, marker rendering, movement smoothing, engine-cut path, and replay path remain in place.
- [x] Changes were committed separately per fix and pushed to `origin/main`.

## Fix engine-cut protocol detection

- Root cause: the engine command route inferred the Traccar protocol from the local vehicle `type`/name fields. Those fields describe the vehicle, not the tracker protocol, so RELAY routing could be selected for the wrong device or skipped for a GT06-family tracker.
- Fix: the command route now rejects devices without `traccar_id` with HTTP 400 (`Device has no Traccar mapping`), resolves the mapped Traccar device through the lightweight device endpoint, reads its authoritative `protocol`, and uses RELAY only for `gt06`, `concox`, `wanway`, and `gs900` protocol families. All other protocols use standard `engineStop` / `engineResume`.
- The existing `device_commands` insert, `logAudit` call, and `{ ok, type, relay }` response shape remain unchanged. The `sendCommand(deviceId, type, attributes)` signature remains in use.
- Files changed: `backend/src/routes/devices.js`, `backend/src/services/traccar.js`, and this log. Frontend, Traccar configuration, and database schema were not changed.

### Verification

- [x] `npm run build` passes.
- [x] `node --check backend/src/routes/devices.js` passes.
- [x] `node --check backend/src/services/traccar.js` passes.
- [x] `git diff --check` passes.
- [ ] bekane (GT06, local device id 14) live engine-cut verification requires the deployed backend and reachable GPS device.
- [ ] DACIA (GT06, local device id 16) live RELAY verification requires the deployed backend and reachable GPS device.
- [x] A device without `traccar_id` now returns a clean HTTP 400 before any Traccar command is sent.

### Server-side curl checks

Replace the four credential variables and `BASE_URL` on the server; do not put passwords or tokens in shell history.

```sh
BASE_URL=https://your-athargps-server.example
MUSTAPHA_EMAIL='mustapha-account-email'
MUSTAPHA_PASSWORD='mustapha-account-password'
AMIN_EMAIL='amin-account-email'
AMIN_PASSWORD='amin-account-password'

MUSTAPHA_TOKEN=$(curl -fsS "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg email "$MUSTAPHA_EMAIL" --arg password "$MUSTAPHA_PASSWORD" \
    '{email:$email,password:$password}')" | jq -r '.token')

curl -fsS -X POST "$BASE_URL/api/devices/14/command" \
  -H "Authorization: Bearer $MUSTAPHA_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"type":"engineStop"}'

curl -fsS -X POST "$BASE_URL/api/devices/14/command" \
  -H "Authorization: Bearer $MUSTAPHA_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"type":"engineResume"}'

AMIN_TOKEN=$(curl -fsS "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg email "$AMIN_EMAIL" --arg password "$AMIN_PASSWORD" \
    '{email:$email,password:$password}')" | jq -r '.token')

curl -fsS -X POST "$BASE_URL/api/devices/16/command" \
  -H "Authorization: Bearer $AMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"type":"engineStop"}'

curl -fsS -X POST "$BASE_URL/api/devices/16/command" \
  -H "Authorization: Bearer $AMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"type":"engineResume"}'

# Use any local device id whose database row has a NULL traccar_id.
curl -i -X POST "$BASE_URL/api/devices/<device-id-without-traccar-mapping>/command" \
  -H "Authorization: Bearer $MUSTAPHA_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"type":"engineStop"}'
# Expected: HTTP/1.1 400 and {"error":"Device has no Traccar mapping"}
```

## Finish voltage feature — safe separation of external voltage and internal battery

- Production attributes previously confirmed for the real devices remain unchanged: DACIA (Traccar device 70) reports internal battery `33%` and signal only; bekane (Traccar device 37) reports ignition, satellite, and distance data only. Neither device reports external/main-power voltage, `power`, `voltage`, `externalPower`, `adc1`, or `analog1`.
- Decision: Branch B. The API now exposes `voltage` and `batteryLevel` as separate fields. Voltage is read only from `power`, `voltage`, `externalPower`, `adc1`, or `analog1`; missing, zero, or invalid values become `null`. Internal battery percentage is read only from `batteryLevel` or `battery`.
- The client and admin interfaces show voltage in volts with the requested thresholds: `>=13.2` green, `12.4–13.2` amber, `12.0–12.4` orange, `<12.0` red. Missing, zero, or offline voltage shows `مفصول` / `Déconnecté`; no voltage is fabricated. Battery percentage remains a small secondary value where available.
- The implementation is ready to display voltage automatically when a device starts reporting it. The real fix for the two current devices is hardware-side: enable main-power voltage reporting with the device SMS command or use a firmware/model that emits a supported voltage attribute. A Traccar `gt06.codec` change was not attempted.
- Files changed: `backend/src/routes/devices.js`, `backend/src/routes/map.js`, `backend/src/routes/clients.js`, `src/context/AppContext.jsx`, `src/components/LiveVehicleMarker.jsx`, `src/components/MapView.jsx`, `src/components/ui.jsx`, `src/index.css`, `src/pages/client/DeviceDetail.jsx`, `src/pages/client/DeviceList.jsx`, `src/pages/client/LiveMap.jsx`, `src/pages/admin/ClientDetail.jsx`, and `src/pages/admin/AllDevices.jsx`.

### Preservation checklist

- [x] Engine cut/start RELAY command path preserved.
- [x] Live map and live position flow preserved.
- [x] Replay player and route loading preserved.
- [x] Subscription and renewal behavior preserved.
- [x] Global ErrorBoundary preserved.
- [x] `npm run build` passes; largest generated JavaScript asset is 383.20 KB.
- [x] `git diff --check` passes.
- [ ] Authenticated live-device verification still requires a reachable backend and GPS device.

## Follow-up fix — LiveMap vehicle marker render crash

- Root cause: `src/components/LiveVehicleMarker.jsx` read `initialBearingRef.current` while initializing `rotationRef` before `initialBearingRef` itself was declared. When the live map rendered a positioned device, JavaScript threw a temporal-dead-zone `ReferenceError`.
- Exact fix: initialize `initialBearingRef` first, then initialize `rotationRef` from its value. Map marker animation, follow behavior, and trail rendering remain unchanged.
- Verification: `npm run build` passes, `git diff --check` passes, and the fix is pushed to `origin/main`.

## Crash fixes — LiveMap open and subscription renewal

- Fixed the LiveMap crash on open. Root cause: the status-count calculation still called `devices.filter(...)` directly while the app context could temporarily provide an undefined device list. Exact fix: reuse the existing `safeDevices` fallback and filter null entries before calculating status counts in `src/pages/client/LiveMap.jsx`.
- Fixed the subscription renewal crash. Root cause: `dateOnly(new Date())` converted a Date object to a non-ISO display string such as `Wed Aug 12`, which made `addMonths` receive an invalid date and throw while rendering renewal actions. Exact fix: normalize Date and string inputs safely, add a deterministic date/plan fallback, and normalize the renewal email before building contact URLs in `src/pages/client/Subscriptions.jsx`.
- Files changed: `src/pages/client/LiveMap.jsx`, `src/pages/client/Subscriptions.jsx`, and this log.

### Verification checklist

- [x] LiveMap opens without the ErrorBoundary crash.
- [x] Subscription renewal opens the plan choices safely.
- [x] Trip replay player remains untouched and continues to use the existing stable playback path.
- [x] ErrorBoundary remains in place as a permanent safety net.
- [x] Engine cut/start path remains untouched.
- [x] `npm run build` passes.
- [x] Largest generated JavaScript asset is below 500 KB (383.15 KB).
- [x] `git diff --check` passes.

## Crash guards and conservative LiveMap cleanup

- Added a global React `ErrorBoundary` around the application. Rendering errors now show the bilingual `حدث خطأ غير متوقع` / `Une erreur inattendue` screen with a page reload action instead of leaving a black screen.
- Guarded device arrays, report chart payloads, subscription cards, settings sub-user responses, and replay Leaflet lifecycle calls before using `.map()`, `.filter()`, `.reduce()`, or map methods.
- Kept the existing LiveMap map, markers, `useMap`, follow, route, and device-sheet logic. The compact `أجهزتي` launcher remains, and the locate button now sits on the left side away from Leaflet's bottom-right zoom controls. Existing live/follow/legend controls remain hidden without removing their underlying state or map behavior.

### Verification checklist

- [x] `npm run build` passed.
- [x] Largest generated JavaScript asset is below 500 KB (383.20 KB).
- [x] `git diff --check` passed.
- [ ] Authenticated live-map and replay verification still requires a reachable backend and GPS device.

## Phase 2/3 completion — replay, reports, and real renewal messaging

- Trip replay is already delivered on `main` through the existing replay commits: one stable Leaflet map remains mounted during playback, map sizing is invalidated after the sheet transition, playback rendering is throttled, and period/day selection is held in stable state. The flow is range/day selection → load trips → select a trip → one replay map.
- Reports no longer displays the `بيانات حقيقية` / `Données réelles` badge. The existing real report values, chart data, and unified period selector remain unchanged.
- Client renewal now uses the same 3/6/12-month plans and prices as the backend subscription service. The WhatsApp/email message includes the selected plan and a projected expiry calculated from the later of today or the current subscription end date, using the same calendar-month logic as the renewal endpoint.
- Files changed for this completion: `src/pages/client/Reports.jsx`, `src/pages/client/Subscriptions.jsx`, and this log.

### Verification checklist

- [x] `pnpm install` completed without rewriting the tracked lockfile.
- [x] `npm run build` passed.
- [x] Largest generated JavaScript asset is below 500 KB.
- [x] `git diff --check` passed.
- [x] Engine cut/start code path preserved.
- [x] Live map and replay code paths preserved and included in the existing `main` history.
- [ ] Live engine, live map, and replay device verification requires an authenticated backend and a reachable GPS device.

## Completed tasks

- Current task — Mobile UI cleanup, single engine toggle, and replay-map reliability
- Removed the exact Arabic engine helper strings `سيتم إيقاف محرك المركبة عن بعد`, `سيتم تشغيل محرك المركبة عن بعد`, `المحرك يعمل حالياً`, `المحرك متوقف حالياً`, and `حالة الزر تعكس الحالة الحقيقية للجهاز. لن تتغير إلا بعد تأكيد تنفيذ الأمر.` together with their inline French equivalents. The engine status remains a dot plus a short bilingual state label, and the command action is one large state-colored button.
- Renamed the playback tab and replay header from `الرحلات` / `Trajets` to `إعادة المسار` / `Rejouer le trajet`.
- Replay-map root causes addressed: playback was reconciling Leaflet too frequently, the map surface did not declare a minimum stable height, and overlay resizing needed to remain independent from playback updates. The map now keeps one mounted `MapContainer`, renders playback positions at a 250ms cadence through the existing ref-driven frame loop, has an explicit full-viewport/minimum height, and retains the post-sheet-transition `invalidateSize` synchronization.
- Unified DeviceDetail and Reports period selectors into accessible segmented controls with one active state and bilingual 1/7/15/30-day labels. Existing range fetch/filter behavior was preserved.
- Raised the LiveMap bottom panel and map controls above the fixed ClientNav safe-area offset so the panel, legend, recenter action, and Leaflet controls are not covered on mobile.
- Files changed: `src/pages/client/DeviceDetail.jsx`, `src/components/TripReplay.jsx`, `src/pages/client/Reports.jsx`, `src/pages/client/LiveMap.jsx`, `src/i18n/translations.js`, `src/index.css`, and this log.

### Previously-working feature preservation checklist

- [x] Live map and `مباشر` / live connection indicator — map and WebSocket code paths were not changed.
- [x] Device list and device detail — navigation, device selection, and detail data paths were not changed.
- [x] Engine cut/start — existing confirm modal, `toggleEngine`, RELAY command path, toast handling, and in-flight state were preserved; only the surrounding presentation was cleaned.
- [x] Trips/replay — existing positions API, playback controls, route calculations, and Leaflet layers were preserved; only render cadence, stable sizing, and labels changed.
- [x] Reports — existing report fetch and selected-period boundaries were preserved; only selector presentation and translated labels changed.
- [x] Alerts and settings — no functional code in either screen was changed.
- [x] Arabic/French switch and RTL/LTR — all new labels use the existing translation helper and direction handling.
- [x] Session persistence, GPS-await amber state, km/h speed, and subscriptions — no related logic or files were changed.

- Verification: `npm run build` passes, `git diff --check` passes, and the instructional-string scan is clean. Live engine/device verification still depends on an authenticated running backend and a reachable GPS device.

- Current task — Five-item safe-area bottom navigation, real More bottom sheet, and shared Toast feedback
- `0c64756` — Add positions endpoint for trip replay (`GET /api/stats/positions`)
- `eb9e5d6` — Add bilingual trip replay with stop and speed analysis (`TripReplay` component plus client and admin integration)
- `639fedb` — Fix trip replay startup and timeline playback
- Current task — Fix missing `lucide-react` imports and add living project documentation
- Current task — Professional replay UI overhaul: contrast, marker, layout, chart
- Current task — Redesign replay screen: map-first layout, real rotating car, clean sheets
- Current task — Security 0/10: client engine cut-off permissions
- Current task — Design 1/10: additive tokens + base classes (invisible foundation)
- Current task — Design 2/10: splash + login + header restyle

## Design 2/10 — splash, login, and header restyle

- Restyled the initial HTML splash and React onboarding splash with the ATHAR GPS dark surface, gold logo glow, green product tagline, animated gold loader, and fixed 2026 footer.
- Restyled client and admin login surfaces with the light gradient, white rounded cards, icon-led inputs, green focus rings, dark gradient primary actions, and preserved password toggles.
- Restyled the client header with a sticky gradient surface, bilingual greeting, branded logo treatment, and an unread notification dot while preserving the existing alerts handler.
- Presentation-only changes: authentication calls, validation, routing, state, WebSocket behavior, backend, and unrelated pages were not changed.

## Additive design foundation

- Added the Cairo and IBM Plex Sans Arabic font weights through jsDelivr while preserving all existing font tags.
- Added only the new `--ath-*` token namespace, reusable `ath-*` foundation classes, and `ath-*` keyframes.
- No existing CSS variables, classes, Tailwind tokens, pages, components, context, API, backend, Leaflet, or WebSocket code was changed.

## Verification

- `npm run build` passes successfully.
- `git diff --check` passes.

- Product UI remains unchanged because no existing screen consumes the new `ath-*` foundation yet.

## Client engine cut-off permissions

- Added device ownership authorization for `GET /api/devices/:id` and `POST /api/devices/:id/command`.
- Admins and managers retain fleet-wide access; clients can only read and control devices assigned to their own account.
- Restricted engine commands to `engineStop` and `engineResume`, with clear unauthorized and invalid-command responses.
- Restored the client command tab for all clients with bilingual confirmation, success/failure toasts, and an in-flight disabled state.
- Preserved the DeviceDetail battery display and did not modify TripReplay, LiveMap, Reports, WebSocket, tiles, or MapLayers.

## Verification

- `npm run build` passes successfully.
- `node --check backend/src/routes/devices.js` passes.
- `git diff --check` passes.

## Import audit result

- Fixed file: `src/pages/client/DeviceDetail.jsx`
- Missing icon fixed: `Play`
- `src/components/TripReplay.jsx` already imported every Lucide icon it uses.
- The automated audit found no remaining missing Lucide icon imports in the JSX/JS source files. Names reported by a broad JSX symbol scan that are not Lucide imports are local components or imports from other libraries.

## Verification

- `npm run build` passes.
- The production bundle emits no `is not defined` warnings.

## Professional replay UI overhaul

- Rebuilt `src/components/TripReplay.jsx` with solid dark overlay surfaces, compact route metadata, a rotating SVG car marker, stable map sizing/follow behavior, a non-overlapping bottom control stack, and green brand speed controls.
- Rebuilt the client trip speed visualization in `src/pages/client/DeviceDetail.jsx` as a real dark `AreaChart` from route positions, with a clean bilingual empty state.
- Backend, API, database, Traccar, and unrelated screen styling were not changed.

## GPS outlier filtering and realistic trip statistics

- Added a shared server-side `cleanPositions` pipeline that drops invalid coordinates and timestamps, sorts fixes, and removes teleport jumps over 220 km/h from the last kept point.
- Applied cleaned positions to replay responses, trip reports, and daily distance summaries so route maps, speed charts, distances, and durations use sane data only.
- Added the same validation and teleport filter to replay routes and the client device mini-map to protect the UI from stale cached responses.
- Preserved the existing Arabic/French UI and Traccar/database boundaries.

## Map-first replay screen

- Reworked `src/components/TripReplay.jsx` into exactly three non-overlapping layers: full-height map, compact top bar, and one bottom sheet.
- The collapsed sheet keeps the timeline, speed chips, playback controls, and four fully visible stats chips together; tapping the handle expands driver analysis and jumpable events.
- Replaced the oversized car marker with a compact top-view red SVG car that rotates with bearing, reduced start/end/stop/event marker sizes, and removed the end glow.
- Preserved the replay engine, behavior detection, Arabic/French translations, and existing API/backend boundaries.

## Verification

- `npm run build` passes successfully with no `is not defined` warnings.

## Realistic GPS replay car marker

- Replaced the replay car marker artwork with the provided realistic vehicle image at `public/athar-replay-car.png`.
- Kept the existing map, route, controls, and replay behavior unchanged while making the marker use interpolated GPS coordinates and smooth bearing transitions.
- Marker size responds to Leaflet zoom level within safe bounds, retains its correct orientation after zoom changes, and uses a soft drop shadow.

## Real car marker and trips tab audit

- Added the client-provided Mercedes image at `src/assets/car-marker.png` and wired it into `TripReplay.jsx` through the Vite asset pipeline.
- Replaced the replay marker artwork with a fixed 54×38px image marker using `mix-blend-mode:multiply`, a subtle drop shadow, centered anchoring, and smooth bearing rotation.
- Added bilingual trip-range presets for today, 7 days, 15 days, and a custom date range.
- Added custom-range validation with an inline 15-day limit message and refetching of the trips, route preview, and speed data whenever the range changes.
- Added a full-range replay action that passes every loaded point in the selected date range to the replay overlay.
- Reworked speed chart data to use every plotted GPS point, real km/h values, a bounded Y axis, non-duplicated time ticks, and a clear empty state.
- Normalized trip start/end, distance, maximum speed, and point-count fields before rendering, and formatted trip timestamps consistently in Arabic and French.
- Classified trips under 0.05 km with maximum speed under 1 km/h as stops and removed their replay action.
- Replaced bare quick-stat dashes with the localized no-data state.
- Added all new Arabic and French labels to `src/i18n/translations.js`.

## Verification

- `npm run build` passes successfully.
- The build output contains no `is not defined` warnings or build errors.
- `git diff --check` passes.

## Fix route button clearing the live map

- Stopped the route button click from bubbling into the device card button, which was clearing the selected device and immediately resetting the loaded route.
- Added coordinate range and null-island filtering before fitting the live route bounds.

## Verification

- `npm run build` passes successfully.
- `git diff --check` passes.

## Vehicle types and bike marker

- Added bilingual car/motorcycle vehicle-type infrastructure with motorcycle as the default for new devices.
- Added the supplied red sport motorcycle marker with full transparency, preserved orientation, and a final optimized size of 31.23 KB.
- Wired the vehicle asset registry into live maps, trip replay, public sharing, client/admin device lists, and vehicle editing.
- Calibrated both vehicle assets with an offset of `-135°`: bearing 0° → nose up, 90° → right, 180° → down.
- Added safe startup migration to set missing, blank, or unsupported device types to `bike`; create/update APIs now validate and persist only `car` or `bike`.

## Verification

- `npm run build` passes successfully.
- Backend JavaScript syntax checks pass.
- `git diff --check` passes.

## Vehicle types 2/2: truck markers

- Added the supplied blue Mercedes Actros truck marker at `src/assets/truck-marker.png` with full transparency, preserved orientation, and an optimized size of 59.9 KB.
- Extended the shared vehicle selector and vehicle icon support with `شاحنة` / `Camion`.
- Enabled `truck` in device creation and update validation, preserved existing `bike` defaults, and kept the existing marker consumers and replay engine unchanged.

## Design 4/10 — devices list restyle + battery on cards

- Restyled the client device list with an Athar card surface, search input with clear action, RTL-safe status filter chips, status stripes and badges, vehicle-type icon tiles, moving-device speed blocks, and a friendly empty state.
- Added battery progress indicators to device cards with green, amber, and red thresholds while safely hiding the indicator when battery data is unavailable.
- Preserved live search/filter behavior, device detail navigation, subscription renewal actions, vehicle-type helper usage, and Arabic/French labels. Card entrance motion respects reduced-motion preferences.

## Verification

- `npm run build` passes successfully.
- `git diff --check` passes.
- Modified UI files: `src/pages/client/DeviceList.jsx` and `src/components/ui.jsx`; this task log entry records the delivery.
- Calibrated the truck marker with an offset of `-135°`: bearing 0° → nose up, 90° → right, and 180° → down.

## Fix black map and frozen replay

- Removed manual `map.remove()` from the replay lifecycle helper; `MapContainer` owns Leaflet cleanup, and manual removal broke the map during React Strict Mode remounts.
- Added the same 3-second satellite fallback to the live map so a blocked satellite provider cannot leave that surface black.

## Verification

- `npm run build` passes successfully.
- `git diff --check` passes.

## On-demand loading and live connection resilience

- Device selection on the client and admin live maps only pans/selects and opens the device card; it does not request historical positions.
- Added explicit bilingual “show today's route” actions that fetch a bounded route only after the user asks for it.
- Trips tab now loads a lightweight trip list first; the map and speed chart remain empty until the user loads the selected range route.
- Added `maxPoints` stride sampling to `GET /api/stats/positions`, preserving the first and last fix and capping returned routes.
- Removed route payloads from trip-list responses; individual trip replay loads its route on demand.
- Added WebSocket ping/pong health checks, bounded exponential reconnect backoff, and 15-second `/api/map/positions` polling while disconnected.

## Verification

- Production frontend build passes successfully.
- Backend JavaScript syntax checks pass.
- `git diff --check` passes.

## Performance rescue

- Restored a lightweight car marker export at `160×107` and `33.82 KB` (previously `1536×1024` and approximately `2.4 MB`).
- Simplified replay casing, main, traveled, and speeding overlays to bounded point sets; mini-map routes are capped at 600 points.
- Bucketed client and report speed charts to a maximum of 300 points and throttled the replay traveled overlay to two updates per second.
- Enabled Leaflet Canvas rendering across map surfaces, added a `#0B1220` loading surface with a spinner, and cleaned replay animation/map resources on unmount.
- Added manual Rollup chunks for Recharts, Leaflet/react-leaflet, and Framer Motion. The initial JavaScript chunk is `288.80 KB`; the previous monolithic build emitted approximately `1.22 MB` index chunks.
- Lazy-loaded replay, reports, driver behavior, and admin screens while preserving Arabic/French labels and the existing backend, database, and Traccar boundaries.

## Verification

- `npm run build` passes successfully.
- `git diff --check` passes.

## Tile fallback chain + bounds + loading skeleton

- Added automatic tile fallback for both map modes: Esri satellite → Geoapify hybrid → OpenStreetMap, and Geoapify normal → OpenStreetMap after more than 10 tile errors within 5 seconds.
- Kept the dark `#0B1220` loading surface and spinner behind every basemap so slow or blocked tiles never expose a black void.
- Added map zoom bounds of 3–19, route `fitBounds` with 40px padding, and replay follow zoom protection at a minimum of 15.
- Added the 3-second replay satellite timeout with Arabic/French fallback notification and persisted map-style behavior.

## Verification

- `npm run build` passes successfully.
- `node --check backend/src/routes/map.js` passes.
- `git diff --check` passes.
- `src/assets/car-marker.png` is below 100 KB.

## Car heading calibration and satellite replay map

- Calibrated the provided blue Mercedes asset with `CAR_ASSET_HEADING_OFFSET = -135°` in replay and live vehicle markers. The acceptance mapping is now bearing 0° → nose up, 90° → right, and 180° → down.
- Added a replay map-style toggle sharing `athargps_map_style` with the live map, defaulting to Esri World Imagery satellite tiles when no style has been selected.
- Added white route casing, green traveled-route emphasis, fading 15-point motion trail, imagery-friendly marker outlines, and speed readout colors: green below 50 km/h, orange from 50–80 km/h, and red above 80 km/h.

## Verification

- `npm run build` passes.
- `git diff --check` passes.

## Design 7/10 — unified client device page and replay entry points

- Reworked the client device header into a unified bilingual surface with vehicle identity, editable device/driver fields, status, and driver phone actions.
- Added driver phone persistence through the existing device info update endpoint, including validation and backwards-compatible creation of the legacy `phone` column when needed.
- Added battery progress, IMEI, last-update, speed, and signal quick stats with RTL-safe tabs and primary actions for the live map, replay, engine command, and driver call.
- The live-map action opens the selected device and flies to its current position through the existing map flow.
- Preserved the existing replay playback engine, positions fetching, Leaflet replay map, WebSocket behavior, and Task-0 engine-cut confirmation flow.

## Verification

- `npm run build` passes.
- `node --check backend/src/routes/devices.js` passes.
- `git diff --check` passes.

## Mobile replay map controls

- Changed replay map following to be user-controlled: dragging or zooming pauses auto-follow, while the visible recenter button restores it.
- Added mobile-safe Leaflet zoom controls, touch gestures, and a compact responsive replay sheet so the route remains visible and pannable during playback.

## Follow-mode false-positive fix

- Disabled replay follow-mode from map-container `pointerdown`, `touchstart`, and `wheel` input events instead of Leaflet `movestart`/`zoomstart` events.
- Leaflet movement events are emitted by both user gestures and programmatic `setView`/`panTo` calls, so they could disable following before playback started. Programmatic camera moves now leave follow-mode enabled, while drag, pinch, and wheel input still pause it.
- The existing re-center button continues to restore follow-mode and the calibrated car marker rotation remains unchanged.

## Final replay polish

- Scaled replay car rotation transitions with the selected playback speed and removed the transition at 4x/8x to prevent a doubled or ghosted car marker.
- Kept speed-chart time endpoints visible with a right margin and `preserveStartEnd`; Y-axis ticks now show values only with one `km/h` axis label.
- Made `تصدير الرحلة` / `Exporter le trajet` open a bilingual printable report with device, range, distance, duration, max/average speed, stops, behavior counts, and efficiency score before calling print.
- Made the device coordinates row copyable with a visible Arabic/French confirmation toast.
- Follow-mode now keeps the car in the visible map area between the top bar and expanded/collapsed sheet while preserving map interaction above the sheet.

## Realistic live map

- Added a bilingual map-style toggle to both live map surfaces. Normal mode keeps Geoapify; satellite mode uses Esri World Imagery with a low-opacity OpenStreetMap label overlay. The choice is persisted locally.
- Added one persistent vehicle marker per device using the existing client car artwork, CSS multiply blending, drop shadow, bearing rotation, and requestAnimationFrame interpolation over approximately 800 ms.
- Added a short fading trail for the selected vehicle, automatic map following, live/offline freshness state, a once-per-second last-update readout, speed, and bearing details.
- Added Arabic and French labels for map, satellite, automatic follow, live, offline, update age, and bearing.
- Batched incoming WebSocket positions per device and flushed them at most twice per second. Existing reconnect, backend, database, and Traccar behavior were left unchanged.
- Preserved low-zoom device clustering in the admin global map; individual devices use the smooth live marker.

## Verification

- `npm run build` passes successfully.
- `git diff --check` passes.

## Client home page restyle

- Restyled `src/pages/client/Home.jsx` to match the Athar GPS reference with a live fleet card, real status donut and speed, animated status counts, subscription progress, shortcuts, and recent device cards.
- Kept all existing `useApp()` bindings, routes, device detail handlers, subscription calculations, Arabic/French labels, and the shared vehicle icon helper intact.
- Verification: `npm run build` passes and `git diff --check` passes.

## Single-screen home, subscriptions, and More shortcuts

- Reworked `src/pages/client/Home.jsx` into a no-scroll viewport layout containing only the live fleet card, real status grid, and clickable subscriptions summary.
- Added `src/pages/client/Subscriptions.jsx` with real device subscription dates, remaining-day status styling, bilingual empty state, and WhatsApp/email renewal actions.
- Added `/subscriptions` behind the existing client auth guard, moved the four shortcuts into the More sheet, and added the existing logout action there.
- Added `src/config/contact.js` with clearly marked placeholder renewal contacts.
- Verification: `npm run build` passes and `git diff --check` passes.

## Design 3/10 follow-up — 3D carousel and admin-managed renewal contacts

- Added the supplied three promotional images to the client home screen as a fixed-height, auto-rotating, swipeable carousel with Arabic/French copy, dots, touch hover pause, reduced-motion support, and emoji fallback only when an image fails.
- Added public `GET /api/settings/renewal-contacts` and admin-protected `PUT /api/settings/renewal-contacts`, persisted through the existing `app_settings.support_contacts` record with safe defaults.
- Added WhatsApp and email renewal contact fields to the admin Support Settings screen. The client subscription page now loads those values at runtime and disables unavailable links with a friendly hint.
- Removed the old hardcoded renewal contact module; tracking, authentication, WebSocket, and existing support settings remain unchanged.
- Verification: `npm run build`, backend syntax checks, and `git diff --check` pass.

## Design 5/10 — live map chrome restyle + chip polish

- Restyled only the client live-map presentation: rounded bordered map shell with depth vignette, bilingual live status badge, status legend, and glass zoom/recenter controls.
- Enhanced existing live vehicle markers with status-colored rings, vehicle imagery, speed/status labels, and battery-level dots while preserving position interpolation, bearing updates, and WebSocket data flow.
- Restyled live-map popups with device name, plate, status, speed, battery, signal, and a bilingual details link to the existing device detail route.
- Added safe inline padding to device filter chips and spacing below the device-list header so the final chip remains fully visible.
- Preserved `MapContainer`, `MapLayers`, `useMap`, `FlyTo`, fit-bounds, live position updates, Leaflet layers, authentication, and backend behavior.
- Verification: `npm run build` and `git diff --check` pass.

## Design 6/10 — reports restyle + skeletons

- Restyled only `src/pages/client/Reports.jsx`: RTL-safe period chips, 2×2 KPI grid with tabular animated values and per-card green glow, skeleton loading surfaces, green gradient speed chart, bilingual trip rows, replay actions, and a friendly empty state.
- Preserved the existing report fetch, period boundaries, chart bucketing, real report values, Arabic/French support, and the existing TripReplay component/API boundary.
- Added reduced-motion handling for skeletons, KPI count-up, chart entrance, and trip-row entrance motion.
- Verification: `npm run build` and `git diff --check` pass.

## Design 7.1/10 — device page icon, tabs, defaults, and editing

- Safety note: this delivery follows a prior reverted attempt that broke client device-account binding; the existing device source, selectors, route params, and account filtering were intentionally preserved.
- Fixed the device header to use the shared `VehicleIcon`, so motorcycles such as `bikan` no longer render as cars.
- Kept one tab bar with `المعلومات` as the initial tab, and made the quick stats a symmetric 2-column layout with the last-update card spanning both columns.
- Preserved the last known battery, signal, and fuel values when a stale/offline refresh omits live attributes.
- Kept name, driver, phone, plate, and vehicle type editing in the visible form with Save/Cancel controls, the `تم الحفظ ✅` confirmation, and direct calling from the saved phone.
- Verification: `npm run build` and `git diff --check` pass.

## Design 8/10 — alerts, driver behavior, and settings restyle

- Restyled the client alerts screen with counted RTL-safe filters, severity-colored notification tiles, unread indicators, bilingual empty state, and preserved mark-read handlers.
- Restyled driver behavior with an animated real-data safety ring, three behavior metrics, weekly event rows, and a friendly no-data state instead of a misleading zero score.
- Restyled settings with grouped bilingual toggle rows, speed-limit slider and live readout, local persistence, save confirmation, and RTL-safe tabs.
- Presentation-only delivery: existing data fetching, handlers, authentication, backend, WebSocket behavior, and unrelated pages remain unchanged.

## Verification

- `npm run build` passes successfully.
- `git diff --check` passes.

## Navigation and feedback polish

- Replaced the client navigation with five equal-width destinations: home, devices, live map, alerts, and More.
- Rebuilt More as a full-width bottom sheet with safe-area spacing, backdrop dismissal, Escape support, account shortcuts, and logout.
- Unified device save, engine command, coordinate, IMEI, and share-link feedback through one bilingual accessible Toast component.
- Existing API calls, handlers, authentication, replay behavior, and backend boundaries remain unchanged.

## Athar GPS completion audit

- Security and device ownership: removed the public debug positions endpoint, centralized device access rules for main admins, sub-admins, client owners, and client sub-users, protected IMEI checks, and applied ownership checks to devices, replay, reports, maintenance, driver behavior, maps, and geofences.
- Client functionality audit: verified the client routes and corrected shared ownership enforcement so client device operations cannot cross account boundaries. Renewal actions remain bilingual and preserve WhatsApp/email contact behavior.
- Administration audit: verified the admin dashboard data and device access paths. The remaining gap is visual/design parity work, not a missing admin capability.
- Arabic/French and direction: added the missing French notification labels, made the carousel bilingual without Arabic-only copy, and kept the global document language and RTL/LTR direction synchronized with the selected language.
- Performance: kept promo images as compressed JPG assets, enabled nginx gzip and sanitized access logs, and moved chart rendering to a lightweight SVG component so the Recharts chunk is loaded only by the lazy Reports page.
- Backups: added `scripts/backup-db.sh`, which reads `DATABASE_URL` from `backend/.env`, creates compressed timestamped dumps, and retains the latest seven files. No cron entry was installed automatically.
- Suggested cron (review and install manually): `0 2 * * * /absolute/path/to/Shgps.ma/scripts/backup-db.sh >> /var/log/athargps-backup.log 2>&1`

## Completion verification

- `npm run build` passes successfully.
- Backend JavaScript syntax checks, backup-script syntax check, and `git diff --check` pass.

## Phase 1/3 — real vehicle artwork, smooth live movement, and clean live map

- Replaced the three vehicle marker assets with the supplied transparent artwork and compressed each to approximately 54–60 KB.
- Calibrated artwork offsets per type: car `-125°`, bike `-130°`, truck `-120°`; each value points the visible nose north when the course is `0°`.
- Live markers now normalize heading changes to the shortest `[-180°, 180°]` turn, transition rotation over `800ms`, and interpolate each GPS position over the same `800ms` window.
- Replaced shared vehicle glyphs in client, subscription, maintenance, and admin surfaces with the shared `markerFor()` artwork.
- Removed the global live-map live-status pill, auto-follow overlay button, status legend, route/replay action, and persistent bottom device strip. Added the compact `أجهزتي` / `Mes appareils` launcher and sheet.
- Replaced generic Google Maps and Waze action glyphs with local brand-mark SVG icons while preserving the existing navigation URLs.
- Unified battery thresholds across live markers, device lists, device detail, and admin client detail: above 60% green, above 30% amber, otherwise red; unknown values remain slate.
- Checklist: backend command logic, Traccar, database schema, authentication/session, subscriptions, GPS-await state, speed units, replay, reports, alerts, settings, and engine RELAY command code were not changed. Live-map build path remains intact; engine-cut behavior remains in its existing handler.
- Verification: `pnpm install` completed, `npm run build` passed, `node --check backend/src/routes/map.js` passed, and `git diff --check` passed.

## Replacement vehicle map icons — natural mobile sizing

- Replaced `src/assets/bike-marker.png`, `src/assets/car-marker.png`, and `src/assets/truck-marker.png` with the three supplied top-down images. Each was trimmed to the visible vehicle, kept as RGBA PNG, and resized to a 256px maximum dimension; final files are approximately 41 KB, 54 KB, and 31 KB.
- Verified the processed PNGs have transparent alpha pixels around the vehicles, so no white map tile box or opaque background is introduced. The white truck body remains opaque vehicle artwork, not background.
- Set natural default live-marker artwork sizes to bike `28×46px`, car `34×50px`, and truck `40×58px`; selected devices receive a small bounded `+6/+8px` emphasis.
- Centered the Leaflet anchor horizontally and vertically on each vehicle artwork. Preserved the existing `requestAnimationFrame` position interpolation, shortest-turn rotation, status label, trail, and auto-follow behavior.
- Updated the artwork heading offsets to `0°` because all supplied images point up at bearing `0°`; the existing `transform: rotate(bearing)` path remains intact.
- Backend, Traccar, database schema, WebSocket feed, engine-cut commands, replay logic, and unrelated UI were not changed.

## Revised larger mobile marker sizing

- Kept the three processed supplied vehicle images at the exact shared asset paths with transparent RGBA backgrounds and sub-60 KB file sizes.
- Replaced the previous small live-marker dimensions with named `MARKER_SIZE` constants: bike `42px`, car `48px`, and truck `56px` wide. `SELECTED_BOOST` is `8px`.
- Derived each marker height from its processed image aspect ratio so the taller artwork stays proportional and is never squashed. The constants are used for the rendered artwork dimensions, icon size, and centered Leaflet anchor.
- Preserved the existing bearing rotation, shortest-turn smoothing, position interpolation, WebSocket updates, engine-cut path, replay behavior, and map interaction logic. No backend, Traccar, or database changes were made.

## Professional polish — Arabic street labels via Geoapify

- Changed the default non-satellite street provider in `src/components/MapLayers.jsx` from raw OSM to the existing `GeoapifyTileLayer` proxy, so Arabic/Maghreb labels use the configured Geoapify map style instead of garbled raw OSM glyphs.
- Reused the existing server-side `GEOAPIFY_API_KEY` path through `/api/map/tiles`; no key was hardcoded or exposed in browser code. The current proxy supports style selection, not a language query parameter, so no backend change was needed.
- Preserved the fallback rotation: normal street maps fall back to OSM, while satellite maps continue Esri → Geoapify hybrid → OSM on tile errors. The map style/color change is expected.
- Backend, Traccar, database schema, engine-cut, replay, WebSocket, subscriptions, and marker movement logic were not changed.