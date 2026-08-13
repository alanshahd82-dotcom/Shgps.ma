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