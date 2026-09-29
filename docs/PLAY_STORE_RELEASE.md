# Publishing ATHAR GPS on Google Play — owner checklist

Everything the code can do is already done. The steps below can only be done by the owner (they need the owner's accounts and private keys).

## 1. One-time: make the signing key (never share it, never commit it)
On any computer with Java (`keytool`):

```
keytool -genkeypair -v -keystore athar-upload.keystore -alias athar -keyalg RSA -keysize 2048 -validity 10000
```
Write down the two passwords. **Keep a backup copy of the file and the passwords in a safe place** (a lost key is painful, although Play App Signing can reset an *upload* key).

Turn the file into text: `base64 -w0 athar-upload.keystore` (Mac: `base64 -i athar-upload.keystore`).

## 2. Add 4 GitHub secrets
Repository → Settings → Secrets and variables → Actions → New repository secret:

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the text from step 1 |
| `ANDROID_KEYSTORE_PASSWORD` | store password |
| `ANDROID_KEY_ALIAS` | `athar` |
| `ANDROID_KEY_PASSWORD` | key password |

## 3. Build the store file
Actions → "Build Android APK" → Run workflow (or push to `main`). When finished, download the artifact **`ATHAR-GPS-release-aab`** (file `app-release.aab`). The version number rises by itself on every build (`versionCode = 1000 + run number`).

Test the pipeline first without secrets: run the workflow with "dry_run_signing" ticked. Its files are named `DRYRUN-NOT-FOR-STORE` and must never be uploaded.

## 4. Google Play Console
1. Create a developer account (one-time fee, 25 USD) and verify identity.
2. Create app → name "ATHAR GPS", default language, App, Free.
3. Store listing: texts in `docs/STORE_LISTING.md`, images in `store-assets/` (icon 512, feature graphic 1024x500, phone screenshots 1080x1920).
4. App content: Privacy policy `https://athargps.com/privacy`; account deletion page `https://athargps.com/account-deletion`; data safety answers and content rating in `docs/STORE_LISTING.md`.
5. App access: give Google a **demo account** (client login with a few test vehicles) — the app is login-only, reviewers cannot see anything without it.
6. Release → Production (or Closed testing first). Upload `app-release.aab`. New personal accounts must first run a **closed test with at least 12 testers for 14 days** before Production is allowed.
7. Turn on **Play App Signing** (default) when Play asks.

## 5. Things to keep in mind
- `appId` is `com.athargps.app` and is permanent once uploaded.
- Google raises the minimum *target API level* every year. It is one line at the top of `.github/workflows/android-build.yml` (`ANDROID_TARGET_SDK`, now 35).
- The phone app contains a copy of the website: **any change to the site needs a new build + a new Play release** to reach phones.
- Location permission is requested only to show the user's own position on the map.
