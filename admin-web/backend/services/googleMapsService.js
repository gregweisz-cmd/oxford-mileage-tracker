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
 * Collect addresses from mileage entries for a specific day
 * Returns array of addresses in chronological order: [start1, end1, start2, end2, ...]
 */
function collectAddressesForDay(mileageEntries) {
  const addresses = [];
  
  // Sort entries by creation time to maintain chronological order
  const sortedEntries = [...mileageEntries].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.date).getTime();
    const timeB = new Date(b.createdAt || b.date).getTime();
    return timeA - timeB;
  });
  
  sortedEntries.forEach(entry => {
    // Use address if available, otherwise fall back to location name/description
    const startAddress = entry.startLocationAddress || entry.startLocationName || entry.startLocation;
    const endAddress = entry.endLocationAddress || entry.endLocationName || entry.endLocation;
    
    if (startAddress) {
      addresses.push(startAddress);
    }
    if (endAddress) {
      addresses.push(endAddress);
    }
  });
  
  return addresses;
}

/**
 * Collect addresses from mileage entries for a specific cost center
 * Returns array of addresses in chronological order across all days
 */
function collectAddressesForCostCenter(mileageEntries) {
  // Group by date first, then sort dates
  const entriesByDate = {};
  mileageEntries.forEach(entry => {
    const dateKey = entry.date.split('T')[0] || entry.date; // YYYY-MM-DD
    if (!entriesByDate[dateKey]) {
      entriesByDate[dateKey] = [];
    }
    entriesByDate[dateKey].push(entry);
  });
  
  const addresses = [];
  const sortedDates = Object.keys(entriesByDate).sort();
  
  sortedDates.forEach(date => {
    const dayAddresses = collectAddressesForDay(entriesByDate[date]);
    addresses.push(...dayAddresses);
  });
  
  return addresses;
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
 * Generate Google Maps Static API URL
 * @param {string[]} addresses - Array of addresses to display
 * @param {Object} options - Additional options (size, maptype, etc.)
 * @returns {string} Google Maps Static API URL
 */
function generateStaticMapUrl(addresses, options = {}) {
  if (!isConfigured()) {
    throw new Error('Google Maps API key is not configured');
  }
  
  if (addresses.length === 0) {
    throw new Error('No addresses provided');
  }
  
  const size = options.size || '600x400';
  const maptype = options.maptype || 'roadmap';
  
  const baseUrl = 'https://maps.googleapis.com/maps/api/staticmap';
  const params = new URLSearchParams();
  
  params.append('size', size);
  params.append('maptype', maptype);
  params.append('key', GOOGLE_MAPS_API_KEY);
  
  // Add markers for each address
  addresses.forEach((addr, index) => {
    const label = (index + 1).toString();
    params.append('markers', `color:blue|label:${label}|${encodeURIComponent(addr)}`);
  });
  
  // Add path connecting all addresses
  if (addresses.length > 1) {
    const pathAddresses = addresses.map(addr => encodeURIComponent(addr)).join('|');
    params.append('path', `color:0x0000ff|weight:5|${pathAddresses}`);
  }
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Download static map image from Google Maps API
 * @param {string[]} addresses - Array of addresses
 * @param {Object} options - Additional options
 * @returns {Promise<Buffer>} Image buffer
 */
async function downloadStaticMapImage(addresses, options = {}) {
  try {
    const url = generateStaticMapUrl(addresses, options);
    debugLog(`🗺️ Downloading Google Maps static image for ${addresses.length} addresses`);
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000 // 10 second timeout
    });
    
    return Buffer.from(response.data);
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
  collectAddressesForDay,
  collectAddressesForCostCenter,
  buildWaypointsParam,
  buildMarkersParam,
  generateStaticMapUrl,
  downloadStaticMapImage,
  imageBufferToDataUrl
};

