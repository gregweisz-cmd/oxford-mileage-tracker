/**
 * Address formatter utility
 * Formats addresses for display in the application
 */

export interface AddressData {
  name?: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
}

/** Street, City, State, Zip parts for structured address entry */
export interface AddressParts {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export const emptyAddressParts: AddressParts = {
  street: '',
  city: '',
  state: '',
  zip: '',
};

/**
 * Format address parts into a single string for storage/API (e.g. "123 Main St, Raleigh, NC 27601")
 */
export function formatAddressFromParts(parts: AddressParts): string {
  const { street, city, state, zip } = parts;
  if (!street.trim() && !city.trim() && !state.trim() && !zip.trim()) return '';
  const cityStateZip = [city.trim(), state.trim(), zip.trim()].filter(Boolean).join(', ');
  if (!cityStateZip) return street.trim();
  return street.trim() ? `${street.trim()}, ${cityStateZip}` : cityStateZip;
}

/**
 * Parse a full address string into Street, City, State, Zip (best-effort).
 * Handles formats like "123 Main St, Raleigh, NC 27601" or "123 Main St, City, ST 27601".
 */
export function parseAddressToParts(fullAddress: string): AddressParts {
  const trimmed = (fullAddress || '').trim();
  if (!trimmed) return { ...emptyAddressParts };

  // Extract optional "Name (address)" - use address part for parsing
  let addressPart = trimmed;
  const parenMatch = trimmed.match(/\(([^)]+)\)$/);
  if (parenMatch) {
    addressPart = parenMatch[1].trim();
  }

  const parts = addressPart.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { street: trimmed, city: '', state: '', zip: '' };
  if (parts.length === 1) return { street: parts[0], city: '', state: '', zip: '' };

  // Last part: try "ST 12345" or "12345" or "12345-6789"
  const last = parts[parts.length - 1];
  const zipMatch = last.match(/([A-Za-z]{2})?\s*(\d{5}(-\d{4})?)/);
  let state = '';
  let zip = '';
  if (zipMatch) {
    state = (zipMatch[1] || '').trim().toUpperCase();
    zip = (zipMatch[2] || '').trim();
  } else {
    zip = last;
  }

  const city = parts.length >= 3 ? parts[parts.length - 2] : '';
  const street = parts.length >= 3 ? parts.slice(0, -2).join(', ') : parts[0] || '';

  return { street, city, state, zip };
}

/**
 * Format an address for display
 * For base addresses (employee's home), just returns "BA"
 * For Oxford Houses and other locations, returns: "Name (Address, City, State Zip)"
 * 
 * @param address - The address string or AddressData object
 * @param isBaseAddress - Whether this is the employee's base address
 * @returns Formatted address string
 */
export function formatAddressForDisplay(address: string | AddressData, isBaseAddress: boolean = false): string {
  // If it's a base address, just return "BA"
  if (isBaseAddress) {
    return 'BA';
  }

  // If it's already in the correct format (contains parentheses), return as-is
  if (typeof address === 'string' && address.includes('(') && address.includes(')')) {
    return address;
  }

  // If it's an AddressData object
  if (typeof address === 'object' && address !== null) {
    const { name, address: addr, city, state, zip } = address;
    if (name && (addr || city || state || zip)) {
      return `${name} (${[addr, city, state, zip].filter(Boolean).join(', ')})`;
    }
    return addr || '';
  }

  // If it's a plain string, try to parse if it looks like it has all components
  if (typeof address === 'string') {
    // Try to detect format like "Name (123 Street, City, State Zip)"
    const match = address.match(/^(.+?)\s*\((.+?)\)$/);
    if (match) {
      return address; // Already formatted
    }
    return address;
  }

  return '';
}

/**
 * Extract just the address portion from a formatted address
 * @param formattedAddress - Formatted address string
 * @returns Just the address portion
 */
export function extractAddressPortion(formattedAddress: string): string {
  const match = formattedAddress.match(/\((.+?)\)/);
  return match ? match[1] : formattedAddress;
}

/**
 * Extract just the name portion from a formatted address
 * @param formattedAddress - Formatted address string
 * @returns Just the name portion
 */
export function extractNamePortion(formattedAddress: string): string {
  const match = formattedAddress.match(/^(.+?)\s*\(/);
  return match ? match[1].trim() : formattedAddress;
}

/**
 * Check if a location matches an employee's base address(es)
 * @param location - The location string to check
 * @param baseAddress - Employee's primary base address
 * @param baseAddress2 - Employee's secondary base address (optional)
 * @returns "BA", "BA1", "BA2", or null if not a base address
 */
export function getBaseAddressLabel(
  location: string,
  baseAddress?: string,
  baseAddress2?: string
): string | null {
  if (!location) return null;
  
  const locationLower = location.toLowerCase().trim();
  
  // Check for exact "BA" keywords (common shorthand)
  if (
    locationLower === 'ba' ||
    locationLower === 'base address' ||
    locationLower === 'base' ||
    locationLower === 'home base'
  ) {
    // If there are two base addresses, we can't determine which one, default to BA1
    // But typically if someone uses "BA" they mean the primary
    return baseAddress2 ? 'BA1' : 'BA';
  }
  
  // Extract address portion from formatted location (inside parentheses)
  const extractAddressPortion = (str: string): string => {
    const match = str.match(/\(([^)]+)\)/);
    if (match) return match[1].toLowerCase().trim();
    return str.toLowerCase().trim();
  };
  
  // Extract name portion (before parentheses)
  const extractNamePortion = (str: string): string => {
    const match = str.match(/^([^(]+?)\s*\(/);
    if (match) return match[1].toLowerCase().trim();
    return str.toLowerCase().trim();
  };
  
  const locationAddress = extractAddressPortion(location);
  const locationName = extractNamePortion(location);
  
  // Check against baseAddress
  if (baseAddress) {
    const base1Lower = baseAddress.toLowerCase().trim();
    const base1Address = extractAddressPortion(baseAddress);
    const base1Name = extractNamePortion(baseAddress);
    
    // Check if location matches baseAddress by comparing:
    // 1. Full strings match
    // 2. Address portions match (inside parentheses)
    // 3. Name portions match and address is similar
    if (
      locationLower === base1Lower ||
      locationAddress === base1Address ||
      (locationName === base1Name && base1Address && locationAddress === base1Address) ||
      (base1Address && locationAddress && (
        locationAddress.includes(base1Address) || base1Address.includes(locationAddress)
      ))
    ) {
      return baseAddress2 ? 'BA1' : 'BA';
    }
  }
  
  // Check against baseAddress2
  if (baseAddress2) {
    const base2Lower = baseAddress2.toLowerCase().trim();
    const base2Address = extractAddressPortion(baseAddress2);
    const base2Name = extractNamePortion(baseAddress2);
    
    if (
      locationLower === base2Lower ||
      locationAddress === base2Address ||
      (locationName === base2Name && base2Address && locationAddress === base2Address) ||
      (base2Address && locationAddress && (
        locationAddress.includes(base2Address) || base2Address.includes(locationAddress)
      ))
    ) {
      return 'BA2';
    }
  }
  
  return null;
}

/**
 * Format a location for display in descriptions
 * Base addresses show as "BA", "BA1", "BA2"
 * Other locations show as "LocationName (Full Address)" format
 * 
 * @param location - The location string to format
 * @param baseAddress - Employee's primary base address (optional)
 * @param baseAddress2 - Employee's secondary base address (optional)
 * @returns Formatted location string
 */
export function formatLocationForDescription(
  location: string,
  baseAddress?: string,
  baseAddress2?: string
): string {
  if (!location) return '';
  
  // Check if it's a base address
  const baLabel = getBaseAddressLabel(location, baseAddress, baseAddress2);
  if (baLabel) {
    return baLabel;
  }
  
  // If already in format "LocationName (Address)", return as-is
  if (location.includes('(') && location.includes(')')) {
    return location;
  }
  
  // Otherwise return as-is (should already be formatted from mobile app)
  return location;
}

