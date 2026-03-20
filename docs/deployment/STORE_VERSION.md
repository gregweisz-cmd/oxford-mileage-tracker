# Store version numbers (Android + iOS)

Google Play and Apple require **monotonically increasing** build numbers for each upload. This repo keeps a **single source of truth** in **`app.json`**, then syncs **`android/app/build.gradle`** because EAS uses the **native `android/` folder** (values in `app.json` alone are not applied to Gradle).

## Before every store release

1. **Bump versions** (increments **Android `versionCode`**, **iOS `buildNumber`**, and by default bumps **marketing `version`** patch + **`runtimeVersion`** + `package.json`):

   ```bash
   npm run release:bump
   ```

2. **Commit** the changed files (`app.json`, `package.json`, `android/app/build.gradle`).

3. **Build**:

   ```bash
   eas build --platform android --profile production
   eas build --platform ios --profile production
   ```

### Same user-facing version, new binary only

If you only need a **new Play/TestFlight upload** without changing the **1.x.x** marketing version (e.g. rebuild):

```bash
npm run release:bump:build-only
```

This still increments **`versionCode`** and **`ios.buildNumber`** (required by stores).

### Sync only (if you edited `app.json` by hand)

```bash
npm run release:sync-version
```

## What gets updated

| File | What |
|------|------|
| `app.json` | `expo.version`, `expo.runtimeVersion`, `expo.android.versionCode`, `expo.ios.buildNumber` |
| `package.json` | `version` (matches `expo.version`) |
| `android/app/build.gradle` | `versionCode`, `versionName` (from `app.json` via sync script) |

## Notes

- **Play** rejects uploads if **`versionCode`** was already used — always bump before a **new** `.aab`.
- **iOS** `buildNumber` is in `app.json` (EAS uses it when the iOS project is generated/managed).
- **`runtimeVersion`** (Expo Updates) is set to match **`expo.version`** on full bumps; adjust manually if you use a different policy.
