/**
 * Enrich incomplete mileage addresses using stored GPS coordinates.
 */
const googleMapsService = require('../services/googleMapsService');

function looksLikeFullAddress(str) {
  if (!str || typeof str !== 'string') return false;
  const t = str.trim();
  if (!t.includes(',')) return false;
  return (
    /\d{5}(-\d{4})?/.test(t) ||
    /, [A-Z]{2}\s*\d/.test(t) ||
    /, [A-Z]{2}$/.test(t)
  );
}

function hasUsableCoords(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln) && la !== 0 && ln !== 0;
}

/**
 * When address is street-only but lat/lng exist (typical GPS trips), reverse-geocode to full line.
 */
async function enrichAddressIfNeeded(address, lat, lng) {
  const trimmed = (address || '').trim();
  if (looksLikeFullAddress(trimmed)) return trimmed;
  if (!hasUsableCoords(lat, lng)) return trimmed;

  try {
    const data = await googleMapsService.reverseGeocodeLatLng(lat, lng);
    const formatted = data?.results?.[0]?.formatted_address;
    if (!formatted || typeof formatted !== 'string') return trimmed;

    const formattedTrimmed = formatted.trim();
    if (!trimmed) return formattedTrimmed;

    // Prefer Google's full formatted address when it contains the saved street line
    if (formattedTrimmed.toLowerCase().includes(trimmed.toLowerCase())) {
      return formattedTrimmed;
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}

module.exports = {
  looksLikeFullAddress,
  enrichAddressIfNeeded,
};
