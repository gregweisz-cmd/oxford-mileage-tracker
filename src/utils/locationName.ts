import { LocationDetails } from '../types';
import { getFullLocationAddress } from './addressFormatter';

const BASE_NAME_PATTERN = /^(ba|ba1|ba2|base address|base|home base)\s*$/i;

function normalizeToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\busa\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

/** True when the value looks like a street address rather than a human label. */
export function looksLikeStreetAddress(value: string): boolean {
  return /^\d{1,6}\s+[A-Za-z0-9]/.test((value || '').trim());
}

/**
 * Return a display/storage name only when it is a real label (not the address or a street line).
 */
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

export function normalizeLocationDetails(
  details: LocationDetails | null | undefined
): LocationDetails | null {
  if (!details) return null;
  const address =
    getFullLocationAddress(details) || (details.address || '').trim();
  const name = sanitizeLocationName(details.name, address);
  return {
    ...details,
    name,
    address: address || details.address,
  };
}
