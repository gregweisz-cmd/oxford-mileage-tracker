/**
 * Regenerates assets/adaptive-icon.png for Android adaptive icons.
 *
 * Source: assets/icon.png. Tight ink bounding box → full 1024×1024 cover, then
 * flood-fills edge-connected white to transparent so the launcher background
 * (#1C75BC) shows instead of a huge white “mat” around the mark.
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

/**
 * White pixels in components that touch the image border → transparent.
 * Enclosed white (e.g. inside letters) stays opaque — it never touches the edge.
 */
function removeWhiteComponentsTouchingEdges(data, w, h, channels) {
  if (channels < 4) return;

  const isWhite = (pixelIdx) => {
    const j = pixelIdx * channels;
    return (
      data[j] >= WHITE_MIN &&
      data[j + 1] >= WHITE_MIN &&
      data[j + 2] >= WHITE_MIN &&
      data[j + 3] >= 128
    );
  };

  const visited = new Uint8Array(w * h);
  const queue = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (visited[start] || !isWhite(start)) continue;

      queue.length = 0;
      const comp = [];
      let touchesEdge = false;
      queue.push(start);
      visited[start] = 1;

      while (queue.length) {
        const cur = queue.shift();
        const cx = cur % w;
        const cy = (cur / w) | 0;
        if (cx === 0 || cx === w - 1 || cy === 0 || cy === h - 1) touchesEdge = true;
        comp.push(cur);

        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
            touchesEdge = true;
            continue;
          }
          const ni = ny * w + nx;
          if (visited[ni]) continue;
          if (!isWhite(ni)) continue;
          visited[ni] = 1;
          queue.push(ni);
        }
      }

      if (touchesEdge) {
        for (const ci of comp) {
          const j = ci * channels;
          data[j + 3] = 0;
        }
      }
    }
  }
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

  const { data: cropData, info: cropInfo } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // Must run on the crop *before* scaling to 1024: after cover-resize, colored pixels
  // touch the square edge, so outer white mats never “touch” the border and wouldn’t be removed.
  removeWhiteComponentsTouchingEdges(cropData, cropInfo.width, cropInfo.height, cropInfo.channels);

  await sharp(cropData, {
    raw: {
      width: cropInfo.width,
      height: cropInfo.height,
      channels: cropInfo.channels,
    },
  })
    .resize(CANVAS, CANVAS, {
      fit: 'cover',
      position: 'centre',
    })
    .ensureAlpha()
    .png()
    .toFile(outputPath);

  console.log(
    box
      ? `Wrote ${outputPath} — bbox ${box.width}×${box.height} → ${CANVAS}×${CANVAS}, outer white → transparent then scaled.`
      : `Wrote ${outputPath} — ${CANVAS}×${CANVAS}, outer white → transparent then scaled.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
