/**
 * Regenerates assets/adaptive-icon.png for Android adaptive icons.
 *
 * Source: assets/icon.png (master app icon). We trim edge padding, then scale
 * the artwork to fill the largest square inside Material's 66dp-diameter safe
 * zone on a 108dp (=1024px) foreground layer so the launcher glyph reads large
 * under circle/squircle masks.
 *
 * Run: npm run assets:android-adaptive-icon
 * Then rebuild Android (EAS or npx expo prebuild --platform android).
 */
const path = require('path');
const sharp = require('sharp');

const CANVAS = 1024;
/**
 * Round launcher masks use a circle over the full 108dp layer. The largest
 * axis-aligned square that fits in that circle is inscribed in 1024px.
 * (Material’s 66dp “safe” keyline is conservative and reads tiny on devices;
 * we bias larger; squircle masks may softly clip corners.)
 */
const MAX_SQUARE_SIDE_PX = Math.floor(CANVAS / Math.sqrt(2)) - 16;

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

  const resized = await base
    .resize(MAX_SQUARE_SIDE_PX, MAX_SQUARE_SIDE_PX, {
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toFile(outputPath);

  console.log(
    `Wrote ${outputPath} — logo up to ${MAX_SQUARE_SIDE_PX}px (inscribed in ${CANVAS}px circle, ${CANVAS}px canvas).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
