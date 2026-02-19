/**
 * Google Maps Static API Service
 *
 * Generates static map images for PDF expense reports (one map per trip, zoomed to route).
 * Uses Maps Static API only — separate from Geocoding/Distance Matrix used by the
 * "Calculate miles" button. All use the same GOOGLE_MAPS_API_KEY; Static API must be
 * enabled in Google Cloud for PDF maps to work.
 */

const axios = require('axios');
const { debugLog, debugError } = require('../debug');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Check if Google Maps API is configured (set and not the placeholder)
 */
function isConfigured() {
  if (!GOOGLE_MAPS_API_KEY || typeof GOOGLE_MAPS_API_KEY !== 'string') return false;
  const trimmed = GOOGLE_MAPS_API_KEY.trim();
  if (!trimmed) return false;
  if (trimmed === 'YOUR_GOOGLE_MAPS_API_KEY_HERE' || /^your[_-]?api[_-]?key/i.test(trimmed)) return false;
  return true;
}

/** Return URL with API key redacted for safe logging */
function redactStaticMapUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (!GOOGLE_MAPS_API_KEY) return url;
  return url.replace(GOOGLE_MAPS_API_KEY, 'REDACTED');
}

/**
 * Detect if buffer is Google's static map error image (100x100 PNG).
 * Google returns 200 OK with a small error tile when the request fails (e.g. API key/billing).
 * We request 600x400; 100x100 or very small dimensions = error image — do not embed in PDF.
 */
function isStaticMapErrorImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return false;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== sig[i]) return false;
  }
  // PNG IHDR: width at offset 16, height at 20 (4 bytes each, big-endian)
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
 * Strip to address-only for geocoding. "Name (123 Main St, City, ST Zip)" -> "123 Main St, City, ST Zip".
 * Geocoding works better with plain addresses; names in parentheses can cause failures.
 */
function addressOnlyForGeocoding(str) {
  if (!str || typeof str !== 'string') return '';
  const t = str.trim();
  const match = t.match(/\(([^)]+)\)$/);
  if (match) return match[1].trim();
  return t;
}

/**
 * Resolve an address to lat/lng via Geocoding API. Returns { lat, lng } or null on failure.
 * Biases results to the US (region=us) to avoid wrong-country matches (e.g. same city name abroad).
 * @param {string} address - Address to geocode
 * @param {Object} options - Optional: { biasLatLng: { lat, lng } } to bias results near a point (e.g. employee base)
 */
async function geocodeToLatLng(address, options = {}) {
  if (!isConfigured() || !address || typeof address !== 'string') return null;
  const cleaned = addressOnlyForGeocoding(address) || address.trim();
  if (cleaned.length < 3) return null;
  try {
    let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleaned)}&region=us&components=country:US&key=${GOOGLE_MAPS_API_KEY}`;
    const bias = options.biasLatLng;
    if (bias && typeof bias.lat === 'number' && typeof bias.lng === 'number') {
      url += `&location=${bias.lat},${bias.lng}&radius=100000`;
    }
    const response = await axios.get(url, { timeout: 8000 });
    const data = response.data;
    if (data.status !== 'OK' || !data.results || data.results.length === 0) return null;
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  } catch (err) {
    debugLog('Geocoding failed for address:', cleaned.slice(0, 50), err.message);
    return null;
  }
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
    const startRaw = (entry.startLocationAddress || entry.startLocationName || entry.startLocation || '').trim();
    const endRaw = (entry.endLocationAddress || entry.endLocationName || entry.endLocation || '').trim();
    const startAddress = addressOnlyForGeocoding(startRaw) || startRaw;
    const endAddress = addressOnlyForGeocoding(endRaw) || endRaw;

    // Start point: use lat/lng only when valid (not 0,0); else use address-only for geocoding
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
    const startRaw = (entry.startLocationAddress || entry.startLocationName || entry.startLocation || '').trim();
    const endRaw = (entry.endLocationAddress || entry.endLocationName || entry.endLocation || '').trim();
    const startAddress = addressOnlyForGeocoding(startRaw) || startRaw;
    const endAddress = addressOnlyForGeocoding(endRaw) || endRaw;

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

  // Single point: set center and zoom explicitly so we don't get a wide ocean view
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

  // Single point: center and zoom; otherwise API auto-fits to path/markers
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
 * Format a point for Directions API: "lat,lng" or address string.
 * @param {{ lat?, lng?, address? }} p
 * @returns {string}
 */
function formatPointForDirections(p) {
  if (p.lat != null && p.lng != null && isValidLatLng(p.lat, p.lng)) {
    return `${p.lat},${p.lng}`;
  }
  if (isValidLocationString(p.address)) {
    return p.address;
  }
  return '';
}

/**
 * Get full Directions API result: polyline plus distance/duration for PDF trip info.
 * Requires Directions API enabled for the same API key. Returns null on failure.
 * @param {{ lat?, lng?, address? }} origin
 * @param {{ lat?, lng?, address? }} destination
 * @returns {Promise<{ polyline: string, distanceText: string, durationText: string, startAddress: string, endAddress: string }|null>}
 */
async function getDirectionsResult(origin, destination) {
  if (!isConfigured()) return null;
  const originStr = formatPointForDirections(origin);
  const destStr = formatPointForDirections(destination);
  if (!originStr || !destStr) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url, { timeout: 8000 });
    const data = response.data;
    if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
      debugLog('Directions API:', data.status, data.error_message || '');
      return null;
    }
    const route = data.routes[0];
    const polyline = route.overview_polyline;
    if (!polyline || !polyline.points) return null;
    const leg = route.legs && route.legs[0];
    const distanceText = (leg && leg.distance && leg.distance.text) ? leg.distance.text : '';
    const durationText = (leg && leg.duration && leg.duration.text) ? leg.duration.text : '';
    const startAddress = (leg && leg.start_address) ? leg.start_address : '';
    const endAddress = (leg && leg.end_address) ? leg.end_address : '';
    return {
      polyline: polyline.points,
      distanceText,
      durationText,
      startAddress,
      endAddress
    };
  } catch (err) {
    debugLog('Directions API error:', err.message);
    return null;
  }
}

/** @deprecated Use getDirectionsResult. Returns polyline only for backward compatibility. */
async function getDirectionsEncodedPolyline(origin, destination) {
  const result = await getDirectionsResult(origin, destination);
  return result ? result.polyline : null;
}

/**
 * Build Static Map URL using an encoded polyline (actual driven route).
 * @param {string} encodedPolyline - From Directions API overview_polyline.points
 * @param {Object} options - size, maptype
 * @returns {string} Static Map URL
 */
function generateStaticMapUrlFromEncodedPolyline(encodedPolyline, options = {}) {
  if (!isConfigured()) {
    throw new Error('Google Maps API key is not configured');
  }
  const size = options.size || '600x400';
  const maptype = options.maptype || 'roadmap';
  const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';
  const params = new URLSearchParams();
  params.append('size', size);
  params.append('maptype', maptype);
  params.append('key', GOOGLE_MAPS_API_KEY);
  params.append('path', `enc:${encodedPolyline}`);
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Download static map image for multiple routes (one path per mileage entry).
 * For a single route with two points, uses Directions API to draw the actual driven route when possible.
 * @param {Array<Array<{lat?, lng?, address?}>>} routes - From collectRoutesForDay(mileageEntries)
 * @param {Object} options - size, maptype, etc.
 * @returns {Promise<Buffer>} Image buffer
 */
async function downloadStaticMapImageFromRoutes(routes, options = {}) {
  if (!routes || routes.length === 0) {
    throw new Error('No routes provided for map');
  }
  let url;
  let tripSummary = null;
  const singleRoute = routes.length === 1 && routes[0].length >= 2;
  const hasAddressOnly = (p) => p && p.address && !isValidLatLng(p.lat, p.lng);
  const needBiasResolve = singleRoute && options.biasLatLng && (hasAddressOnly(routes[0][0]) || hasAddressOnly(routes[0][1]));
  if (singleRoute && !needBiasResolve) {
    const origin = routes[0][0];
    const destination = routes[0][1];
    const result = await getDirectionsResult(origin, destination);
    if (result) {
      url = generateStaticMapUrlFromEncodedPolyline(result.polyline, options);
      debugLog('🗺️ Using Directions API route (driven path) for static map');
      if (result.distanceText || result.durationText) {
        tripSummary = {
          distanceText: result.distanceText,
          durationText: result.durationText,
          startAddress: result.startAddress || '',
          endAddress: result.endAddress || ''
        };
      }
    }
  }
  if (!url) {
    // Resolve all address points to lat/lng so the Static Map URL uses only coordinates.
    const resolvedRoutes = [];
    for (const route of routes) {
      const resolved = [];
      for (const p of route) {
        if (p.lat != null && p.lng != null && isValidLatLng(p.lat, p.lng)) {
          resolved.push({ lat: p.lat, lng: p.lng });
        } else if (p.address) {
          const coords = await geocodeToLatLng(p.address, { biasLatLng: options.biasLatLng });
          if (coords) resolved.push(coords);
        }
      }
      if (resolved.length >= 2) resolvedRoutes.push(resolved);
    }
    if (resolvedRoutes.length > 0) {
      // For a single route, try Directions with resolved lat/lng to get the road path (not straight line through water).
      const singleResolved = resolvedRoutes.length === 1 && resolvedRoutes[0].length >= 2;
      if (singleResolved) {
        const origin = resolvedRoutes[0][0];
        const dest = resolvedRoutes[0][1];
        const result = await getDirectionsResult(origin, dest);
        if (result) {
          url = generateStaticMapUrlFromEncodedPolyline(result.polyline, options);
          debugLog('🗺️ Using Directions API route (from resolved coords) for static map');
          if (result.distanceText || result.durationText) {
            tripSummary = {
              distanceText: result.distanceText,
              durationText: result.durationText,
              startAddress: result.startAddress || '',
              endAddress: result.endAddress || ''
            };
          }
        }
      }
      if (!url) {
        url = generateStaticMapUrlFromRoutes(resolvedRoutes, options);
      }
    }
    if (!url) {
      throw new Error('Could not geocode route addresses. Check that addresses are valid and Geocoding API is enabled.');
    }
  }
  try {
    const pointCount = routes.reduce((sum, r) => sum + r.length, 0);
    debugLog(`🗺️ Downloading Google Maps static image for ${routes.length} routes (${pointCount} points)`);
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    // Google can return 200 with X-Staticmap-API-Warning (e.g. geocoding failed) — do not embed
    const warning = response.headers && response.headers['x-staticmap-api-warning'];
    if (warning) {
      debugError('❌ Google Maps API warning (do not embed):', warning);
      console.error('Static Map request (key redacted):', redactStaticMapUrl(url));
      throw new Error(`Map image failed (g.co/staticmaperror). ${warning}`);
    }
    const buffer = Buffer.from(response.data);
    if (buffer.length < 500) {
      debugError('❌ Google Maps returned very small image (likely error image)');
      console.error('Static Map request (key redacted):', redactStaticMapUrl(url));
      throw new Error('Map image failed (g.co/staticmaperror). Check API key and that Static Maps API is enabled.');
    }
    // Error tile is 100x100 PNG; we request 600x400 — reject so PDF shows fallback text
    if (isStaticMapErrorImage(buffer)) {
      debugError('❌ Google Maps returned 200 OK but body is the 100x100 error tile (staticmaperror). Common causes: (1) Billing not enabled on the GCP project, (2) API key has application restriction that blocks server requests e.g. HTTP referrer only, (3) API key restriction does not include Maps Static API.');
      console.error('Static Map request (key redacted):', redactStaticMapUrl(url));
      throw new Error('Google returned map error tile. Usually: billing not enabled on GCP project, or key restrictions block server (use None or IP), or Maps Static API not in key’s allowed APIs. See g.co/staticmaperror.');
    }
    if (tripSummary) {
      return { imageBuffer: buffer, tripSummary };
    }
    return buffer;
  } catch (error) {
    debugError('❌ Error downloading Google Maps static image:', error);
    if (url) console.error('Static Map request (key redacted):', redactStaticMapUrl(url));
    if (error.response) {
      let errorMessage = error.response.data;
      if (Buffer.isBuffer(errorMessage)) {
        errorMessage = errorMessage.toString('utf-8');
      }
      debugError('❌ Google Maps API error:', error.response.status, errorMessage);
      throw new Error(`Google Maps API ${error.response.status}: ${errorMessage || error.message}`);
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
      console.error('Static Map request (key redacted):', redactStaticMapUrl(url));
      throw new Error(`Map image failed (g.co/staticmaperror). ${warning}`);
    }
    const buffer = Buffer.from(response.data);
    if (buffer.length < 500) {
      debugError('❌ Google Maps returned very small image (likely error image)');
      console.error('Static Map request (key redacted):', redactStaticMapUrl(url));
      throw new Error('Map image failed (g.co/staticmaperror). Check API key and that Static Maps API is enabled.');
    }
    if (isStaticMapErrorImage(buffer)) {
      debugError('❌ Google Maps returned 200 OK but body is the 100x100 error tile (staticmaperror). Common causes: (1) Billing not enabled on the GCP project, (2) API key has application restriction that blocks server requests e.g. HTTP referrer only, (3) API key restriction does not include Maps Static API.');
      console.error('Static Map request (key redacted):', redactStaticMapUrl(url));
      throw new Error('Google returned map error tile. Usually: billing not enabled on GCP project, or key restrictions block server (use None or IP), or Maps Static API not in key’s allowed APIs. See g.co/staticmaperror.');
    }
    return buffer;
  } catch (error) {
    debugError('❌ Error downloading Google Maps static image:', error);
    if (url) console.error('Static Map request (key redacted):', redactStaticMapUrl(url));
    if (error.response) {
      let errorMessage = error.response.data;
      if (Buffer.isBuffer(errorMessage)) {
        errorMessage = errorMessage.toString('utf-8');
      }
      debugError('❌ Google Maps API error:', error.response.status, errorMessage);
      throw new Error(`Google Maps API ${error.response.status}: ${errorMessage || error.message}`);
    }
    throw new Error(`Failed to download Google Maps image: ${error.message}`);
  }
}

/**
 * Convert image buffer to base64 data URL for PDF embedding.
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
  geocodeToLatLng,
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

