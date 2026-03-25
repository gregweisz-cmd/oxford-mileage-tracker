/**
 * Regenerates assets/adaptive-icon.png so the foreground fits Android's adaptive-icon
 * safe zone. The 1024×1024 source maps to the 108dp layer; OEM masks crop the outer region,
 * so edge-to-edge art looks "zoomed". Important content should sit inside the central
 * ~66dp circle (~528px diameter in a 1024 canvas). For a square glyph, max side is ~373px
 * inside that circle — we use a slightly smaller target for breathing room.
 *
 * Run: node scripts/pad-android-adaptive-icon.js
 * Then: npx expo prebuild --platform android (updates mipmap-*)
 */
const path = require('path');
const sharp = require('sharp');

/** Diameter in px of the "safe" circle in a 1024 (=108dp) adaptive foreground. */
const SAFE_CIRCLE_DIAMETER_PX = 528;
/** Max square side that fits inside that circle, minus a little margin. */
const MAX_SQUARE_SIDE_PX = Math.floor(SAFE_CIRCLE_DIAMETER_PX / Math.sqrt(2)) - 8;
const CANVAS = 1024;

async function main() {
  const input = path.join(__dirname, '..', 'assets', 'adaptive-icon.png');
  const resized = await sharp(input)
    .resize(MAX_SQUARE_SIDE_PX, MAX_SQUARE_SIDE_PX, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
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
    .toFile(input);

  console.log(
    `Updated ${input} (~${MAX_SQUARE_SIDE_PX}px artwork centered on ${CANVAS}px, transparent outer pad).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
