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

