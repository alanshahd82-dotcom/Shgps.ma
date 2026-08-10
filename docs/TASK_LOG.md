# Athar GPS — Task Log

This file records the completed replay-related work and the current import audit fix.

## Completed tasks

- `0c64756` — Add positions endpoint for trip replay (`GET /api/stats/positions`)
- `eb9e5d6` — Add bilingual trip replay with stop and speed analysis (`TripReplay` component plus client and admin integration)
- `639fedb` — Fix trip replay startup and timeline playback
- Current task — Fix missing `lucide-react` imports and add living project documentation
- Current task — Professional replay UI overhaul: contrast, marker, layout, chart
- Current task — Redesign replay screen: map-first layout, real rotating car, clean sheets

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

## Car heading calibration and satellite replay map

- Calibrated the provided blue Mercedes asset with `CAR_ASSET_HEADING_OFFSET = -135°` in replay and live vehicle markers. The acceptance mapping is now bearing 0° → nose up, 90° → right, and 180° → down.
- Added a replay map-style toggle sharing `athargps_map_style` with the live map, defaulting to Esri World Imagery satellite tiles when no style has been selected.
- Added white route casing, green traveled-route emphasis, fading 15-point motion trail, imagery-friendly marker outlines, and speed readout colors: green below 50 km/h, orange from 50–80 km/h, and red above 80 km/h.

## Verification

- `npm run build` passes.
- `git diff --check` passes.

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