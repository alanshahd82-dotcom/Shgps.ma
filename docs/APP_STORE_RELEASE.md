# Publishing ATHAR GPS on the Apple App Store

Status: **not built yet** — needs things only the owner can provide.

## What is needed
1. Apple Developer Program account (99 USD / year).
2. A Mac with Xcode, **or** a GitHub `macos-latest` runner with certificates stored as secrets (distribution certificate `.p12` + password, provisioning profile, App Store Connect API key).
3. The iOS project is created with `npx cap add ios` (Capacitor 6 is already in the project). Bundle id to use: `com.athargps.app`.

## Before the first upload
- Website origin inside the iOS app is `capacitor://localhost`; the server already allows it (CORS) and the app calls `https://athargps.com/api` directly.
- Add usage text in `Info.plist`: `NSLocationWhenInUseUsageDescription` ("Show your position on the map").
- App icon 1024x1024 (no transparency) and screenshots for 6.7" and 6.5" iPhones (same style as `store-assets/`).
- Privacy policy and account deletion URLs are the same as Google Play. Apple requires **in-app account deletion** (guideline 5.1.1(v)): the app has a link to the deletion page in Settings; if review insists, a delete button must be added.
- Give Apple a demo account in "App Review Information".

## Known review risk
Guideline 4.2 ("minimum functionality") is sometimes applied to apps that are only a website in a frame. ATHAR GPS is a full fleet tool (live map, engine control, alerts, reports, native location), which normally passes; the review notes should say so.
