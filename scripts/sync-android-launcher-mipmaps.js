/**
 * Sync Android launcher mipmaps directly from assets/icon.png.
 * This mirrors iOS visual treatment: same square logo, just resized per density.
 */
const path = require('path');
const sharp = require('sharp');

const REPO = path.join(__dirname, '..');
const ICON = path.join(REPO, 'assets', 'icon.png');
const RES = path.join(REPO, 'android', 'app', 'src', 'main', 'res');

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
  await sharp(ICON)
    .resize(size, size, { fit: 'cover', position: 'centre' })
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
