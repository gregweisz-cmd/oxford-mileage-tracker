/**
 * Parse and format base address as "Street, City, State Zip"
 */
export interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

function hasCityStateZip(address: ParsedAddress): boolean {
  return Boolean(address.city && address.state && address.zip);
}

function normalizeStreetLine(street: string): string {
  return (street || '')
    .trim()
    .replace(/^(\d+[A-Za-z0-9-]*),\s*/, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAddressInput(full: string): string {
  return normalizeStreetLine((full || '').trim());
}

function joinStreetSegments(segments: string[]): string {
  if (segments.length === 0) return '';
  if (segments.length === 1) return normalizeStreetLine(segments[0]);
  if (/^\d+[A-Za-z0-9-]*$/.test(segments[0].trim())) {
    return normalizeStreetLine(segments.join(' '));
  }
  return normalizeStreetLine(segments.join(', '));
}

export function parseBaseAddress(full: string): ParsedAddress {
  let street = '';
  let city = '';
  let state = '';
  let zip = '';
  const raw = normalizeAddressInput(full || '');
  if (!raw) return { street, city, state, zip };
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 4) {
    const last = parts[parts.length - 1];
    const statePart = parts[parts.length - 2];
    const zipMatch = last.match(/^(\d{5}(-\d{4})?)\s*$/);
    const stateMatch = statePart.match(/^([A-Za-z]{2})\s*$/);
    if (zipMatch && stateMatch) {
      state = stateMatch[1].toUpperCase();
      zip = zipMatch[1];
      city = parts[parts.length - 3];
      street = joinStreetSegments(parts.slice(0, -3));
      return { street, city, state, zip };
    }
  }
  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    const match = last.match(/^([A-Za-z]{2})\s+(\d{5}(-\d{4})?)\s*$/);
    if (match) {
      state = match[1].toUpperCase();
      zip = match[2];
      city = parts[parts.length - 2];
      street = joinStreetSegments(parts.slice(0, -2));
      return { street, city, state, zip };
    }
  }
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const match = last.match(/^([A-Za-z]{2})\s+(\d{5}(-\d{4})?)\s*$/);
    if (match) {
      state = match[1].toUpperCase();
      zip = match[2];
      street = normalizeStreetLine(parts[0]);
      return { street, city, state, zip };
    }
  }
  street = normalizeStreetLine(raw);
  return { street, city, state, zip };
}

export function updateBaseAddressPart(
  address: ParsedAddress,
  part: keyof ParsedAddress,
  value: string
): ParsedAddress {
  if (part === 'street') {
    const parsedStreet = parseBaseAddress(value);
    if (hasCityStateZip(parsedStreet)) {
      return parsedStreet;
    }
  }
  return { ...address, [part]: value };
}

export function formatBaseAddress(street: string, city: string, state: string, zip: string): string {
  const parsedStreet = parseBaseAddress(street || '');
  const shouldUseParsedStreet = hasCityStateZip(parsedStreet);
  const s = normalizeStreetLine((shouldUseParsedStreet ? parsedStreet.street : street || '').trim());
  const c = (shouldUseParsedStreet ? parsedStreet.city : city || '').trim();
  const st = (shouldUseParsedStreet ? parsedStreet.state : state || '').trim().toUpperCase().slice(0, 2);
  const z = (shouldUseParsedStreet ? parsedStreet.zip : zip || '').trim().replace(/\D/g, '').slice(0, 10);
  if (!s) return '';
  if (c && st && z) return `${s}, ${c}, ${st} ${z}`;
  if (st && z) return `${s}, ${st} ${z}`;
  if (c) return `${s}, ${c}`;
  return s;
}
