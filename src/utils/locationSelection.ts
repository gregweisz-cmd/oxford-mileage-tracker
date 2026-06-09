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
  city,
  state,
  zipCode,
  source,
  sourceId,
  latitude,
  longitude,
}: {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  source?: LocationDetails['source'];
  sourceId?: string;
  latitude?: number;
  longitude?: number;
}): LocationDetails => {
  const trimmedCity = (city || '').trim();
  const trimmedState = (state || '').trim().toUpperCase().slice(0, 2);
  const trimmedZip = (zipCode || '').trim();
  const streetLine = (address || '').trim();
  const composed =
    trimmedCity || trimmedState || trimmedZip
      ? formatAddressParts({
          street: streetLine,
          city: trimmedCity,
          state: trimmedState,
          zipCode: trimmedZip,
        })
      : '';
  const canonicalAddress = composed || toCanonicalAddress(streetLine || address || '');
  const fallbackName = canonicalAddress.split(',')[0]?.trim() || streetLine.split(',')[0]?.trim() || 'Location';

  return {
    name: (name || '').trim() || fallbackName,
    address:
      trimmedCity || trimmedState || trimmedZip
        ? streetLine || canonicalAddress.split(',')[0]?.trim() || canonicalAddress
        : canonicalAddress || (name || '').trim(),
    city: trimmedCity || undefined,
    state: trimmedState || undefined,
    zipCode: trimmedZip || undefined,
    source,
    sourceId,
    latitude,
    longitude,
  };
};

