import { MileageEntry, LocationDetails } from '../types';

/**
 * Formats a location for display in the "Name (address)" format
 * If LocationDetails are available, uses name and address
 * If only text is available, treats the text as the name with no address
 */
export const formatLocation = (
  locationText: string, 
  locationDetails?: LocationDetails
): string => {
  if (locationDetails) {
    return `${locationDetails.name} (${locationDetails.address})`;
  }
  
  // For simple text locations, treat the text as the name
  // If the text already contains parentheses, assume it's already formatted
  if (locationText.includes('(') && locationText.includes(')')) {
    return locationText;
  }
  
  // Otherwise, treat the text as the name with no address
  return locationText;
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
    return locationDetails.name;
  }
  
  // For simple text locations, return as-is
  return locationText;
};




