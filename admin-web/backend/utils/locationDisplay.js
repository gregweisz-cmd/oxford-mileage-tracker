const { getBaseAddressLabel, abbreviateForDisplay } = require('./baseAddressNormalizer');
const {
  sanitizeLocationName,
  looksLikeStreetAddress,
  formatAddressInParentheses,
} = require('./locationName');

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\busa\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Format mileage location for storage and display: "Name (address)" or "(address)".
 */
function formatLocationNameAndAddress(name, address, baseAddress, baseAddress2) {
  const addr = (address || '').trim();
  const displayName = sanitizeLocationName(name, addr);
  if (!addr) return displayName || '';

  const ba = getBaseAddressLabel(addr, baseAddress, baseAddress2);
  const nameIsBase = /^(ba|base address|base|home base)\s*$/i.test(displayName);
  if (ba || nameIsBase) {
    let baseAddr = ba === 'BA2' ? (baseAddress2 || '') : (baseAddress || '');
    const paren = (baseAddr || '').match(/\(([^)]+)\)/);
    if (paren) baseAddr = paren[1].trim();
    const prefix = ba === 'BA2' ? 'BA2' : 'BA';
    return baseAddr ? `${prefix} (${abbreviateForDisplay(baseAddr)})` : prefix;
  }

  const abbr = abbreviateForDisplay(addr);
  if (displayName) {
    if (normalizeToken(displayName) === normalizeToken(addr)) {
      return formatAddressInParentheses(abbr);
    }
    if (looksLikeStreetAddress(displayName) && addr.includes(',')) {
      return formatAddressInParentheses(abbr);
    }
    const nameKey = normalizeToken(displayName);
    const addrKey = normalizeToken(addr);
    if (nameKey && addrKey && (nameKey.includes(addrKey) || addrKey.includes(nameKey))) {
      return formatAddressInParentheses(abbr);
    }
    return `${displayName} (${abbr})`;
  }
  return formatAddressInParentheses(abbr);
}

module.exports = { formatLocationNameAndAddress };
