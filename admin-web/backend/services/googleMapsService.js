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
 * Detect if buffer is Google's static map error image (100x100 PNG).
 * Google returns 200 OK with a small error tile when the request fails.
 * We request 600x400, so 100x100 or very small dimensions = error image.
 */
function isStaticMapErrorImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return false;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== sig[i]) return false;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width <= 200 && height <= 200;
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
 * Returns true if lat/lng are valid for mapping (not 0,0 and within world bounds).
 * (0,0) is used as default when unset and would show in the ocean.
 */
function isValidLatLng(lat, lng) {
  const la = parseFloat(lat);
  const ln = parseFloat(lng);
  if (isNaN(la) || isNaN(ln)) return false;
  if (la === 0 && ln === 0) return false;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return false;
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

    // Start point: use lat/lng only when valid (not 0,0); else use address
    if (isValidLatLng(startLat, startLng)) {
      points.push({ lat: startLat, lng: startLng });
    } else if (isValidLocationString(startAddress)) {
      points.push({ address: startAddress });
    }

    if (isValidLatLng(endLat, endLng)) {
      points.push({ lat: endLat, lng: endLng });
    } else if (isValidLocationString(endAddress)) {
      points.push({ address: endAddress });
    }
  });

  return points;
}

/**
 * Collect one route (start→end) per mileage entry for a specific day.
 * Each route is [startPoint, endPoint] with points as { lat, lng } or { address }.
 * Only includes a route when both start and end have at least one valid point.
 * Use this to draw separate paths for each trip (e.g. 2 entries → 2 routes).
 */
function collectRoutesForDay(mileageEntries) {
  const routes = [];

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

    let startPoint = null;
    if (isValidLatLng(startLat, startLng)) {
      startPoint = { lat: startLat, lng: startLng };
    } else if (isValidLocationString(startAddress)) {
      startPoint = { address: startAddress };
    }

    let endPoint = null;
    if (isValidLatLng(endLat, endLng)) {
      endPoint = { lat: endLat, lng: endLng };
    } else if (isValidLocationString(endAddress)) {
      endPoint = { address: endAddress };
    }

    if (startPoint && endPoint) {
      routes.push([startPoint, endPoint]);
    }
  });

  return routes;
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

  // With only one point, set explicit center and zoom so the map doesn't default to a wide/water view
  if (points.length === 1) {
    const p = points[0];
    if (p.lat != null && p.lng != null) {
      params.append('center', `${p.lat},${p.lng}`);
    } else if (p.address) {
      params.append('center', p.address);
    }
    params.append('zoom', String(options.zoom != null ? options.zoom : 14));
  }

  // Markers: use lat,lng when available (more reliable), else address
  points.forEach((p, index) => {
    const label = (index + 1).toString();
    const loc = (p.lat != null && p.lng != null)
      ? `${p.lat},${p.lng}`
      : encodeURIComponent(p.address || '');
    params.append('markers', `color:blue|label:${label}|${loc}`);
  });

  // Path: use lat,lng when available so the route actually draws (need 2+ points)
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
 * Generate Google Maps Static API URL from multiple routes (one path per route).
 * @param {Array<Array<{lat?, lng?, address?}>>} routes - Array of [startPoint, endPoint] per mileage entry
 * @param {Object} options - size, maptype, zoom
 * @returns {string} Google Maps Static API URL
 */
function generateStaticMapUrlFromRoutes(routes, options = {}) {
  if (!isConfigured()) {
    throw new Error('Google Maps API key is not configured');
  }
  if (!routes || routes.length === 0) {
    throw new Error('No routes provided for map');
  }

  const allPoints = [];
  routes.forEach(route => {
    route.forEach(p => {
      if ((p.lat != null && p.lng != null) || isValidLocationString(p.address)) {
        allPoints.push(p);
      }
    });
  });
  if (allPoints.length === 0) {
    throw new Error('No valid points in routes for map');
  }

  const size = options.size || '600x400';
  const maptype = options.maptype || 'roadmap';
  const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';
  const params = new URLSearchParams();

  params.append('size', size);
  params.append('maptype', maptype);
  params.append('key', GOOGLE_MAPS_API_KEY);

  if (allPoints.length === 1) {
    const p = allPoints[0];
    if (p.lat != null && p.lng != null) {
      params.append('center', `${p.lat},${p.lng}`);
    } else if (p.address) {
      params.append('center', p.address);
    }
    params.append('zoom', String(options.zoom != null ? options.zoom : 14));
  }

  allPoints.forEach((p, index) => {
    const label = (index + 1).toString();
    const loc = (p.lat != null && p.lng != null)
      ? `${p.lat},${p.lng}`
      : encodeURIComponent(p.address || '');
    params.append('markers', `color:blue|label:${label}|${loc}`);
  });

  routes.forEach(route => {
    const pathPoints = route.filter(p => (p.lat != null && p.lng != null) || isValidLocationString(p.address));
    if (pathPoints.length >= 2) {
      const pathPart = pathPoints
        .map(p => (p.lat != null && p.lng != null) ? `${p.lat},${p.lng}` : encodeURIComponent(p.address || ''))
        .join('|');
      params.append('path', `color:0x0000ff|weight:5|${pathPart}`);
    }
  });

  const url = `${baseUrl}?${params.toString()}`;
  if (url.length > 8192) {
    debugLog('⚠️ Static Map URL length exceeds 8192; request may fail.');
  }
  return url;
}

/**
 * Download static map image for multiple routes (one path per mileage entry).
 * @param {Array<Array<{lat?, lng?, address?}>>} routes - From collectRoutesForDay(mileageEntries)
 * @param {Object} options - size, maptype, etc.
 * @returns {Promise<Buffer>} Image buffer
 */
async function downloadStaticMapImageFromRoutes(routes, options = {}) {
  if (!routes || routes.length === 0) {
    throw new Error('No routes provided for map');
  }
  try {
    const url = generateStaticMapUrlFromRoutes(routes, options);
    const pointCount = routes.reduce((sum, r) => sum + r.length, 0);
    debugLog(`🗺️ Downloading Google Maps static image for ${routes.length} routes (${pointCount} points)`);
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    const warning = response.headers && response.headers['x-staticmap-api-warning'];
    if (warning) {
      debugError('❌ Google Maps API warning (do not embed):', warning);
      throw new Error(`Map image failed (g.co/staticmaperror). ${warning}`);
    }
    const buffer = Buffer.from(response.data);
    if (buffer.length < 500) {
      debugError('❌ Google Maps returned very small image (likely error image)');
      throw new Error('Map image failed (g.co/staticmaperror). Check API key and that Static Maps API is enabled.');
    }
    if (isStaticMapErrorImage(buffer)) {
      debugError('❌ Google Maps returned 100x100 error tile (staticmaperror)');
      throw new Error('Map image failed (g.co/staticmaperror). Check API key, billing, and that Static Maps API is enabled.');
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
    const warning = response.headers && response.headers['x-staticmap-api-warning'];
    if (warning) {
      debugError('❌ Google Maps API warning (do not embed):', warning);
      throw new Error(`Map image failed (g.co/staticmaperror). ${warning}`);
    }
    const buffer = Buffer.from(response.data);
    if (buffer.length < 500) {
      debugError('❌ Google Maps returned very small image (likely error image)');
      throw new Error('Map image failed (g.co/staticmaperror). Check API key and that Static Maps API is enabled.');
    }
    if (isStaticMapErrorImage(buffer)) {
      debugError('❌ Google Maps returned 100x100 error tile (staticmaperror)');
      throw new Error('Map image failed (g.co/staticmaperror). Check API key, billing, and that Static Maps API is enabled.');
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
  isValidLatLng,
  collectPointsForDay,
  collectRoutesForDay,
  collectPointsForCostCenter,
  collectAddressesForDay,
  collectAddressesForCostCenter,
  buildWaypointsParam,
  buildMarkersParam,
  generateStaticMapUrl,
  generateStaticMapUrlFromRoutes,
  downloadStaticMapImage,
  downloadStaticMapImageFromRoutes,
  imageBufferToDataUrl
};

