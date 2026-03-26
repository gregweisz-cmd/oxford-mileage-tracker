/**
 * Make Android adaptive foreground exactly match iOS-style square icon.
 * No trim/crop/transparency heuristics; just resize assets/icon.png to 1024.
 */
const path = require('path');
const sharp = require('sharp');

const CANVAS = 1024;

async function main() {
  const repoRoot = path.join(__dirname, '..');
  const inputPath = path.join(repoRoot, 'assets', 'icon.png');
  const outputPath = path.join(repoRoot, 'assets', 'adaptive-icon.png');

  await sharp(inputPath)
    .resize(CANVAS, CANVAS, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(outputPath);

  console.log(`Wrote ${outputPath} from icon.png (${CANVAS}x${CANVAS}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
