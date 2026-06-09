export interface AddressParts {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

const hasCompleteAddressParts = (parts: AddressParts): boolean =>
  Boolean(parts.street?.trim() && parts.city?.trim() && parts.state?.trim() && parts.zipCode?.trim());

/** expo-location reverse geocode fields (Android often omits city; subregion/district may hold it) */
export type GeocodeAddressFields = {
  streetNumber?: string | null;
  street?: string | null;
  city?: string | null;
  district?: string | null;
  subregion?: string | null;
  region?: string | null;
  postalCode?: string | null;
  name?: string | null;
};

/** Pick city from expo geocode result with Android/iOS fallbacks */
export const cityFromGeocode = (g: GeocodeAddressFields): string =>
  (g.city || g.subregion || g.district || '').trim();

/** Pick state from expo geocode result */
export const stateFromGeocode = (g: GeocodeAddressFields): string =>
  (g.region || '').trim();

/** Normalize geocode into separated parts and a canonical one-line address for matching and storage */
export const buildPartsFromGeocode = (
  g: GeocodeAddressFields
): AddressParts & { oneLine: string } => {
  const street = [g.streetNumber, g.street].filter(Boolean).join(' ').trim();
  let city = cityFromGeocode(g);
  let state = stateFromGeocode(g);
  let zipCode = (g.postalCode || '').trim();

  // When platform only returns a formatted name line, parse it for missing parts
  if ((!city || !state || !zipCode) && g.name?.trim()) {
    const parsed = parseAddressParts(g.name);
    if (!street && parsed.street) {
      return buildPartsFromGeocode({
        streetNumber: null,
        street: parsed.street,
        city: parsed.city || city,
        region: parsed.state || state,
        postalCode: parsed.zipCode || zipCode,
      });
    }
    if (!city && parsed.city) city = parsed.city;
    if (!state && parsed.state) state = parsed.state;
    if (!zipCode && parsed.zipCode) zipCode = parsed.zipCode;
  }

  const oneLine = formatAddressParts({ street, city, state, zipCode });
  return { street, city, state, zipCode, oneLine };
};

/** Location details from Oxford House / saved address may have address, city, state, zipCode. Returns full one-line address for storage/API. */
export const getFullLocationAddress = (details: { address?: string; city?: string; state?: string; zipCode?: string } | null | undefined): string => {
  if (!details) return '';
  const full = formatAddressParts({
    street: details.address,
    city: details.city,
    state: details.state,
    zipCode: details.zipCode,
  });
  return full || (details.address ?? '').trim();
};

export const formatAddressParts = ({ street, city, state, zipCode }: AddressParts): string => {
  const parsedStreet = parseAddressParts(street || '');
  const shouldUseParsedStreet = hasCompleteAddressParts(parsedStreet);
  const line1 = (shouldUseParsedStreet ? parsedStreet.street : street)?.trim() || '';
  const normalizedCity = (shouldUseParsedStreet ? parsedStreet.city : city)?.trim() || '';
  const normalizedState = (shouldUseParsedStreet ? parsedStreet.state : state)?.trim().toUpperCase().slice(0, 2) || '';
  const normalizedZip = (shouldUseParsedStreet ? parsedStreet.zipCode : zipCode)?.trim().replace(/\D/g, '').slice(0, 10) || '';
  const line2Parts = [normalizedCity, normalizedState].filter(Boolean);
  const line2 = line2Parts.length > 0 ? line2Parts.join(', ') : '';
  const zip = normalizedZip;

  if (!line1 && !line2 && !zip) {
    return '';
  }

  if (line1 && (line2 || zip)) {
    return `${line1}${line2 ? `, ${line2}` : ''}${zip ? ` ${zip}` : ''}`.trim();
  }

  return [line1, line2, zip].filter(Boolean).join(' ').trim();
};

const COUNTRY_SUFFIXES = new Set([
  'usa',
  'us',
  'u.s.',
  'u.s.a.',
  'united states',
  'united states of america',
]);

const stripTrailingCountry = (segments: string[]): string[] => {
  if (segments.length <= 1) return segments;
  const last = segments[segments.length - 1].toLowerCase().replace(/\./g, '');
  if (COUNTRY_SUFFIXES.has(last)) {
    return segments.slice(0, -1);
  }
  return segments;
};

const parseStateZipSegment = (segment: string): { state: string; zipCode: string } => {
  const match = segment.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!match) return { state: '', zipCode: '' };
  return { state: match[1].toUpperCase(), zipCode: match[2] };
};

export type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

/** Structured fields from Google Place Details address_components */
export const parseGoogleAddressComponents = (
  components: GoogleAddressComponent[] | undefined
): AddressParts => {
  if (!components?.length) return {};

  const find = (...types: string[]) =>
    components.find((component) => types.some((type) => component.types.includes(type)));

  const streetNumber = find('street_number')?.long_name || '';
  const route = find('route')?.long_name || '';
  const street = [streetNumber, route].filter(Boolean).join(' ').trim();
  const city =
    find('locality', 'postal_town', 'sublocality', 'administrative_area_level_3')?.long_name || '';
  const state = (find('administrative_area_level_1')?.short_name || '').toUpperCase().slice(0, 2);
  const zipCode = find('postal_code')?.long_name || '';

  return { street, city, state, zipCode };
};

export const parseAddressParts = (fullAddress: string): AddressParts => {
  const trimmed = fullAddress?.trim() || '';
  if (!trimmed) return {};

  let parts = stripTrailingCountry(
    trimmed.split(',').map(part => part.trim()).filter(Boolean)
  );
  if (parts.length === 1) {
    return { street: trimmed };
  }

  // Google-style: "222 Paradise Hills Cir, Mooresville, NC 28117"
  if (parts.length === 3) {
    const { state, zipCode } = parseStateZipSegment(parts[2]);
    if (state && zipCode) {
      return {
        street: parts[0],
        city: parts[1],
        state,
        zipCode,
      };
    }
  }

  if (parts.length >= 4) {
    const zipMatch = parts[parts.length - 1].match(/^(\d{5}(?:-\d{4})?)\s*$/);
    const stateMatch = parts[parts.length - 2].match(/^([A-Za-z]{2})\s*$/);
    if (zipMatch && stateMatch) {
      return {
        street: parts.slice(0, -3).join(', '),
        city: parts[parts.length - 3] || '',
        state: stateMatch[1].toUpperCase(),
        zipCode: zipMatch[1],
      };
    }
  }

  const street = parts.length > 2 ? parts[0] : parts[0] || '';
  const cityPart = parts.length > 2 ? parts[1] : '';
  const stateZipPart = parts.length > 2 ? parts[parts.length - 1] : parts[1] || '';

  let city = cityPart;
  let state = '';
  let zipCode = '';

  const combinedStateZip = parseStateZipSegment(stateZipPart);
  if (combinedStateZip.state) {
    state = combinedStateZip.state;
    zipCode = combinedStateZip.zipCode;
    city = cityPart;
  } else {
    const stateZipMatch = stateZipPart.match(/([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?/);
    if (stateZipMatch && stateZipMatch[1] !== 'US') {
      state = stateZipMatch[1] || '';
      zipCode = stateZipMatch[2] || '';
    } else if (parts.length >= 3) {
      city = parts[1] || '';
    }
  }

  // Handle cases like "City ST 12345" when only 2 parts exist
  if (!city && parts.length === 2) {
    const cityStateZipMatch = stateZipPart.match(/^(.+?)\s+([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
    if (cityStateZipMatch) {
      city = cityStateZipMatch[1] || '';
      state = cityStateZipMatch[2] || '';
      zipCode = cityStateZipMatch[3] || '';
    }
  }

  return {
    street: street || trimmed,
    city: city || '',
    state: (state || '').toUpperCase(),
    zipCode: zipCode || '',
  };
};

export const updateAddressPart = (parts: AddressParts, part: keyof AddressParts, value: string): AddressParts => {
  if (part === 'street') {
    const parsedStreet = parseAddressParts(value);
    if (hasCompleteAddressParts(parsedStreet)) {
      return parsedStreet;
    }
  }
  return { ...parts, [part]: value };
};
