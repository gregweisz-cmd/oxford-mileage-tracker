# TestFlight Setup Checklist (iOS)

Use this checklist once your **Apple Developer Program** membership is active. TestFlight is part of the Apple Developer Program ($99/year)—you need the paid account before you can use TestFlight.

The project is already configured for EAS Build and EAS Submit; these steps get you from “license approved” to testers in TestFlight.

---

## Prerequisites

- [ ] **Apple Developer Program** enrolled and active
- [ ] **Expo / EAS CLI** installed: `npm install -g eas-cli`
- [ ] Logged in to EAS: `eas login` (use your Expo account)
- [ ] **App Store Connect** access with the same Apple ID as your developer account

---

## 1. Create the app in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com/) → **Apps** → **+** → **New App**.
2. Choose **iOS**.
3. Fill in:
   - **Name:** Oxford House Expense Tracker (or your chosen name)
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** Select the one that matches the app: **com.oxfordhouse.ohstafftracker** (create it in [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) if it doesn’t exist)
   - **SKU:** e.g. `oh-staff-tracker-001`
4. Create the app and note the **Apple ID** (numeric). You’ll use this as **App Store Connect App ID** in EAS Submit (see step 4).

---

## 2. Configure EAS Submit with your App Store Connect App ID

1. In App Store Connect, open your app → **App Information** (under General). The **Apple ID** is the numeric “App Store Connect App ID” (e.g. `1234567890`).
2. In this repo, open **`eas.json`** and replace the placeholder in `submit.production.ios.ascAppId` with your app’s numeric Apple ID (e.g. `"1234567890"`).
3. Save the file. If the repo is public, consider keeping the placeholder in the repo and setting the real ID only in a local override or via environment so it isn’t committed.

---

## 3. Build the iOS app for TestFlight

From the project root (where `eas.json` and `app.json` live):

```bash
eas build --platform ios --profile production
```

- EAS will use your **production** profile and produce an **App Store** build (suitable for TestFlight).
- First time: you’ll be asked to create/select an Apple Team and possibly sign in with Apple. Follow the prompts.
- Wait for the build to finish on the EAS dashboard. You’ll get a build URL and build ID.

Optional: submit the **latest** production build to TestFlight as soon as the build completes:

```bash
eas build --platform ios --profile production --auto-submit
```

---

## 4. Submit the build to TestFlight

If you didn’t use `--auto-submit`:

```bash
eas submit --platform ios --latest --profile production
```

Or submit a specific build:

```bash
eas submit --platform ios --id <BUILD_ID> --profile production
```

- **First time:** EAS may ask for your Apple ID and an **App-Specific Password** (create one at [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords). You can also use an [App Store Connect API key](https://docs.expo.dev/submit/ios/#using-app-store-connect-api-key) for automation.
- The build is uploaded to App Store Connect and then appears in **TestFlight** for that app (usually within a few minutes to an hour).

---

## 5. Enable TestFlight and add testers

1. In **App Store Connect** → your app → **TestFlight** tab.
2. Wait until the build shows **Ready to Submit** (or **Processing** → **Ready**). Internal testers can often use the build as soon as it appears.
3. **Internal testing** (up to 100 team members with App Store Connect access):
   - **TestFlight** → **Internal Testing** → create a group if needed → add testers by email.
4. **External testing** (optional, for people outside your team):
   - **TestFlight** → **External Testing** → create a group → add the build → add testers by email. The first build for external testing requires a short **Beta App Review** by Apple.

Testers receive an email from Apple with a link to install **TestFlight** from the App Store and then install your app from TestFlight.

---

## 5.5 App Store metadata to prepare now (before release)

Even while testing in TestFlight, prepare these values now so App Store submission is smooth:

- **Privacy Policy URL:** `https://oxford-mileage-tracker.vercel.app/privacy-policy.html`
- **Support URL:** `https://oxford-mileage-tracker.vercel.app/support.html`
- **Marketing URL (optional):** company website URL (if desired)

In App Store Connect, these are typically entered under your app record in:
- **App Information** (Privacy Policy URL)
- **App Review Information** (Support/Contact fields)

If legal provides updated policy text, update `admin-web/public/privacy-policy.html`, redeploy, and keep the same URL.

---

## 6. Version and build numbers for future builds

- **Version** (e.g. `1.0.0`) is in **`app.json`** → `expo.version`. Bump it when you want a new “marketing” version (e.g. 1.0.1, 1.1.0).
- **Build number** is usually managed by EAS (auto-increment) or set in `app.json` under `expo.ios.buildNumber`. Each TestFlight/App Store upload needs a new build number.

After changing version (or build number if you set it manually), run:

```bash
eas build --platform ios --profile production
eas submit --platform ios --latest --profile production
```

(Or use `--auto-submit` on the build command.)

---

## Quick reference

| Step | Command / action |
|------|-------------------|
| Build for TestFlight | `eas build --platform ios --profile production` |
| Build + submit | `eas build --platform ios --profile production --auto-submit` |
| Submit last build | `eas submit --platform ios --latest --profile production` |
| App Store Connect | [appstoreconnect.apple.com](https://appstoreconnect.apple.com) |
| EAS dashboard | [expo.dev](https://expo.dev) → your project → Builds |

---

## Troubleshooting

- **“No valid signing certificate”** – Run the build again and follow EAS prompts to create/select an Apple Team and let EAS manage credentials.
- **“App not found” / ascAppId** – Ensure the app exists in App Store Connect and that `ascAppId` in `eas.json` matches the app’s **Apple ID** (numeric).
- **Testers don’t see the build** – Confirm the build is in the **TestFlight** tab and that the tester was added to the correct Internal (or External) group.
- **Bundle ID mismatch** – The app’s Bundle ID in Xcode/Expo must be **com.oxfordhouse.ohstafftracker** (see `app.json` → `expo.ios.bundleIdentifier`). It must match the app record in App Store Connect.

Once your Apple Developer license is active, you can go through this checklist to get builds into TestFlight quickly.
