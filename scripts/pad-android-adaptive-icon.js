/**
 * Regenerates assets/adaptive-icon.png for Android adaptive icons.
 *
 * Source: assets/icon.png. Finds a tight bounding box around non-white logo
 * pixels, extracts it, then scales to a full 1024×1024 layer (fit: cover,
 * centered) so the mark uses the entire canvas. Launcher masks may crop edges.
 *
 * Run: npm run assets:android-adaptive-icon
 * Then rebuild Android (EAS or npx expo prebuild --platform android).
 */
const path = require('path');
const sharp = require('sharp');

const CANVAS = 1024;
/** RGB channels all at/above this count as background white */
const WHITE_MIN = 248;

/**
 * @param {Buffer} data
 * @param {import('sharp').Metadata} info
 */
function boundingBoxNonWhite(data, info) {
  const w = info.width;
  const h = info.height;
  const channels = info.channels || 4;
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

  const box = boundingBoxNonWhite(data, info);
  let pipeline = base;

  if (box && box.width > 0 && box.height > 0) {
    pipeline = base.extract(box);
  }

  await pipeline
    .resize(CANVAS, CANVAS, {
      fit: 'cover',
      position: 'centre',
    })
    .png()
    .toFile(outputPath);

  console.log(
    box
      ? `Wrote ${outputPath} — extracted ${box.width}×${box.height} ink bbox → full ${CANVAS}×${CANVAS}px.`
      : `Wrote ${outputPath} — full ${CANVAS}×${CANVAS}px (no bbox change).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
