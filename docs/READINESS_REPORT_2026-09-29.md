# ATHAR GPS — store readiness report (2026-09-29)

## Verdict
- **Product / code: ready.** Web app, phone app, server and engine cut/resume verified.
- **Google Play: ready to upload as soon as the owner supplies 4 things** (developer account, signing key secrets, real contact details, demo account). Nothing else in the code blocks it.
- **App Store: not built yet.** Needs an Apple account and a Mac / macOS runner (see `docs/APP_STORE_RELEASE.md`).

## What was found and fixed in this pass
1. **Phone app could not reach the server** (it called relative `/api` from `https://localhost`). Now uses `https://athargps.com/api` + WebSocket; server CORS allows the Capacitor origins; share links use the public site. Tested (native simulation, 4 new backend tests).
2. **Android builds had been failing since 4 Sep** (package index, SDK action crash). Fixed; builds pass again, so phones can finally get the new code.
3. **No signed release / rising version**: workflow now produces a signed `.aab` (+ `.apk`), `versionCode = 1000 + run`, target SDK 35 (one line to change). Dry run with a throwaway key: debug APK, signed AAB and signed APK all built and verified.
4. **appId** changed to `com.athargps.app` (permanent once on the store).
5. **Store requirements**: public account-deletion page (`/account-deletion`, AR/FR), legal links in Settings, screenshots + feature graphic + icon in `store-assets/`, listing texts and data-safety answers in `docs/STORE_LISTING.md`.

## Verification
- Backend: 287 of 288 tests pass. The single failure is an old test file written in the wrong module style (`vehiclesPageLayout.test.js`, unrelated to our changes). `refreshSession.test.js` passes but keeps the process open (old, unrelated).
- Browser: engine cut / resume with password (client card, queue, sent, wrong password, admin), native-mode simulation, production build — all pass, no console errors.
- Engine code (`engineCommands.js`, `passwordConfirm.js`, `useEngineControl.js`) is **identical to main**: untouched.

## Owner-only items
1. Google Play developer account (25 USD) + closed test (12 testers, 14 days) for a new personal account.
2. Create the signing key and the 4 GitHub secrets (`docs/PLAY_STORE_RELEASE.md`).
3. Real privacy e-mail / phone / date (currently placeholders in Privacy, Terms, Account deletion).
4. A demo client account for the store reviewers.
5. Confirm the appId `com.athargps.app`.
6. Server hygiene (not a store blocker, but important for real customers): more RAM than 1 GB, off-server backups, e-mail service (Resend).
7. iOS: Apple account, Mac or macOS runner + certificates. Review risk: guideline 4.2 (mention the full fleet features in the review notes).
8. Merge this branch to `main` (needs the owner's explicit go-ahead) — the phone build and site update come from `main`.
