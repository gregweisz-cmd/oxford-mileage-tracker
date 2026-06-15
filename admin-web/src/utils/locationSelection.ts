import { formatAddressFromParts, parseAddressToParts } from './addressFormatter';
import { sanitizeLocationName } from './locationName';

export type LocationSource =
  | 'baseAddress'
  | 'baseAddress2'
  | 'saved'
  | 'oxfordHouse'
  | 'manual'
  | 'recent'
  | 'frequent'
  | 'lastDestination'
  | 'tripStart'
  | 'google';

export const LOCATION_SOURCE_ORDER: LocationSource[] = [
  'baseAddress',
  'baseAddress2',
  'saved',
  'oxfordHouse',
  'manual',
  'recent',
  'frequent',
  'lastDestination',
  'tripStart',
  'google',
];

export interface CanonicalLocationSelection {
  name: string;
  address: string;
  source?: LocationSource;
  sourceId?: string;
  latitude?: number;
  longitude?: number;
}

export const toCanonicalAddress = (address: string): string => {
  const parsed = parseAddressToParts(address || '');
  return formatAddressFromParts(parsed) || (address || '').trim();
};

export const makeCanonicalLocationSelection = ({
  name,
  address,
  source,
  sourceId,
  latitude,
  longitude,
}: Partial<CanonicalLocationSelection>): CanonicalLocationSelection => {
  const canonicalAddress = toCanonicalAddress(address || '');
  const sanitizedName = sanitizeLocationName(name, canonicalAddress);
  return {
    name: sanitizedName,
    address: canonicalAddress || (name || '').trim(),
    source,
    sourceId,
    latitude,
    longitude,
  };
};

