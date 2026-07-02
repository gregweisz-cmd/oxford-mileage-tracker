const path = require('path');
const fs = require('fs');
const convert = require('heic-convert');

function isPdfBuffer(buffer) {
  return buffer && buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF';
}

function isJpegBuffer(buffer) {
  return buffer && buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isPngBuffer(buffer) {
  return (
    buffer &&
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

function isHeicBuffer(buffer) {
  if (!buffer || buffer.length < 12) return false;
  if (buffer.toString('ascii', 4, 8) !== 'ftyp') return false;
  const brand = buffer.toString('ascii', 8, 12).toLowerCase();
  return ['heic', 'heif', 'mif1', 'msf1', 'hevc', 'hevx'].includes(brand);
}

function extensionFromDataUrl(dataUrl) {
  const raw = String(dataUrl || '');
  if (raw.includes('data:application/pdf')) return '.pdf';
  if (raw.includes('data:image/png')) return '.png';
  if (raw.includes('data:image/heic') || raw.includes('data:image/heif')) return '.heic';
  if (raw.includes('data:image/jpeg') || raw.includes('data:image/jpg')) return '.jpg';
  return '';
}

async function convertHeicToJpeg(buffer) {
  const output = await convert({
    buffer,
    format: 'JPEG',
    quality: 0.85,
  });
  return Buffer.from(output);
}

/**
 * Normalize receipt image bytes for portal display (JPEG/PNG/PDF only).
 * Converts HEIC/HEIF and mislabeled iPhone exports that browsers cannot render.
 */
async function normalizeReceiptImageBuffer(buffer) {
  if (!buffer || !buffer.length) {
    return { buffer: Buffer.alloc(0), extension: '.jpg' };
  }
  if (isPdfBuffer(buffer)) {
    return { buffer, extension: '.pdf' };
  }
  if (isJpegBuffer(buffer)) {
    return { buffer, extension: '.jpg' };
  }
  if (isPngBuffer(buffer)) {
    return { buffer, extension: '.png' };
  }
  if (isHeicBuffer(buffer)) {
    return { buffer: await convertHeicToJpeg(buffer), extension: '.jpg' };
  }

  try {
    return { buffer: await convertHeicToJpeg(buffer), extension: '.jpg' };
  } catch (error) {
    return { buffer, extension: '.jpg' };
  }
}

async function persistReceiptUpload(uploadsDir, inputBuffer, options = {}) {
  const uniqueBase = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const forcePdf = options.isPdf === true || isPdfBuffer(inputBuffer);

  if (forcePdf) {
    const filename = `${uniqueBase}.pdf`;
    fs.writeFileSync(path.join(uploadsDir, filename), inputBuffer);
    return { filename, size: inputBuffer.length };
  }

  const { buffer, extension } = await normalizeReceiptImageBuffer(inputBuffer);
  const filename = `${uniqueBase}${extension}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  return { filename, size: buffer.length };
}

module.exports = {
  isPdfBuffer,
  isHeicBuffer,
  extensionFromDataUrl,
  normalizeReceiptImageBuffer,
  persistReceiptUpload,
};
