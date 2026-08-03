---
name: Traccar Admin Bootstrap
description: How to create/recover the Traccar admin user on the VPS H2 database.
---

# Traccar Admin Bootstrap (VPS)

## The Rule
After any fresh deploy or volume wipe, run `scripts/ensure-traccar-admin.sh` from `/opt/shgps`. Never manually set the password hash — always let Traccar hash it via `POST /api/users`.

## Why
The H2 database stores a bcrypt hash. Manually inserting a hash produces a mismatch. The only reliable flow is:
1. Enable `registration=TRUE` via H2 Shell while Traccar is stopped.
2. Start Traccar and POST to `/api/users` (Traccar hashes the plain-text password correctly).
3. Stop Traccar, use H2 Shell to set `administrator=TRUE` and `registration=FALSE`.

## Critical: Password Drift
The `.env` password and the actual container env (`docker compose exec … printenv`) can diverge after `docker compose restart` (which does NOT re-read `.env`). Always use `docker compose down && docker compose up -d` to force env reload. The working password is in `TRACCAR_ADMIN_PASSWORD` inside the running container.
