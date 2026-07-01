const fs = require('fs');
const path = require('path');
const { resolveReceiptFilePath, parseDataUrl } = require('./receiptFile');

function imageFormatFromMime(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('png')) return 'PNG';
  return 'JPEG';
}

/** Resolve a receipt imageUri to a jsPDF-friendly data URL (Node cannot pass file paths to addImage). */
function prepareReceiptImageForPdf(imageUri) {
  const raw = String(imageUri || '').trim();
  if (!raw) return null;

  const dataUrl = parseDataUrl(raw);
  if (dataUrl) {
    if (dataUrl.mimeType.includes('pdf')) {
      return { kind: 'pdf', base64: dataUrl.buffer.toString('base64') };
    }
    const format = imageFormatFromMime(dataUrl.mimeType);
    return {
      kind: 'image',
      format,
      dataUrl: `data:${dataUrl.mimeType};base64,${dataUrl.buffer.toString('base64')}`
    };
  }

  const filePath = resolveReceiptFilePath(raw);
  if (!filePath || !fs.existsSync(filePath)) return null;

  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const b64 = fs.readFileSync(filePath).toString('base64');
    return { kind: 'pdf', base64: b64 };
  }

  const format = ext === '.png' ? 'PNG' : 'JPEG';
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  const b64 = fs.readFileSync(filePath).toString('base64');
  return { kind: 'image', format, dataUrl: `data:${mimeType};base64,${b64}` };
}

/** Draw receipt image centered on page with aspect ratio preserved. Returns false if image could not be drawn. */
function drawCenteredReceiptImage(doc, prepared, layout) {
  const { pageWidth, pageHeight, margin, startY } = layout;
  if (!prepared || prepared.kind !== 'image' || !prepared.dataUrl) return false;

  const maxDrawWidth = pageWidth - margin * 2;
  const maxDrawHeight = pageHeight - startY - margin;
  let props;
  try {
    props = doc.getImageProperties(prepared.dataUrl);
  } catch {
    return false;
  }
  if (!props?.width || !props?.height) return false;

  const aspect = props.width / props.height;
  let drawWidth = maxDrawWidth;
  let drawHeight = drawWidth / aspect;
  if (drawHeight > maxDrawHeight) {
    drawHeight = maxDrawHeight;
    drawWidth = drawHeight * aspect;
  }
  const imgX = margin + (maxDrawWidth - drawWidth) / 2;
  doc.addImage(prepared.dataUrl, prepared.format, imgX, startY, drawWidth, drawHeight, undefined, 'FAST');
  return true;
}

module.exports = {
  prepareReceiptImageForPdf,
  drawCenteredReceiptImage
};
