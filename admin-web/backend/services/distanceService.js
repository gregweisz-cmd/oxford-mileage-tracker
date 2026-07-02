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
 * Calculate driving distance in miles between two lat/lng points.
 * @returns {Promise<number|null>} Rounded miles, or null when coords are invalid
 */
async function calculateDistanceBetweenCoords(origin, destination) {
  if (!isConfigured()) {
    return null;
  }
  const oLat = Number(origin?.lat);
  const oLng = Number(origin?.lng);
  const dLat = Number(destination?.lat);
  const dLng = Number(destination?.lng);
  if (![oLat, oLng, dLat, dLng].every((n) => Number.isFinite(n))) {
    return null;
  }
  if (Math.abs(oLat) < 0.0001 && Math.abs(oLng) < 0.0001) return null;
  if (Math.abs(dLat) < 0.0001 && Math.abs(dLng) < 0.0001) return null;

  const meters = await getDistanceMeters({ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng });
  return Math.round(meters * 0.000621371);
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

function summarizeRoute(route) {
  const leg = route?.legs?.[0] || {};
  const distanceMeters = Number(leg.distance?.value || 0);
  const miles = Math.round(distanceMeters * 0.000621371);
  const durationSeconds = Number(leg.duration?.value || 0);
  const durationInTrafficSeconds = Number(leg.duration_in_traffic?.value || 0) || null;
  const summary = route?.summary || '';

  return {
    summary,
    miles,
    distanceText: leg.distance?.text || `${miles} mi`,
    durationText: leg.duration?.text || '',
    durationInTrafficText: leg.duration_in_traffic?.text || null,
    durationSeconds,
    durationInTrafficSeconds,
    startAddress: leg.start_address || '',
    endAddress: leg.end_address || '',
    warnings: Array.isArray(route?.warnings) ? route.warnings : [],
  };
}

/**
 * Calculate alternative driving routes between two addresses using Directions API.
 * @returns {Promise<Array<{summary:string,miles:number,distanceText:string,durationText:string,durationInTrafficText?:string|null}>>}
 */
async function calculateRouteOptions(startAddress, endAddress) {
  if (!isConfigured()) {
    throw new Error('Google Maps API key is not configured');
  }
  if (!startAddress || !String(startAddress).trim()) {
    throw new Error('Start address is required');
  }
  if (!endAddress || !String(endAddress).trim()) {
    throw new Error('End address is required');
  }

  const origin = extractAddressFromLocation(String(startAddress).trim());
  const destination = extractAddressFromLocation(String(endAddress).trim());
  const url =
    `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}&mode=driving&alternatives=true&departure_time=now&units=imperial&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await axios.get(url, { timeout: 10000 });
  const data = response.data;

  if (data.status !== 'OK') {
    throw new Error(data.error_message || data.status || 'Failed to calculate route options');
  }
  if (!Array.isArray(data.routes) || data.routes.length === 0) {
    throw new Error('No route options returned from Google Maps');
  }

  const seen = new Set();
  return data.routes
    .map(summarizeRoute)
    .filter((route) => {
      if (!route.miles || route.miles <= 0) return false;
      const key = `${route.summary}|${route.miles}|${route.durationSeconds}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

module.exports = {
  isConfigured,
  calculateDistance,
  calculateDistanceBetweenCoords,
  calculateRouteOptions
};
