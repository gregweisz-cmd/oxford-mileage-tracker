/**
 * Regenerates assets/adaptive-icon.png for Android adaptive icons.
 *
 * Source: assets/icon.png. We trim and crop to the non-white ink bounds, then
 * scale to full 1024x1024 (cover). This keeps the mark large without aggressive
 * transparency logic that can hide the logo on some launchers.
 *
 * Run: npm run assets:android-adaptive-icon
 * Then: npm run assets:android-launcher-mipmaps (updates native res/)
 */
const path = require('path');
const sharp = require('sharp');

const CANVAS = 1024;
/** RGB channels all at/above this count as “white” for bbox + flood */
const WHITE_MIN = 248;

/**
 * @param {Buffer} data
 * @param {number} w
 * @param {number} h
 * @param {number} channels
 */
function boundingBoxNonWhite(data, w, h, channels) {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = channels >= 4 ? data[i + 3] : 255;
      if (a < 16) continue;
      if (r >= WHITE_MIN && g >= WHITE_MIN && b >= WHITE_MIN) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX) return null;
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function main() {
  const repoRoot = path.join(__dirname, '..');
  const inputPath = path.join(repoRoot, 'assets', 'icon.png');
  const outputPath = path.join(repoRoot, 'assets', 'adaptive-icon.png');

  let base = sharp(inputPath).ensureAlpha();
  try {
    base = base.trim({ threshold: 14 });
  } catch {
    base = sharp(inputPath).ensureAlpha();
  }

  const { data, info } = await base
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const channels = info.channels || 4;
  const box = boundingBoxNonWhite(data, w, h, channels);
  let pipeline = base;

  if (box && box.width > 0 && box.height > 0) {
    pipeline = base.extract(box);
  }

  await pipeline
    .resize(CANVAS, CANVAS, {
      fit: 'cover',
      position: 'centre',
    })
    .ensureAlpha()
    .png()
    .toFile(outputPath);

  console.log(
    box
      ? `Wrote ${outputPath} — bbox ${box.width}×${box.height} → ${CANVAS}×${CANVAS} (cover).`
      : `Wrote ${outputPath} — ${CANVAS}×${CANVAS} (cover).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
