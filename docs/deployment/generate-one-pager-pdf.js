const path = require('path');
const fs = require('fs');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

async function main() {
  const dir = __dirname;
  const mdPath = path.join(dir, 'BETA_TESTER_ONE_PAGER.md');
  const outFileName = process.argv[2] || 'BETA_TESTER_ONE_PAGER.pdf';
  const outPath = path.join(dir, outFileName);

  const mdToPdfPkg = path.dirname(require.resolve('md-to-pdf/package.json'));
  const hlPkg = path.dirname(require.resolve('highlight.js/package.json'));

  const markdownCss = fs.readFileSync(path.join(mdToPdfPkg, 'markdown.css'), 'utf8');
  const highlightCss = fs.readFileSync(path.join(hlPkg, 'styles', 'github.css'), 'utf8');
  const testerCss = fs.readFileSync(path.join(dir, 'tester-packet.css'), 'utf8');
  const combinedCss = `${markdownCss}\n${highlightCss}\n${testerCss}`;

  const md = fs.readFileSync(mdPath, 'utf8');
  const bodyHtml = marked.parse(md);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Beta Tester One-Pager</title>
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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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
    await page.pdf({
      path: outPath,
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.75in',
        right: '0.75in',
        bottom: '0.75in',
        left: '0.75in',
      },
    });
  } finally {
    await browser.close();
  }

  console.log('Wrote', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
