# Athar GPS — AI Project Context

## Project overview

Athar GPS is a bilingual vehicle-tracking system for Morocco. It includes a client application for monitoring assigned vehicles, an administrator panel for managing clients and devices, and a public landing/share experience. Arabic is the primary RTL language and French is also supported.

## Technology stack

- Frontend: React, Vite, React Router, Leaflet, `react-leaflet`, `lucide-react`, `framer-motion`, Recharts
- Backend: Node.js and Express on port `3001`
- Database: PostgreSQL 16
- Tracking: Traccar running in Docker
- Deployment: Docker Compose and Nginx
- Frontend output: Vite builds to `dist/`

## Current source tree

The following is the current source tree for `src` and `backend`:

```text
backend/Dockerfile
backend/.dockerignore
backend/.env.example
backend/package.json
backend/src/config.js
backend/src/db/create-user.js
backend/src/db/init.js
backend/src/db.js
backend/src/db/migrate-audit-log.js
backend/src/db/migrations/002_geonix_features.sql
backend/src/db/migrations/003_sub_users.sql
backend/src/db/schema.sql
backend/src/env.js
backend/src/index.js
backend/src/middleware/auth.js
backend/src/middleware/requireRole.js
backend/src/routes/admin.js
backend/src/routes/alerts.js
backend/src/routes/auth.js
backend/src/routes/clients.js
backend/src/routes/devices.js
backend/src/routes/driverBehavior.js
backend/src/routes/geofences.js
backend/src/routes/leads.js
backend/src/routes/maintenance.js
backend/src/routes/map.js
backend/src/routes/reports.js
backend/src/routes/settings.js
backend/src/routes/sharing.js
backend/src/routes/stats.js
backend/src/routes/subAdmins.js
backend/src/routes/subUsers.js
backend/src/services/auditLog.js
backend/src/services/subscriptions.js
backend/src/services/supportSettings.js
backend/src/services/tokenBlacklist.js
backend/src/services/traccar.js
backend/src/setup-admin.js
backend/src/validation/schemas.js
src/api/index.js
src/App.jsx
src/components/Carousel.jsx
src/components/ClientHeader.jsx
src/components/ClientNav.jsx
src/components/ConfirmModal.jsx
src/components/ForcePasswordModal.jsx
src/components/GeoapifyTileLayer.jsx
src/components/Logo.jsx
src/components/MapView.jsx
src/components/SubscriptionBadge.jsx
src/components/SubscriptionBanner.jsx
src/components/SubscriptionPlans.jsx
src/components/SubscriptionRenewalModal.jsx
src/components/TripReplay.jsx
src/components/ui/Button.jsx
src/components/ui.jsx
src/config/support.js
src/context/AppContext.jsx
src/i18n/translations.js
src/index.css
src/main.jsx
src/pages/admin/AdminAlerts.jsx
src/pages/admin/AdminLayout.jsx
src/pages/admin/AdminLogin.jsx
src/pages/admin/AllDevices.jsx
src/pages/admin/ClientDetail.jsx
src/pages/admin/Clients.jsx
src/pages/admin/Dashboard.jsx
src/pages/admin/DeviceSetup.jsx
src/pages/admin/GlobalMap.jsx
src/pages/admin/Leads.jsx
src/pages/admin/SubAdmins.jsx
src/pages/admin/SupportSettings.jsx
src/pages/client/Alerts.jsx
src/pages/client/ClientWelcome.jsx
src/pages/client/DeviceDetail.jsx
src/pages/client/DeviceList.jsx
src/pages/client/DeviceWizard.jsx
src/pages/client/DriverBehavior.jsx
src/pages/client/ForgotPassword.jsx
src/pages/client/Geofences.jsx
src/pages/client/Help.jsx
src/pages/client/Home.jsx
src/pages/client/LiveMap.jsx
src/pages/client/Login.jsx
src/pages/client/Maintenance.jsx
src/pages/client/Reports.jsx
src/pages/client/ResetPassword.jsx
src/pages/client/Settings.jsx
src/pages/LandingPage.jsx
src/pages/NotFound.jsx
src/pages/Privacy.jsx
src/pages/PublicMap.jsx
src/pages/PublicShare.jsx
src/pages/SplashScreen.jsx
src/pages/Terms.jsx
src/utils/subscriptions.js
```

## Key file map

- Client device page, trip history, and replay button: `src/pages/client/DeviceDetail.jsx`
- Client live map: `src/pages/client/LiveMap.jsx`
- Admin global map and replay controls: `src/pages/admin/GlobalMap.jsx`
- Replay engine: `src/components/TripReplay.jsx`
- Backend replay endpoint: `backend/src/routes/stats.js` — `GET /api/stats/positions`
- Traccar service: `backend/src/services/traccar.js`
- API client: `src/api/index.js`
- Translations: `src/i18n/translations.js`

## Design tokens and conventions

- Primary navy: `#0F2044`
- Accent green: `#1DBF73` / `#00D97E`
- Warning orange: `#FF9500`
- Cards use `rounded-2xl`
- The interface is mobile-first
- Preserve Arabic RTL and French translations in every user-facing feature

## Red lines

- Never modify the Traccar server as part of frontend or application feature work.
- Never change the database schema without an explicit request.
- Never modify unrelated files or refactor unrelated code.
- Keep the existing authentication and authorization middleware.
- Keep Arabic RTL and French language support.
- Use existing dependencies unless a dependency change is explicitly requested.

## Deployment notes

- Production path on the VPS: `/opt/shgps`
- Production runs through Docker Compose.
- The frontend is built with Vite to `dist/`, which is served by Nginx.
- Restart the backend with `docker compose restart backend`.
- The backend service listens on port `3001`.

## A. PROJECT CONTEXT — authoritative summary

- Project: ATHAR GPS, a bilingual Morocco-focused vehicle-tracking platform.
- Repository: `alanshahd82-dotcom/Shgps.ma`.
- Primary branch: `main`.
- Project root in this workspace: `/home/runner/workspace`.
- Frontend source of truth: `src/`.
- Frontend entry point: `index.html` → `src/main.jsx` → `src/App.jsx`.
- Frontend build output: `dist/`, served by Nginx in the documented Docker deployment.
- Backend source of truth: `backend/`; it is a Node.js/Express service exposing the application API.
- Tracking source of truth: Traccar, integrated through the backend service.
- Database source of truth: PostgreSQL schema and migrations under `backend/src/db/`.
- Deployment source of truth: `Dockerfile`, `docker-compose.yml`, and `nginx/`.
- Certbot configuration: [UNCONFIRMED — no current Certbot configuration was verified in this workspace].
- Documented production path: `/opt/shgps`; live production reachability and service status are [UNCONFIRMED].
- Relationship: the frontend calls the backend API; the backend owns authentication, database access, Traccar communication, WebSocket behavior, and server-side policy; Nginx serves the frontend and proxies the deployed services.

Important directories:

- `src/` — React client and admin interfaces.
- `backend/` — API, authentication, database, and Traccar integration.
- `lib/` — shared generated/API/database libraries present in the repository.
- `dist/` — generated Vite frontend output.
- `nginx/` — reverse-proxy configuration.
- `docs/` — project context and historical task records.
- `.agents/memory/` — durable agent lessons and pointers, not a replacement for project documentation.

## B. TASK LOG — pointer

The chronological historical record is retained in `docs/TASK_LOG.md`. New important work must be appended there; old entries must remain marked as historical when they no longer describe the current state.

## C. KNOWN ISSUES / LESSONS LEARNED — pointer

Verified lessons are retained in this file's historical sections and in the focused topic files under `.agents/memory/`. In particular, map changes must remain additive and surgical, replay timing must preserve equal timestamps, and electrical disconnect alerts require explicit electrical telemetry. Do not invent or silently remove lessons.

## D. CURRENT VERIFIED STATE — 2026-08-22 map fallback audit

- Repository: verified as `alanshahd82-dotcom/Shgps.ma`.
- Branch: verified as `main`.
- Local HEAD: frontend map fallback repair and documentation audit; verify the
  final hash from `git log` after pushing.
- The non-satellite map path now starts with the existing keyless street-tile
  proxy before optional third-party tile sources.
- The client Geofences editor shares `MapLayers` with Device Detail and Trip
  Replay instead of mounting the optional Geoapify proxy directly.
- Settings dark-mode state is synchronized through `AppContext`; no separate
  reachable legacy dark route was found during the screen audit.
- This task changes only frontend source and project documentation. Backend,
  database, Traccar, Docker, deployment, API contracts, and WebSocket behavior
  remain unchanged.

### Historical information

- Earlier task entries describe prior UI, telemetry, replay, security, and deployment investigations. They remain historical records and must not be read as proof of current production health.
- The last recorded frontend build passed during a preceding application task; no build is required for this documentation-only synchronization.

### [UNCONFIRMED]

- Production deployment, VPS service health, live Traccar reachability, physical relay movement, physical battery tests, and current production behavior remain unconfirmed unless a recent task entry explicitly records a verification.
- Certbot configuration remains unconfirmed.

- Current map issue addressed: key-dependent basemap failure could leave
  Geofences and replay surfaces dark or blank; the frontend fallback path is
  now keyless-first.
- Current documentation state: this audit is synchronized with the source
  changes and must be kept alongside the final pushed commit.
- Next step: verify the final commit and remote branch, then future work must
  begin by rereading this context, checking the repository/branch/Git state,
  and defining a self-contained scope.

## D1. CURRENT VERIFIED STATE — 2026-08-22 vehicle experience consolidation

- Client vehicle entry points now converge on the existing `DeviceDetail`
  implementation; the legacy competing `VehicleControl` route is no longer
  reachable from client navigation.
- The client all-vehicles map reuses `MapLayers` and `LiveVehicleMarker`, with
  source vehicle artwork and speed labels shown only when telemetry provides
  speed. Marker selection opens the existing vehicle detail flow.
- Device Detail's existing map now exposes browser fullscreen, and replay range
  choices are today, 2 days, 3 days, 7 days, 1 month, or custom.
- The supplied ATHAR app icon is the referenced icon for HTML/PWA entry points;
  the supplied engine-stop artwork is used by the existing engine command.
- This task remains frontend-only: backend, database, Traccar, API contracts,
  authentication, WebSocket behavior, Docker, and deployment were unchanged.
- Build and remote Git result must be verified after the final commit; production
  behavior and physical engine/telemetry behavior remain `[UNCONFIRMED]`.

## E. WORKING RULES

- ATHAR GPS is an existing production project; do not rebuild its architecture from scratch.
- Verify repository and branch before modifying code or documentation.
- Keep frontend tasks frontend-only unless another layer is explicitly required.
- Do not modify backend, database, Traccar, API contracts, authentication, WebSocket behavior, Docker, or deployment during a frontend-only task.
- Do not modify lockfiles randomly or refactor unrelated files.
- Read permanent project memory before substantial work; verified current state takes priority over historical notes.
- Mark uncertain information as `[UNCONFIRMED]`.
- Preserve Arabic RTL, French LTR, and user-facing translations.
- Check local changes before dangerous Git operations; never use `git reset --hard` blindly or delete directories without checking dependencies.
- Never expose or store secrets. Use placeholders such as `GITHUB_TOKEN=[SECRET]`.
- Do not repeat a failed approach without a reason; record durable lessons after important work.

## F. REPLIT OPERATING RULES

Replit is an execution environment and agent, not the permanent memory source. Every future task must be self-contained and state its repository, branch, project root, source root, verified state, exact scope, files that must not change, validation, build requirement, Git/commit/push requirement, and final report format.

Future sessions must read this permanent project memory first, compare it with the latest verified repository state, analyze results before giving the next command, avoid repeating documented failures, and update the relevant context, task log, lessons, and current state after important completed work. ChatGPT/Replit must not rely on an earlier conversation being available.