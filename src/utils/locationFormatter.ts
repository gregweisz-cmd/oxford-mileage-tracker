import { MileageEntry, LocationDetails } from '../types';

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
    result = `${locationDetails.name} (${locationDetails.address})`;
  } else if (locationText.includes('(') && locationText.includes(')')) {
    result = locationText;
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
    return normalizeBaseAddressDisplay(locationDetails.name);
  }

  return normalizeBaseAddressDisplay(locationText);
};




