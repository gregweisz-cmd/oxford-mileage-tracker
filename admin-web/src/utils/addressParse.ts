/**
 * Parse and format base address as "Street, City, State Zip"
 */
export interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export function parseBaseAddress(full: string): ParsedAddress {
  let street = '';
  let city = '';
  let state = '';
  let zip = '';
  const raw = (full || '').trim();
  if (!raw) return { street, city, state, zip };
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    const match = last.match(/^([A-Za-z]{2})\s+(\d{5}(-\d{4})?)\s*$/);
    if (match) {
      state = match[1];
      zip = match[2];
      city = parts[parts.length - 2];
      street = parts.slice(0, -2).join(', ');
      return { street, city, state, zip };
    }
  }
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const match = last.match(/^([A-Za-z]{2})\s+(\d{5}(-\d{4})?)\s*$/);
    if (match) {
      state = match[1];
      zip = match[2];
      street = parts[0];
      return { street, city, state, zip };
    }
  }
  street = raw;
  return { street, city, state, zip };
}

export function formatBaseAddress(street: string, city: string, state: string, zip: string): string {
  const s = (street || '').trim();
  const c = (city || '').trim();
  const st = (state || '').trim().toUpperCase().slice(0, 2);
  const z = (zip || '').trim().replace(/\D/g, '').slice(0, 10);
  if (!s) return '';
  if (c && st && z) return `${s}, ${c}, ${st} ${z}`;
  if (st && z) return `${s}, ${st} ${z}`;
  if (c) return `${s}, ${c}`;
  return s;
}
