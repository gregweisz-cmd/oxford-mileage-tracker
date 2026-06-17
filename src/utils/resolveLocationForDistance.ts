import { LocationDetails } from '../types';
import { formatAddressParts } from './addressFormatter';

const US_ZIP_PATTERN = /\b\d{5}(?:-\d{4})?\b/;
const STATE_ABBREV_PATTERN = /\b[A-Z]{2}\b/;

/** True when a string is likely a street address Google can route, not a bare place name. */
export function looksLikeGeocodableAddress(text: string): boolean {
  const trimmed = (text || '').trim();
  if (!trimmed || trimmed === 'BA' || trimmed === 'BA2') return false;

  const parenMatch = trimmed.match(/\(([^)]+)\)/);
  if (parenMatch?.[1]?.trim()) {
    return looksLikeGeocodableAddress(parenMatch[1]);
  }

  if (US_ZIP_PATTERN.test(trimmed)) return true;
  if (trimmed.includes(',') && STATE_ABBREV_PATTERN.test(trimmed)) return true;
  if (trimmed.split(',').filter((part) => part.trim()).length >= 2) return true;

  // Street number + name (e.g. "1105 Longview Dr")
  if (/^\d+\s+\S/.test(trimmed)) return true;

  return false;
}

export type ResolveLocationForDistanceResult =
  | { ok: true; address: string }
  | { ok: false; userMessage: string };

function buildAddressFromDetails(details: LocationDetails): string | null {
  const street = details.address?.trim();
  const city = details.city?.trim();
  const state = details.state?.trim();
  const zip = details.zipCode?.trim();
  const name = details.name?.trim().toLowerCase();

  if (street && (city || state || zip)) {
    const composed = formatAddressParts({ street, city, state, zipCode: zip });
    if (composed && looksLikeGeocodableAddress(composed)) {
      return composed;
    }
  }

  if (street && looksLikeGeocodableAddress(street)) {
    if (name && street.toLowerCase() === name) {
      return null;
    }
    return street;
  }

  return null;
}

/**
 * Resolve a mileage location (display label + optional structured details) into an
 * address safe to send to Google/backend distance APIs. Rejects bare search terms
 * like "Idlebrook" that would geocode to the wrong place hundreds of miles away.
 */
export function resolveLocationForDistance(
  displayText: string,
  details?: LocationDetails | null
): ResolveLocationForDistanceResult {
  const display = (displayText || '').trim();
  if (!display) {
    return { ok: false, userMessage: 'Please select a start and end location first.' };
  }

  const parenMatch = display.match(/\(([^)]+)\)/);
  if (parenMatch?.[1]) {
    const inner = parenMatch[1].trim();
    if (inner && looksLikeGeocodableAddress(inner)) {
      return { ok: true, address: inner };
    }
  }

  if (display === 'BA' || display === 'BA2') {
    const baseAddr = details?.address?.trim();
    if (baseAddr && looksLikeGeocodableAddress(baseAddr)) {
      return { ok: true, address: baseAddr };
    }
    return {
      ok: false,
      userMessage:
        'Your base address is missing or incomplete. Update it in your profile, or pick a location with a full street address.',
    };
  }

  if (details) {
    const fromDetails = buildAddressFromDetails(details);
    if (fromDetails) {
      return { ok: true, address: fromDetails };
    }
  }

  if (looksLikeGeocodableAddress(display)) {
    return { ok: true, address: display };
  }

  const label = display.length > 40 ? `${display.slice(0, 40)}…` : display;
  return {
    ok: false,
    userMessage: `"${label}" is only a place name, not a full address. Open the location picker and tap the correct Oxford House in the list, or enter the street address, city, and state.`,
  };
}
