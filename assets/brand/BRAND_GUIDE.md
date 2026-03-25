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

Adaptive icons are masked (circle/squircle). The foreground `./assets/adaptive-icon.png` must keep important artwork inside the **central safe circle** (~66% of the 1024×1024 canvas). Full-bleed art looks zoomed or cropped. Regenerate from the master square with `npm run assets:android-adaptive-icon`, then `npx expo prebuild --platform android`.
