const BASE_NAME_PATTERN = /^(ba|ba1|ba2|base address|base|home base)\s*$/i;

function normalizeToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\busa\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

export function looksLikeStreetAddress(value: string): boolean {
  return /^\d{1,6}\s+[A-Za-z0-9]/.test((value || '').trim());
}

export function sanitizeLocationName(
  name: string | undefined,
  address?: string
): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';
  if (BASE_NAME_PATTERN.test(trimmed)) return trimmed === 'BA1' ? 'BA' : trimmed;

  const addr = (address || '').trim();
  if (!addr) return trimmed;

  const nameKey = normalizeToken(trimmed);
  const addrKey = normalizeToken(addr);
  if (!nameKey) return '';

  if (nameKey === addrKey) return '';
  if (addrKey.includes(nameKey) || nameKey.includes(addrKey)) return '';
  if (looksLikeStreetAddress(trimmed) && addr.includes(',')) return '';

  return trimmed;
}

export function formatAddressInParentheses(address: string): string {
  const trimmed = (address || '').trim();
  if (!trimmed) return '';
  if (/^\([^)]+\)$/.test(trimmed)) return trimmed;
  return `(${trimmed})`;
}
