# Tester release 1.0.1 (receipt save + Android uploads)

> **Store version workflow:** See **[STORE_VERSION.md](./STORE_VERSION.md)** — run `npm run release:bump` before each new Play / TestFlight binary so `versionCode` and iOS build numbers increase automatically.

## What changed

- **Receipts (local DB):** Fixed SQLite migration so new installs include the `costCenter` column — saving a receipt no longer fails with a hidden DB error.
- **Receipt images (sync):** Android `content://` and iOS `ph://` URIs are uploaded like `file://`, so receipts sync to the server from gallery picks.
- **Android (store builds only):** `READ_MEDIA_IMAGES` + `expo-image-picker` config plugin for photo library access on newer Android versions.
- **EAS:** `production` build profile uses **`channel: "production"`** so **EAS Update** can target the same channel without a new store download.

---

## Option A — Push a JS update (no App Store / Play redownload) — **EAS Update (OTA)**

This ships **JavaScript + assets** only. Testers **force-close and reopen** the app (or wait for next launch); `expo-updates` is set to check **on load**.

**Requirements**

1. Testers must already have a **standalone** build (TestFlight / Play) built with **`expo-updates`** and your project’s **`updates.url`** (already in `app.json`).
2. The update’s **`runtimeVersion` must match** the version **baked into** that binary (from `app.json` **at build time**).  
   - Example: if you shipped **1.0.0** with `runtimeVersion: "1.0.0"`, publish the OTA for **`1.0.0`**.  
   - If you already shipped a **1.0.1** native build with `runtimeVersion: "1.0.1"`, use **`1.0.1`** instead.

**Publish the update** (from repo root, logged into EAS):

```bash
# Replace RUNTIME with the runtimeVersion of the build testers have (e.g. 1.0.0 or 1.0.1)
eas update --channel production --runtime-version RUNTIME --message "Receipt save + Android receipt image sync fixes"
```

Example if testers are still on the first store binary (`runtimeVersion` **1.0.0**):

```bash
eas update --channel production --runtime-version 1.0.0 --message "Receipt save + Android receipt image sync fixes"
```

**Note:** Builds created **before** `channel: "production"` was added to `eas.json` may be on a **different** channel. Check [expo.dev](https://expo.dev) → your project → **Updates** / **Channels**, or run `eas channel:list`, and use `--channel <name>` to match the channel your existing build uses.

**What OTA cannot change**

- **Native** changes (new permissions, new config plugins, native modules) require a **new store build** once. The receipt DB + upload fixes are **JS-only** and are fine over OTA.

---

## Option B — New store build (full native changes)

Use when you need a new **binary** (e.g. Android `READ_MEDIA_IMAGES` / `expo-image-picker` plugin not yet in testers’ build).

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

Submit if you use EAS Submit:

```bash
eas submit --platform ios --profile production --latest
eas submit --platform android --profile production --latest
```

---

## Tester instructions (after OTA or new install)

1. **Fully close** the app and open it again (or kill and relaunch) so the update applies.
2. Optional: **uninstall** first only if you want a totally clean local DB; otherwise migrations run on launch.
3. Add a receipt (camera or gallery) and confirm it saves and syncs.

## If anything still fails

- Note **platform** (iOS vs Android), **camera vs gallery**, and approximate time.
- Confirm **runtime version** and **channel** match between the published update and the installed build.
