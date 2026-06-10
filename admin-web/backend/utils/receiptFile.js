const fs = require('fs');
const path = require('path');
const config = require('../config');
const dbService = require('../services/dbService');
const { getEffectiveRole } = require('../middleware/auth');

function resolveReceiptFilePath(imageUri) {
  const raw = String(imageUri || '').trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://')) {
    return null;
  }
  const uploadsDir = config.upload.directory;
  const basename = path.basename(raw.replace(/^\/+/, '').replace(/^uploads\//, ''));
  if (!basename) return null;
  const full = path.join(uploadsDir, basename);
  return fs.existsSync(full) ? full : null;
}

function contentTypeForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.heic' || ext === '.heif') return 'image/heic';
  return 'application/octet-stream';
}

function parseDataUrl(imageUri) {
  const raw = String(imageUri || '').trim();
  if (!raw.startsWith('data:')) return null;
  const comma = raw.indexOf(',');
  if (comma < 0) return null;
  const meta = raw.slice(0, comma);
  const data = raw.slice(comma + 1);
  const isBase64 = /;base64/i.test(meta);
  const mimeMatch = /^data:([^;]+)/i.exec(meta);
  const mimeType = mimeMatch?.[1] || 'application/octet-stream';
  const buffer = Buffer.from(data, isBase64 ? 'base64' : 'utf8');
  return { buffer, mimeType };
}

async function canViewEmployeeReceipts(viewer, employeeId) {
  if (!viewer || !employeeId) return false;
  if (viewer.id === employeeId) return true;
  const role = getEffectiveRole(viewer);
  if (role === 'admin' || role === 'finance') return true;
  const subject = await dbService.getEmployeeById(employeeId);
  if (!subject) return false;
  if (subject.supervisorId && String(subject.supervisorId) === String(viewer.id)) return true;
  if (subject.seniorStaffId && String(subject.seniorStaffId) === String(viewer.id)) return true;
  return false;
}

module.exports = {
  resolveReceiptFilePath,
  contentTypeForPath,
  parseDataUrl,
  canViewEmployeeReceipts,
};
