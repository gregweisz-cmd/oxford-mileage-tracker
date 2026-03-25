# Tester packet screenshots

These PNGs are referenced by **`docs/deployment/ALPHA_TESTER_PACKET.md`** and **`BETA_TESTER_PACKET.md`** and are embedded when you run **`npm run docs:pdf:tester-packets`**.

Save files **exactly** as named below (paths relative to this folder).

| Filename | What to capture |
|----------|-----------------|
| `ios-app-store-testflight.png` | **App Store** on iPhone: the **TestFlight** app listing (GET / Open) — from [Apple’s TestFlight link](https://apps.apple.com/us/app/testflight/id899247664) or search “TestFlight.” |
| `ios-testflight-oxford-app.png` | **TestFlight** app: **Oxford House Expense Tracker** on the detail screen showing **Install** or **Update** (and build/version if visible). |
| `android-internal-test-landing.png` | After opening the **internal testing** link on Android: the **first meaningful screen** — e.g. Play Store tester opt-in, “You’re a tester,” or browser → Play (layout varies). |
| `android-play-internal-test-update.png` | **Play Store** app listing for the internal test build when an **Update** is available (blue **Update** button, optional “unreviewed” / test-build disclaimer). |

**Tips**

- Use a **real device** or current OS simulator so UI matches what testers see.
- **No sensitive data** in screenshots (blur emails/account info if needed).
- Re-run **`npm run docs:pdf:tester-packets`** after replacing any file so the PDFs pick up new images.
- In the generated PDF, each screenshot appears **beside** its caption (flex row), at about **1.55in** wide — see `docs/deployment/tester-packet.css` (`.screenshot-with-caption`).
