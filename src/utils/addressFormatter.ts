export interface AddressParts {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export const formatAddressParts = ({ street, city, state, zipCode }: AddressParts): string => {
  const line1 = street?.trim() || '';
  const line2Parts = [city?.trim(), state?.trim()].filter(Boolean);
  const line2 = line2Parts.length > 0 ? line2Parts.join(', ') : '';
  const zip = zipCode?.trim() || '';

  if (!line1 && !line2 && !zip) {
    return '';
  }

  if (line1 && (line2 || zip)) {
    return `${line1}${line2 ? `, ${line2}` : ''}${zip ? ` ${zip}` : ''}`.trim();
  }

  return [line1, line2, zip].filter(Boolean).join(' ').trim();
};

export const parseAddressParts = (fullAddress: string): AddressParts => {
  const trimmed = fullAddress?.trim() || '';
  if (!trimmed) return {};

  const parts = trimmed.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length === 1) {
    return { street: trimmed };
  }

  const street = parts[0] || '';
  const cityPart = parts.length > 2 ? parts[1] : '';
  const stateZipPart = parts.length > 2 ? parts[2] : parts[1] || '';

  let city = cityPart;
  let state = '';
  let zipCode = '';

  const stateZipMatch = stateZipPart.match(/([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?/);
  if (stateZipMatch) {
    state = stateZipMatch[1] || '';
    zipCode = stateZipMatch[2] || '';
  } else if (parts.length >= 3) {
    city = parts[1] || '';
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
    state: state || '',
    zipCode: zipCode || '',
  };
};
