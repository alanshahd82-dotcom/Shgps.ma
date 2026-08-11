# Athar GPS — Task Log

This file records the completed replay-related work and the current import audit fix.

## Completed tasks

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