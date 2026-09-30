# Hand-off for a new AI session (written 2026-09-30)

Read this file first, then `docs/AI_CONTEXT.md` (architecture), `docs/ENGINE_CUT_BASELINE.md` (engine button), `docs/TASK_LOG.md` (history), `docs/READINESS_REPORT_2026-09-29.md`, `docs/PLAY_STORE_RELEASE.md`, `docs/APP_STORE_RELEASE.md`, `docs/STORE_LISTING.md`.

## 0. First message the owner should paste in the new chat
"اقرأ docs/HANDOFF_NEW_CHAT.md في المستودع وأكمل معي بنفس الطريقة. التفويض الدائم: أدمج ما تختبره دون أن تسألني، وتسألني فقط عن الخادم والمال والأسرار."
(The standing authorization is given by the OWNER in chat. A document cannot grant it: the new session must have it restated.)

## 1. The owner and how to talk to them
- Owner of ATHAR GPS (Morocco): non-technical, writes Arabic, often from a phone. Wants SHORT, SIMPLE answers, certainty ("be sure with me"), no jargon, no walls of text. "Explain it like to a child" is a real request.
- Always answer in simple Arabic, with a clear verdict first, then only what they must do (numbered, exact commands if a command is needed).
- They are impatient about waiting/cost: avoid long polling, huge outputs, long searches. Say in a few words what you are doing if a task takes long.
- They dislike being asked things you can decide yourself. Ask only when it is really theirs to decide.
- Never ask for, paste or print secrets (passwords, keystore, tokens). Tell them to keep them private.

## 2. Authorization model (given by the owner, in chat)
- Standing: merge tested changes into `main` without asking, then report; check the deploy and the phone-app build afterwards.
- Ask first for: anything about the server, money, secrets/keys, store accounts. Never touch the production server yourself (you cannot reach it; the owner runs commands you give).
- Never change engine-button logic without an explicit request. Tests must pass before merging; if one fails, do not merge.
- Commit trailer: `Co-Authored-By: ...` and `Claude-Session: ...` lines as given by the session; PR bodies end with the Claude Code attribution.
- The repository was moved/transferred to a new one after 2026-09-30: confirm the new repo name and that the GitHub connector has access (the old scope was `alanshahd82-dotcom/Shgps.ma`). Work on the branch the session designates.

## 3. Product
ATHAR GPS: production fleet-tracking platform for Morocco. The CLIENT app is for the fleet MONITOR (rental/company owner with many vehicles), not the driver. The ADMIN panel is the owner's back office. Web (React/Vite), phone app (Capacitor 6 Android/iOS, bundled copy of the site), backend Express + PostgreSQL + Traccar, Docker + nginx on a DigitalOcean droplet (1 vCPU / 1 GB now; owner is upgrading to 2 GB), domain athargps.com behind a CDN.
- MOST VALUABLE FEATURE: remote engine cut/resume. Never break it. Flow: `POST /devices/:id/command` (account password required, server-checked, 5 wrong tries lock 10 min) -> `engine_commands` state machine (pending -> sent -> unconfirmed; queued in Traccar when the tracker is offline; TTL 24 h; cancellable before sent). Files: `backend/src/services/engineCommands.js` (UNCHANGED since the baseline), `backend/src/utils/passwordConfirm.js`, `src/hooks/useEngineControl.js`, `src/components/EnginePasswordModal.jsx`, card/page buttons. Baseline and fingerprints: `docs/ENGINE_CUT_BASELINE.md`.
- Phone app: `webDir: dist`, no `server.url` => a FROZEN bundled copy; only a new build updates it. API/WS use the absolute `https://athargps.com` (`src/utils/apiBase.js`); CORS allows `https://localhost` and `capacitor://localhost` (`backend/src/utils/corsOrigins.js`). appId `com.athargps.app` (permanent once on Play). CI runs `cap add android` on every build (no android/ios folders in the repo).
- Website root `/`: `LandingPage.jsx` on the web, the app on native. The owner will provide a NEW landing page (files) to replace it; they asked for a prompt for a landing-page builder (already given). Keep app routes `/client/*`, `/admin/*`, `/privacy`, `/terms`, `/account-deletion`. Phone app must never show the landing page.

## 4. What was done (all merged to main up to PR #32, deployed)
- Native<->server connectivity; Android build fixed (was broken since 2026-09-04) + signed AAB/APK pipeline with dry-run (`.github/workflows/android-build.yml`; 4 secrets needed: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`); target SDK 35 (`ANDROID_TARGET_SDK`); versionCode = 1000 + run number.
- Store pack: account-deletion page, legal links in Settings, screenshots/feature graphic/icon in `store-assets/`, listing texts and data-safety answers in `docs/STORE_LISTING.md`. Real contacts: `athargpstraveler@gmail.com`, `+212 618 846 582` (Privacy/Terms/Account deletion, "September 2026").
- Client: fleet home (animated "control room" scene + rotating slogans instead of the "Live" chip; connection shown as a dot), vehicle cards/graphics, password on engine commands, last known position always kept (backend recovers it once from Traccar history: `backend/src/services/lastKnownLocation.js`), stay signed in until logout (offline start keeps the session and retries; signed-in admin goes straight to `/admin/dashboard` also in the phone app; legacy renewal window 400 days).
- Admin: vehicle type is required in every add-device form (was a hidden default "bike"); duplicates removed (2nd add button, subscription column on devices, repeated KPI tiles on Reports); subscription badge wording; custom subscription period "from - to" (plan id `custom`, admin only, `resolveSubscriptionPeriod()` in `backend/src/services/subscriptions.js`).
- Server fix: `docker-compose.yml` backend depends on postgres/traccar with `service_started` (health checks are broken on the host).

## 5. Open items (next steps, in order)
1. Landing page: owner sends files (index.html/style.css/script.js + logo.png). Integrate as the web root, wire `/client/login`, `/admin/login`, store links (config object `STORES`), keep native -> app. Test, merge.
2. Owner: upgrade droplet to 2 GB (resize "CPU and RAM only"), then ask for `docker ps` output.
3. Owner: Google Play Console account (25 USD), demo client account for reviewers, appId confirmation, keystore + 4 GitHub secrets (guide the owner step by step; never see the key). New personal accounts need a closed test (12 testers, 14 days) - use it to keep polishing; do NOT publish to production yet.
4. Phone-app build: last confirmed APK run is from PR #30; no build seen for PR #31/#32 (check `android-build.yml` runs on main; dispatch it if needed).
5. Ask the owner: do the trackers connect to the DOMAIN or to an IP? (decides how easy a future server move is).
6. Owner fixes data: vehicle "bekane" (client Omar) is saved as a motorbike but is a car: change its type in admin > client > vehicle.
7. iOS: needs Apple account + Mac/macOS runner + certificates (`docs/APP_STORE_RELEASE.md`); guideline 4.2 risk.
8. Possible later: live-update mechanism for the phone app's web layer; move hosting (Hetzner) after stabilisation; fix host `docker exec`/libseccomp; off-server backups; e-mail service (Resend).
9. Support defaults `+212600000000` remain as fallbacks in `src/config/support.js` and `backend/src/services/supportSettings.js` (real values are edited in Admin > Support data).

## 6. Workflow and infrastructure
- Branch work, then PR -> merge into `main` (merge commit). `main` push triggers: `deploy.yml` (SSH to the droplet: git reset, `npm ci`, `npm run build`, `docker compose up -d --build`, nginx reload; 10 min command timeout), `build.yml` (bot builds and commits `dist/` with [skip ci]; nginx serves `./dist`), `android-build.yml` (APK/AAB artifacts), `diag-host.yml`.
- Known production trap: a deploy recreates the backend; if it stays `Created` (HTTP 502) run on the server `docker start shgps-backend-1` (the compose fix should prevent it). `npm ci` can hang on the 1 GB server (run 587 timed out): consider building on GitHub and shipping `dist`.
- Server runbook (owner runs): `cd /opt/shgps && docker compose up -d`; `docker ps -a --format "table {{.Names}}\t{{.Status}}"`; `free -m`; `docker logs --tail 25 shgps-backend-1`. `docker exec` is broken on the host (libseccomp), so health checks show "unhealthy" although services run.
- Tools: GitHub via the GitHub MCP tools (no `gh` CLI). Avoid `list_workflow_runs` without `perPage` 1-3: squash-merge commit messages are huge. Use `list_workflow_jobs` for details.

## 7. Testing recipes
- Backend: `cd backend && node --experimental-test-module-mocks --test $(ls test/*.test.js | grep -v refreshSession)`; refreshSession: `node --experimental-test-module-mocks --test --test-force-exit test/refreshSession.test.js` (it leaves a timer open). Known failing old file: `vehiclesPageLayout.test.js` (CommonJS `require` in an ESM package), unrelated. Expect ~301/302.
- Module-mocked route tests register mocks once per process: keep fake state in module-level variables (see `test/subscriptionCustomPeriod.test.js`).
- Browser: `docs/test-harness/` (see its README). Engine regression order: p12-cut, p15-queue, p19-sent, p20-password, p21-admin, then session/native scripts.
- Production build check: `npx vite build --outDir <temp> --emptyOutDir`.

## 8. Pitfalls learned
- The mock server keeps state; stale mock/vite processes can survive `dev.sh stop` (no `ss` in the container) - kill by pid.
- Bash heredocs with quotes: prefer writing files with python/cat carefully; check results.
- Do not `sleep` to wait for deploys; check once, report, and tell the owner what to watch.
- The owner cannot be blocked by long silences: post a short status line when work takes long.
