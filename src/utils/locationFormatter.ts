import { MileageEntry, LocationDetails } from '../types';
import { sanitizeLocationName, formatAddressInParentheses } from './locationName';

/**
 * Consistent UI label: stored/API names may use "Base Address" while other paths use "BA".
 * Any standalone "Base Address" in display strings becomes "BA".
 */
export function normalizeBaseAddressDisplay(display: string): string {
  if (!display) return display;
  return display.replace(/\bBase Address\b/gi, 'BA');
}

/**
 * Formats a location for display in the "Name (address)" format
 * If LocationDetails are available, uses name and address
 * If only text is available, treats the text as the name with no address
 */
export const formatLocation = (
  locationText: string, 
  locationDetails?: LocationDetails
): string => {
  let result: string;
  if (locationDetails) {
    const address =
      locationDetails.address?.trim() ||
      [locationDetails.city, locationDetails.state, locationDetails.zipCode]
        .filter(Boolean)
        .join(', ');
    const name = sanitizeLocationName(locationDetails.name, address);
    if (name && address) {
      result = `${name} (${address})`;
    } else if (address) {
      result = formatAddressInParentheses(address);
    } else if (name) {
      result = name;
    } else {
      result = locationText;
    }
  } else if (locationText.includes('(') && locationText.includes(')')) {
    result = locationText;
  } else if (locationText.includes(',')) {
    result = formatAddressInParentheses(locationText);
  } else {
    result = locationText;
  }
  return normalizeBaseAddressDisplay(result);
};

/**
 * Formats a complete route from start to end location
 */
export const formatLocationRoute = (entry: MileageEntry): string => {
  const startLocation = formatLocation(entry.startLocation, entry.startLocationDetails);
  const endLocation = formatLocation(entry.endLocation, entry.endLocationDetails);
  
  return `${startLocation} to ${endLocation}`;
};

/**
 * Formats a location for input fields - extracts just the name part
 * This is useful when editing entries to show just the location name
 */
export const formatLocationForInput = (
  locationText: string, 
  locationDetails?: LocationDetails
): string => {
  if (locationDetails) {
    const name = sanitizeLocationName(
      locationDetails.name,
      locationDetails.address
    );
    return normalizeBaseAddressDisplay(name);
  }

  return normalizeBaseAddressDisplay(locationText);
};

/**
 * Parse a display string like "Name (123 Main St, City, ST 12345)" into LocationDetails.
 */
export const parseDisplayLocationToDetails = (
  locationText: string
): LocationDetails | null => {
  const trimmed = (locationText || '').trim();
  if (!trimmed) return null;

  const parenMatch = trimmed.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (parenMatch) {
    return {
      name: parenMatch[1].trim(),
      address: parenMatch[2].trim(),
    };
  }

  if (trimmed.includes(',')) {
    return { name: '', address: trimmed };
  }

  return { name: trimmed, address: '' };
};




