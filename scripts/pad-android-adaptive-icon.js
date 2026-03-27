/**
 * Build Android adaptive-icon foreground from the company logo.
 *
 * Source: assets/icon.png — Oxford House logo (same master as iOS `expo.icon`).
 * Output: assets/adaptive-icon.png — 1024×1024, full-bleed: the logo fills the
 * entire square (`fit: 'cover'`) so the launcher shows the mark edge-to-edge.
 * We flatten onto solid white first so Android and iOS render the same square.
 */
const path = require('path');
const sharp = require('sharp');

const CANVAS = 1024;

async function main() {
  const repoRoot = path.join(__dirname, '..');
  const inputPath = path.join(repoRoot, 'assets', 'icon.png');
  const outputPath = path.join(repoRoot, 'assets', 'adaptive-icon.png');

  await sharp(inputPath)
    .flatten({ background: '#FFFFFF' })
    .resize(CANVAS, CANVAS, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(outputPath);

  console.log(`Wrote ${outputPath} from company logo (icon.png) at ${CANVAS}×${CANVAS}, full-bleed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
