# Brand Guide

## Colors

- **Blue**: `#1C75BC`
- **Green**: `#2BB673`

## Font

- **Primary Font**: Myriad Pro
- **Fallbacks**: Segoe UI, Arial, sans-serif

## Notes

- Store official logos, banners, and icon exports in this folder.

## Android launcher icon

- **Source of truth:** `./assets/icon.png` (Oxford House company logo — same as `expo.icon`).
- **Adaptive foreground:** `./assets/adaptive-icon.png` is generated at **1024×1024** with the logo **filling the whole square** (`fit: cover`). `android.adaptiveIcon.backgroundColor` (`#FFFFFF`) shows through any transparent areas; OEMs may still apply a circular/squircle mask at the edges.
- **Regenerate:** `npm run assets:android-adaptive-icon` (updates `adaptive-icon.png` + `android/.../mipmap-*`). Run `npx expo prebuild --platform android` if you rely on Expo to rewrite native resources from config only.
