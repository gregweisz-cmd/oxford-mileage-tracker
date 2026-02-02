/**
 * Google Maps Static API Service
 * Handles generation of Google Maps static images for route visualization
 */

const axios = require('axios');
const { debugLog, debugError } = require('../debug');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Check if Google Maps API is configured
 */
function isConfigured() {
  return !!GOOGLE_MAPS_API_KEY;
}

/**
 * Returns true if a string is a valid location for the Static Map (not empty, not "Odometer:...")
 */
function isValidLocationString(str) {
  if (!str || typeof str !== 'string') return false;
  const t = str.trim();
  if (t.length < 3) return false;
  if (/^odometer\s*:/i.test(t)) return false;
  return true;
}

/**
 * Collect map points from mileage entries for a specific day.
 * Each point is { lat, lng } (preferred) or { address }. Invalid/odometer-only strings are skipped.
 * Returns array in chronological order: [start1, end1, start2, end2, ...] so the path draws the route.
 */
function collectPointsForDay(mileageEntries) {
  const points = [];

  const sortedEntries = [...(mileageEntries || [])].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.date).getTime();
    const timeB = new Date(b.createdAt || b.date).getTime();
    return timeA - timeB;
  });

  sortedEntries.forEach(entry => {
    const startLat = parseFloat(entry.startLocationLat);
    const startLng = parseFloat(entry.startLocationLng);
    const endLat = parseFloat(entry.endLocationLat);
    const endLng = parseFloat(entry.endLocationLng);
    const startAddress = (entry.startLocationAddress || entry.startLocationName || entry.startLocation || '').trim();
    const endAddress = (entry.endLocationAddress || entry.endLocationName || entry.endLocation || '').trim();

    // Start point: prefer lat/lng so the map actually draws the route
    if (!isNaN(startLat) && !isNaN(startLng)) {
      points.push({ lat: startLat, lng: startLng });
    } else if (isValidLocationString(startAddress)) {
      points.push({ address: startAddress });
    }

    if (!isNaN(endLat) && !isNaN(endLng)) {
      points.push({ lat: endLat, lng: endLng });
    } else if (isValidLocationString(endAddress)) {
      points.push({ address: endAddress });
    }
  });

  return points;
}

/**
 * Collect addresses from mileage entries for a specific day (backward compat).
 * Returns array of address strings only; skips invalid/odometer strings. Prefer collectPointsForDay for maps.
 */
function collectAddressesForDay(mileageEntries) {
  const points = collectPointsForDay(mileageEntries);
  return points.filter(p => p.address).map(p => p.address);
}

/**
 * Collect map points from mileage entries for a cost center (all days, chronological).
 */
function collectPointsForCostCenter(mileageEntries) {
  const entriesByDate = {};
  (mileageEntries || []).forEach(entry => {
    const dateKey = (entry.date || '').split('T')[0] || entry.date;
    if (!entriesByDate[dateKey]) entriesByDate[dateKey] = [];
    entriesByDate[dateKey].push(entry);
  });
  const points = [];
  Object.keys(entriesByDate).sort().forEach(date => {
    points.push(...collectPointsForDay(entriesByDate[date]));
  });
  return points;
}

/**
 * Collect addresses from mileage entries for a specific cost center (backward compat).
 */
function collectAddressesForCostCenter(mileageEntries) {
  const points = collectPointsForCostCenter(mileageEntries);
  return points.filter(p => p.address).map(p => p.address);
}

/**
 * Build waypoints parameter for Google Maps Static API
 * @param {string[]} addresses - Array of addresses
 * @returns {string} URL-encoded waypoints parameter
 */
function buildWaypointsParam(addresses) {
  if (addresses.length === 0) return '';
  
  // For Google Maps Static API, we use path parameter for route visualization
  // Format: path=color:0x0000ff|weight:5|address1|address2|address3
  const encodedAddresses = addresses.map(addr => encodeURIComponent(addr));
  return `path=color:0x0000ff|weight:5|${encodedAddresses.join('|')}`;
}

/**
 * Build markers parameter for Google Maps Static API
 * @param {string[]} addresses - Array of addresses
 * @returns {string} URL-encoded markers parameter
 */
function buildMarkersParam(addresses) {
  if (addresses.length === 0) return '';
  
  const markers = addresses.map((addr, index) => {
    const label = (index + 1).toString();
    return `color:blue|label:${label}|${encodeURIComponent(addr)}`;
  });
  
  return markers.join('&markers=');
}

/**
 * Normalize input to points array: [{ lat, lng } | { address }]
 * Accepts: array of points, or array of address strings (legacy).
 */
function normalizeToPoints(addressesOrPoints) {
  if (!addressesOrPoints || addressesOrPoints.length === 0) return [];
  const first = addressesOrPoints[0];
  if (typeof first === 'string') {
    return addressesOrPoints.filter(a => isValidLocationString(a)).map(address => ({ address }));
  }
  return addressesOrPoints.filter(p => (p.lat != null && p.lng != null) || isValidLocationString(p.address));
}

/**
 * Generate Google Maps Static API URL
 * @param {Array<string|{lat?, lng?, address?}>} addressesOrPoints - Address strings or points with lat/lng or address
 * @param {Object} options - Additional options (size, maptype, etc.)
 * @returns {string} Google Maps Static API URL
 */
function generateStaticMapUrl(addressesOrPoints, options = {}) {
  if (!isConfigured()) {
    throw new Error('Google Maps API key is not configured');
  }

  const points = normalizeToPoints(addressesOrPoints);
  if (points.length === 0) {
    throw new Error('No valid addresses or coordinates provided for map');
  }

  const size = options.size || '600x400';
  const maptype = options.maptype || 'roadmap';

  const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';
  const params = new URLSearchParams();

  params.append('size', size);
  params.append('maptype', maptype);
  params.append('key', GOOGLE_MAPS_API_KEY);

  // Markers: use lat,lng when available (more reliable), else address
  points.forEach((p, index) => {
    const label = (index + 1).toString();
    const loc = (p.lat != null && p.lng != null)
      ? `${p.lat},${p.lng}`
      : encodeURIComponent(p.address || '');
    params.append('markers', `color:blue|label:${label}|${loc}`);
  });

  // Path: use lat,lng when available so the route actually draws
  if (points.length > 1) {
    const pathPart = points
      .map(p => (p.lat != null && p.lng != null) ? `${p.lat},${p.lng}` : encodeURIComponent(p.address || ''))
      .join('|');
    params.append('path', `color:0x0000ff|weight:5|${pathPart}`);
  }

  const url = `${baseUrl}?${params.toString()}`;
  if (url.length > 8192) {
    debugLog('⚠️ Static Map URL length exceeds 8192; request may fail. Consider fewer points.');
  }
  return url;
}

/**
 * Download static map image from Google Maps API
 * @param {Array<string|{lat?, lng?, address?}>} addressesOrPoints - Address strings or points (use collectPointsForDay for routes)
 * @param {Object} options - Additional options
 * @returns {Promise<Buffer>} Image buffer
 */
async function downloadStaticMapImage(addressesOrPoints, options = {}) {
  const points = normalizeToPoints(addressesOrPoints);
  if (points.length === 0) {
    throw new Error('No valid addresses or coordinates for map');
  }
  try {
    const url = generateStaticMapUrl(addressesOrPoints, options);
    debugLog(`🗺️ Downloading Google Maps static image for ${points.length} points`);
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    const buffer = Buffer.from(response.data);
    if (buffer.length < 500) {
      debugError('❌ Google Maps returned very small image (likely error image)');
      throw new Error('Map image failed (g.co/staticmaperror). Check API key and that Static Maps API is enabled.');
    }
    return buffer;
  } catch (error) {
    debugError('❌ Error downloading Google Maps static image:', error);
    if (error.response) {
      let errorMessage = error.response.data;
      if (Buffer.isBuffer(errorMessage)) {
        errorMessage = errorMessage.toString('utf-8');
      }
      debugError('❌ Google Maps API error:', error.response.status, errorMessage);
      throw new Error(`Failed to download Google Maps image: ${errorMessage || error.message}`);
    }
    throw new Error(`Failed to download Google Maps image: ${error.message}`);
  }
}

/**
 * Convert image buffer to base64 data URL for PDF embedding
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} mimeType - MIME type (default: image/png)
 * @returns {string} Base64 data URL
 */
function imageBufferToDataUrl(imageBuffer, mimeType = 'image/png') {
  const base64 = imageBuffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

module.exports = {
  isConfigured,
  isValidLocationString,
  collectPointsForDay,
  collectPointsForCostCenter,
  collectAddressesForDay,
  collectAddressesForCostCenter,
  buildWaypointsParam,
  buildMarkersParam,
  generateStaticMapUrl,
  downloadStaticMapImage,
  imageBufferToDataUrl
};

