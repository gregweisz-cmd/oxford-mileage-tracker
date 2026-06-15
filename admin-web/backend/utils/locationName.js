const BASE_NAME_PATTERN = /^(ba|ba1|ba2|base address|base|home base)\s*$/i;

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\busa\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

function looksLikeStreetAddress(value) {
  return /^\d{1,6}\s+[A-Za-z0-9]/.test(String(value || '').trim());
}

function sanitizeLocationName(name, address) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  if (BASE_NAME_PATTERN.test(trimmed)) return trimmed === 'BA1' ? 'BA' : trimmed;

  const addr = String(address || '').trim();
  if (!addr) return trimmed;

  const nameKey = normalizeToken(trimmed);
  const addrKey = normalizeToken(addr);
  if (!nameKey) return '';

  if (nameKey === addrKey) return '';
  if (addrKey.includes(nameKey) || nameKey.includes(addrKey)) return '';
  if (looksLikeStreetAddress(trimmed) && addr.includes(',')) return '';

  return trimmed;
}

function formatAddressInParentheses(address) {
  const trimmed = String(address || '').trim();
  if (!trimmed) return '';
  if (/^\([^)]+\)$/.test(trimmed)) return trimmed;
  return `(${trimmed})`;
}

module.exports = { sanitizeLocationName, looksLikeStreetAddress, formatAddressInParentheses };
