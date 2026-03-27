/**
 * Sync Android launcher mipmaps from the company logo (assets/icon.png).
 * Full-bleed per density (`fit: 'cover'`) so the logo fills each launcher bitmap,
 * matching the adaptive foreground built by pad-android-adaptive-icon.js.
 * Flatten to white first so Android visual matches iOS square icon.
 */
const path = require('path');
const sharp = require('sharp');

const REPO = path.join(__dirname, '..');
/** Master app / company logo — keep in sync with expo.icon and adaptive-icon source. */
const ICON = path.join(REPO, 'assets', 'icon.png');
const RES = path.join(REPO, 'android', 'app', 'src', 'main', 'res');
const SCALE = 0.5625;

const FOREGROUND_PX = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

const LEGACY_PX = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function writeWebp(size, outPath) {
  const target = Math.max(1, Math.round(size * SCALE));
  const logo = await sharp(ICON)
    .flatten({ background: '#FFFFFF' })
    .resize(target, target, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: '#FFFFFF',
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .webp({ quality: 95 })
    .toFile(outPath);
}

async function main() {
  for (const [folder, px] of Object.entries(FOREGROUND_PX)) {
    const base = path.join(RES, folder);
    await writeWebp(px, path.join(base, 'ic_launcher_foreground.webp'));
  }
  for (const [folder, px] of Object.entries(LEGACY_PX)) {
    const base = path.join(RES, folder);
    await writeWebp(px, path.join(base, 'ic_launcher.webp'));
    await writeWebp(px, path.join(base, 'ic_launcher_round.webp'));
  }
  console.log('Synced Android launcher mipmaps from assets/icon.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
