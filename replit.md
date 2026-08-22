# ATHAR GPS

ATHAR GPS is a bilingual Morocco-focused vehicle-tracking platform with client, admin, and public map experiences.

## Run & Operate

- Frontend development: `npm run dev`
- Frontend production build: `npm run build`
- Backend development: `cd backend && npm run dev`
- Documented backend port: `3001`
- Documented production path: `/opt/shgps` — live VPS status is `[UNCONFIRMED]`
- Required environment variables and secrets are documented by `.env.example` files; never place secret values in source or documentation.

## Stack

- Frontend: React, Vite, React Router, Tailwind CSS, Leaflet/react-leaflet, Recharts, Framer Motion
- Backend: Node.js and Express
- Database: PostgreSQL
- Tracking: Traccar
- Deployment: Docker Compose and Nginx; frontend output is `dist/`

## Where things live

- `src/` — frontend source of truth
- `index.html` → `src/main.jsx` → `src/App.jsx` — frontend entry point
- `backend/` — API, auth, database, and Traccar integration
- `backend/src/db/` — database schema and migrations
- `src/api/index.js` — frontend API client
- `src/i18n/translations.js` — Arabic/French translations
- `src/components/TripReplay.jsx` — replay engine
- `nginx/` — reverse-proxy configuration
- `docs/AI_CONTEXT.md` — authoritative project context and operating rules
- `docs/TASK_LOG.md` — chronological historical task record
- `.agents/memory/` — focused durable lessons and pointers

## Architecture decisions and working rules

- ATHAR GPS is an existing production project; preserve its architecture and make the smallest scoped change.
- Frontend-only work must not modify backend, database, Traccar, API contracts, authentication, WebSocket behavior, Docker, or deployment.
- Verify repository and branch before changes, and verify current state before dangerous commands.
- Preserve Arabic RTL, French LTR, and existing user-facing translation patterns.
- Do not randomly modify lockfiles or unrelated files.
- Mark uncertain facts `[UNCONFIRMED]`; current verified state takes priority over historical notes.
- Never expose or store secrets. Use the Replit secrets flow and placeholders in documentation.
- Read `docs/AI_CONTEXT.md` and relevant history in `docs/TASK_LOG.md` before substantial work.

## Product

The platform supports client vehicle monitoring, live maps, device details, trip history and replay, alerts, geofences, maintenance, reports, subscriptions, and admin management.

## Replit operating rules

Replit is an execution environment, not the permanent memory source. Every future task must include the repository, branch, project root, source root, verified state, exact scope, files that must not change, validation steps, build requirement, Git requirement, commit requirement, push requirement, and final report format.

## Pointers

- Read `docs/AI_CONTEXT.md` first for the full project context and red lines.
- Append important historical work to `docs/TASK_LOG.md`; do not delete old completed entries.