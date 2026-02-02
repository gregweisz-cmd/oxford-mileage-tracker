/**
 * Distance calculation using Google Maps Geocoding + Distance Matrix API
 * Used by the web portal "Calculate miles" button (same behavior as the app).
 */

const axios = require('axios');
const { debugLog, debugError } = require('../debug');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

function isConfigured() {
  return !!GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE';
}

/**
 * Extract address portion from format like "Name (123 Main St, City, ST 12345)"
 */
function extractAddressFromLocation(location) {
  if (!location || typeof location !== 'string') return '';
  const trimmed = location.trim();
  if (trimmed === 'BA') return trimmed;
  const match = trimmed.match(/\(([^)]+)\)/);
  if (match && match[1]) return match[1].trim();
  return trimmed;
}

/**
 * Geocode an address to lat/lng
 */
async function geocodeAddress(address) {
  const cleaned = extractAddressFromLocation(address);
  const encoded = encodeURIComponent(cleaned || address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await axios.get(url, { timeout: 10000 });
  const data = response.data;

  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    if (cleaned !== address) {
      const retryUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
      const retry = await axios.get(retryUrl, { timeout: 10000 });
      const retryData = retry.data;
      if (retryData.status === 'OK' && retryData.results && retryData.results.length > 0) {
        const loc = retryData.results[0].geometry.location;
        return { lat: loc.lat, lng: loc.lng };
      }
    }
    throw new Error(`Could not find coordinates for address: ${address}`);
  }

  const loc = data.results[0].geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}

/**
 * Get driving distance in meters between two lat/lng points (Distance Matrix API)
 */
async function getDistanceMeters(origin, destination) {
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&units=imperial&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await axios.get(url, { timeout: 10000 });
  const data = response.data;

  if (data.status !== 'OK') {
    throw new Error(data.error_message || data.status);
  }
  if (!data.rows || data.rows.length === 0) {
    throw new Error('No distance data returned from Google Maps');
  }

  const element = data.rows[0].elements[0];
  if (element.status !== 'OK') {
    throw new Error(`Could not calculate route: ${element.status}`);
  }

  return element.distance.value;
}

/**
 * Calculate driving distance in miles between two addresses
 * @param {string} startAddress - Full address string
 * @param {string} endAddress - Full address string
 * @returns {Promise<number>} Distance in miles (rounded to nearest mile)
 */
async function calculateDistance(startAddress, endAddress) {
  if (!isConfigured()) {
    throw new Error('Google Maps API key is not configured');
  }
  if (!startAddress || !String(startAddress).trim()) {
    throw new Error('Start address is required');
  }
  if (!endAddress || !String(endAddress).trim()) {
    throw new Error('End address is required');
  }

  debugLog('DistanceService: Geocoding start address...');
  const startCoords = await geocodeAddress(String(startAddress).trim());
  debugLog('DistanceService: Geocoding end address...');
  const endCoords = await geocodeAddress(String(endAddress).trim());
  debugLog('DistanceService: Getting driving distance...');
  const meters = await getDistanceMeters(startCoords, endCoords);
  const miles = meters * 0.000621371;
  const rounded = Math.round(miles);
  debugLog(`DistanceService: ${rounded} miles`);
  return rounded;
}

module.exports = {
  isConfigured,
  calculateDistance
};
