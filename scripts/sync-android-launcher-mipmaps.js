/**
 * Copies assets/adaptive-icon.png into android/app/src/main/res/mipmap-*
 * launcher bitmaps. EAS uses these committed files — updating only
 * assets/adaptive-icon.png is not enough for Play builds.
 *
 * Run after: npm run assets:android-adaptive-icon
 *   npm run assets:android-launcher-mipmaps
 */
const path = require('path');
const sharp = require('sharp');

const REPO = path.join(__dirname, '..');
const ADAPTIVE = path.join(REPO, 'assets', 'adaptive-icon.png');
const RES = path.join(REPO, 'android', 'app', 'src', 'main', 'res');

/** Adaptive foreground layer: 108dp → px per bucket */
const FOREGROUND_PX = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

/** Legacy / round launcher: 48dp → px */
const LEGACY_PX = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const BRAND_BG = { r: 28, g: 117, b: 188, alpha: 1 };

async function writeForegroundWebp(size, outPath) {
  await sharp(ADAPTIVE)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .ensureAlpha()
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(outPath);
}

async function writeLegacyWebp(size, outPath) {
  const fg = await sharp(ADAPTIVE)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .ensureAlpha()
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_BG,
    },
  })
    .composite([{ input: fg, gravity: 'centre' }])
    .webp({ quality: 92 })
    .toFile(outPath);
}

async function main() {
  for (const [folder, px] of Object.entries(FOREGROUND_PX)) {
    const base = path.join(RES, folder);
    await writeForegroundWebp(px, path.join(base, 'ic_launcher_foreground.webp'));
    console.log(`Wrote ${folder}/ic_launcher_foreground.webp (${px}px)`);
  }
  for (const [folder, px] of Object.entries(LEGACY_PX)) {
    const base = path.join(RES, folder);
    await writeLegacyWebp(px, path.join(base, 'ic_launcher.webp'));
    await writeLegacyWebp(px, path.join(base, 'ic_launcher_round.webp'));
    console.log(`Wrote ${folder}/ic_launcher.webp + ic_launcher_round.webp (${px}px)`);
  }
  console.log('\nDone. Rebuild the Android app (EAS) so Play picks up new mipmaps.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
