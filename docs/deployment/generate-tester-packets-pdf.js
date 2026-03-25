/**
 * Regenerate ALPHA_TESTER_PACKET.pdf and BETA_TESTER_PACKET.pdf from the .md sources.
 * Uses marked + Puppeteer (setContent + domcontentloaded) to avoid md-to-pdf’s
 * networkidle wait, which can time out on Windows.
 *
 * From repo root: node docs/deployment/generate-tester-packets-pdf.js
 */
const path = require('path');
const fs = require('fs');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

const dir = __dirname;

const mdToPdfPkg = path.dirname(require.resolve('md-to-pdf/package.json'));
const hlPkg = path.dirname(require.resolve('highlight.js/package.json'));

function loadCss() {
  const markdownCss = fs.readFileSync(path.join(mdToPdfPkg, 'markdown.css'), 'utf8');
  const highlightCss = fs.readFileSync(path.join(hlPkg, 'styles', 'github.css'), 'utf8');
  const testerCss = fs.readFileSync(path.join(dir, 'tester-packet.css'), 'utf8');
  return `${markdownCss}\n${highlightCss}\n${testerCss}`;
}

const combinedCss = loadCss();

const files = ['ALPHA_TESTER_PACKET.md', 'BETA_TESTER_PACKET.md'];

/**
 * Inline local images as data URIs so Puppeteer setContent() can render them.
 * Paths in Markdown are relative to docs/deployment/ (e.g. images/tester-packet/foo.png).
 */
function embedLocalImages(html, baseDir) {
  return html.replace(/<img([^>]*?)src="([^"]+)"([^>]*)>/gi, (full, pre, src, post) => {
    if (src.startsWith('http') || src.startsWith('data:')) {
      return full;
    }
    const rel = src.replace(/^\.\//, '');
    const abs = path.join(baseDir, rel);
    if (!fs.existsSync(abs)) {
      console.warn(`  [tester-pdf] missing image: ${rel}`);
      return `<p class="screenshot-missing"><strong>Screenshot to add:</strong> save as <code>${rel}</code> — see <code>docs/deployment/images/tester-packet/README.md</code>.</p>`;
    }
    const buf = fs.readFileSync(abs);
    const ext = path.extname(abs).toLowerCase();
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/png';
    const b64 = buf.toString('base64');
    return `<img${pre}src="data:${mime};base64,${b64}"${post} class="packet-screenshot" />`;
  });
}

async function convertOne(mdPath, outPath) {
  const md = fs.readFileSync(mdPath, 'utf8');
  const title = path.basename(mdPath, '.md').replace(/_/g, ' ');
  let bodyHtml = marked.parse(md);
  bodyHtml = embedLocalImages(bodyHtml, dir);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>${combinedCss}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    timeout: 180000,
    protocolTimeout: 180000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    page.setDefaultNavigationTimeout(120000);
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await page.emulateMediaType('screen');
    const buf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.75in',
        right: '0.75in',
        bottom: '0.75in',
        left: '0.75in',
      },
    });
    fs.writeFileSync(outPath, buf);
  } finally {
    await browser.close();
  }
}

async function main() {
  for (const name of files) {
    const mdPath = path.join(dir, name);
    if (!fs.existsSync(mdPath)) {
      console.error('Missing:', mdPath);
      process.exit(1);
    }
    const outPath = mdPath.replace(/\.md$/i, '.pdf');
    await convertOne(mdPath, outPath);
    console.log('Wrote', outPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
