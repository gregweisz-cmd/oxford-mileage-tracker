import { LocationDetails } from '../types';
import { formatAddressParts, parseAddressParts } from './addressFormatter';

export const LOCATION_SOURCE_ORDER: Array<NonNullable<LocationDetails['source']>> = [
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

export const toCanonicalAddress = (address: string): string => {
  const parsed = parseAddressParts(address || '');
  return formatAddressParts(parsed) || (address || '').trim();
};

export const makeLocationDetails = ({
  name,
  address,
  source,
  sourceId,
  latitude,
  longitude,
}: {
  name?: string;
  address?: string;
  source?: LocationDetails['source'];
  sourceId?: string;
  latitude?: number;
  longitude?: number;
}): LocationDetails => {
  const canonicalAddress = toCanonicalAddress(address || '');
  const fallbackName = canonicalAddress.split(',')[0]?.trim() || 'Location';

  return {
    name: (name || '').trim() || fallbackName,
    address: canonicalAddress || (name || '').trim(),
    source,
    sourceId,
    latitude,
    longitude,
  };
};

