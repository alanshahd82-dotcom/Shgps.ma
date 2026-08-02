---
name: Docker Alpine npm install breakage
description: package-lock.json generated outside Alpine breaks npm install inside Docker — causes Cannot find package express error
---

## Rule
Never commit `backend/package-lock.json` to git. Running `npm install` locally (in Replit/Ubuntu) creates a lockfile with platform-specific entries that breaks `npm install --production` inside `node:20-alpine` Docker containers.

**Why:** Alpine uses musl libc; lockfiles generated on glibc systems can lock platform-specific binary resolutions that fail or produce empty node_modules inside Alpine Docker builds, causing `Cannot find package 'express'` at runtime.

**How to apply:**
- `backend/.dockerignore` must exclude `package-lock.json` (already added)
- `backend/Dockerfile` must use `COPY package.json ./` (not `package*.json`) so lockfile is never copied
- If server still has stale `package-lock.json`: `rm -f backend/package-lock.json` before rebuild
- Always run `docker compose build --no-cache backend` after Dockerfile changes
