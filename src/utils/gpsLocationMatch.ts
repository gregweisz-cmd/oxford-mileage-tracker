import { parseAddressParts } from './addressFormatter';
import { OxfordHouse, SavedAddress } from '../types';

/** ~630 ft — saved addresses with coordinates must be this close to suggest a match. */
export const GPS_NEARBY_MATCH_MILES = 0.12;

export function normalizeStreetForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(
      /\b(street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|court|ct|circle|cir)\b/g,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
}

interface LocationMatchParts {
  street: string;
  city: string;
  state: string;
  zip: string;
}

function parseLocationForMatch(value: string): LocationMatchParts {
  const parsed = parseAddressParts(value);
  return {
    street: normalizeStreetForMatch(parsed.street || value.split(',')[0] || ''),
    city: (parsed.city || '').toLowerCase().trim(),
    state: (parsed.state || '').toUpperCase().slice(0, 2),
    zip: (parsed.zipCode || '').replace(/\D/g, '').slice(0, 5),
  };
}

function hasUsableCoordinates(latitude?: number, longitude?: number): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0)
  );
}

/**
 * Strict address equivalence for GPS location suggestions.
 * Rejects loose substring matches that can suggest a saved address across the state.
 */
export function addressesStrictlyMatch(first: string, second: string): boolean {
  const a = parseLocationForMatch(first);
  const b = parseLocationForMatch(second);
  if (!a.street || !b.street || a.street !== b.street) return false;
  if (a.zip && b.zip && a.zip === b.zip) return true;
  return !!(
    a.city &&
    b.city &&
    a.city === b.city &&
    a.state &&
    b.state &&
    a.state === b.state
  );
}

export function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const earthRadiusMiles = 3959;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return earthRadiusMiles * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export type LocationMatchCandidate<T> = {
  item: T;
  distanceMiles: number;
  distanceMatch: boolean;
  addressMatch: boolean;
};

export function findBestSavedAddressMatch(
  savedAddresses: SavedAddress[],
  currentLat: number,
  currentLon: number,
  currentAddress: string
): LocationMatchCandidate<SavedAddress> | null {
  const candidates = savedAddresses
    .map((saved) => {
      const hasCoords = hasUsableCoordinates(saved.latitude, saved.longitude);
      const distanceMiles = hasCoords
        ? calculateDistanceMiles(currentLat, currentLon, saved.latitude!, saved.longitude!)
        : Number.POSITIVE_INFINITY;
      const distanceMatch = hasCoords && distanceMiles <= GPS_NEARBY_MATCH_MILES;
      const addressMatch =
        !hasCoords && !!currentAddress && addressesStrictlyMatch(currentAddress, saved.address);
      return {
        item: saved,
        distanceMiles,
        distanceMatch,
        addressMatch,
        isMatch: distanceMatch || addressMatch,
      };
    })
    .filter((candidate) => candidate.isMatch)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  if (!candidates.length) return null;
  const best = candidates[0];
  return {
    item: best.item,
    distanceMiles: best.distanceMiles,
    distanceMatch: best.distanceMatch,
    addressMatch: best.addressMatch,
  };
}

export function findBestOxfordHouseMatch(
  houses: OxfordHouse[],
  currentAddress: string
): OxfordHouse | null {
  if (!currentAddress) return null;
  return (
    houses.find((house) => {
      const houseAddress = `${house.address}, ${house.city}, ${house.state} ${house.zipCode}`;
      return addressesStrictlyMatch(currentAddress, houseAddress);
    }) ?? null
  );
}

export function getGpsLocationConfidenceLabel(
  distanceMatch: boolean,
  addressMatch: boolean
): 'Strong match' | 'Address match' | 'Nearby match' {
  if (distanceMatch && addressMatch) return 'Strong match';
  if (addressMatch) return 'Address match';
  return 'Nearby match';
}
