/**
 * Normalize base address locations for storage so Mileage Entries always store
 * "BA (address)" or "BA2 (address)" instead of "Base Address", "BA", or raw address.
 * Used by dataEntries when saving mileage entries and by export when formatting.
 */

function getBaseAddressLabel(addr, baseAddress, baseAddress2) {
  if (!addr || typeof addr !== 'string') return null;
  const loc = (addr || '').toLowerCase().trim();
  if (loc === 'ba' || loc === 'base address' || loc === 'base' || loc === 'home base') return baseAddress2 ? 'BA1' : 'BA';
  const extract = (s) => { const m = (s || '').match(/\(([^)]+)\)/); return m ? m[1].toLowerCase().trim() : (s || '').toLowerCase().trim(); };
  const addrPart = extract(addr);
  if (baseAddress && (addrPart === (baseAddress || '').toLowerCase().trim() || extract(baseAddress) === addrPart)) return baseAddress2 ? 'BA1' : 'BA';
  if (baseAddress2 && (addrPart === (baseAddress2 || '').toLowerCase().trim() || extract(baseAddress2) === addrPart)) return 'BA2';
  return null;
}

const STATE_ABBR = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
  kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA',
  michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY'
};

function normalizeAddressLine(address) {
  const raw = (address || '').trim();
  if (!raw) return '';

  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  const street = parts[0];
  const city = parts.length > 2 ? parts[1] : '';
  const trailing = parts.length > 2 ? parts.slice(2).join(', ') : parts[1];
  const stateZipMatch = trailing.match(/\b([A-Za-z]{2}|[A-Za-z]+(?:\s+[A-Za-z]+)*)\s*(\d{5}(?:-\d{4})?)?\b/);

  if (stateZipMatch) {
    const stateRaw = (stateZipMatch[1] || '').trim().toLowerCase();
    const state = (STATE_ABBR[stateRaw] || stateRaw.toUpperCase()).slice(0, 2);
    const zip = (stateZipMatch[2] || '').trim();
    const line2 = [city, state].filter(Boolean).join(', ');
    return `${street}${line2 ? `, ${line2}` : ''}${zip ? ` ${zip}` : ''}`.trim();
  }

  return [street, parts.slice(1).join(', ')].filter(Boolean).join(', ');
}

function parseBaseAddress(address) {
  const raw = (address || '').trim();
  const empty = { street: '', city: '', state: '', zip: '' };
  if (!raw) return empty;

  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 4) {
    const zipMatch = parts[parts.length - 1].match(/^(\d{5}(?:-\d{4})?)\s*$/);
    const stateMatch = parts[parts.length - 2].match(/^([A-Za-z]{2})\s*$/);
    if (zipMatch && stateMatch) {
      return {
        street: parts.slice(0, -3).join(', '),
        city: parts[parts.length - 3],
        state: stateMatch[1].toUpperCase(),
        zip: zipMatch[1]
      };
    }
  }

  if (parts.length >= 3) {
    const stateZipMatch = parts[parts.length - 1].match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
    if (stateZipMatch) {
      return {
        street: parts.slice(0, -2).join(', '),
        city: parts[parts.length - 2],
        state: stateZipMatch[1].toUpperCase(),
        zip: stateZipMatch[2]
      };
    }
  }

  return { ...empty, street: raw };
}

function formatBaseAddressForStorage(address) {
  const parsed = parseBaseAddress(address);
  const street = (parsed.street || '').trim();
  const city = (parsed.city || '').trim();
  const state = (parsed.state || '').trim().toUpperCase().slice(0, 2);
  const zip = (parsed.zip || '').trim().replace(/\D/g, '').slice(0, 10);

  if (!street) return '';
  if (city && state && zip) return `${street}, ${city}, ${state} ${zip}`;
  return address || '';
}

function abbreviateForDisplay(addr) {
  if (!addr || typeof addr !== 'string') return addr;
  let s = addr
    .replace(/\bRoad\b/gi, 'Rd').replace(/\bStreet\b/gi, 'St').replace(/\bAvenue\b/gi, 'Ave')
    .replace(/\bLane\b/gi, 'Ln').replace(/\bDrive\b/gi, 'Dr').replace(/\bBoulevard\b/gi, 'Blvd')
    .replace(/\bCourt\b/gi, 'Ct').replace(/\bCircle\b/gi, 'Cir').replace(/\bPlace\b/gi, 'Pl')
    .replace(/\bHighway\b/gi, 'Hwy').replace(/\bParkway\b/gi, 'Pkwy').replace(/\bWay\b/gi, 'Way')
    .replace(/\bTerrace\b/gi, 'Ter').replace(/\bTrail\b/gi, 'Trl').replace(/\bSquare\b/gi, 'Sq')
    .replace(/\bBuilding\b/gi, 'Bldg').replace(/\bSuite\b/gi, 'Ste').replace(/\bApartment\b/gi, 'Apt');
  Object.keys(STATE_ABBR).sort((a, b) => b.length - a.length).forEach(full => {
    const re = new RegExp(`\\b${full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    s = s.replace(re, STATE_ABBR[full]);
  });
  return s.trim();
}

/**
 * If the given location is the employee's base (by name or address match), return
 * canonical storage form: { display, name, address } for "BA (address)" or "BA2 (address)".
 * Otherwise return null.
 */
function normalizeLocationForStorage(name, address, baseAddress, baseAddress2) {
  const addr = (address || '').trim();
  const displayName = (name || '').trim();
  if (!addr && !displayName) return null;

  const ba = getBaseAddressLabel(addr || displayName, baseAddress, baseAddress2);
  const nameIsBase = /^(ba|base address|base|home base)\s*$/i.test(displayName);
  if (!ba && !nameIsBase) return null;
  // Name-only "BA" must not override a changed address that is no longer the employee base.
  if (nameIsBase && !ba) return null;

  let baseAddr = (ba === 'BA2' ? (baseAddress2 || '') : (baseAddress || ''));
  const paren = (baseAddr || '').match(/\(([^)]+)\)/);
  if (paren) baseAddr = paren[1].trim();
  if (!baseAddr) return { display: ba === 'BA2' ? 'BA2' : 'BA', name: ba === 'BA2' ? 'BA2' : 'BA', address: '' };

  const prefix = ba === 'BA2' ? 'BA2' : 'BA';
  return {
    display: `${prefix} (${abbreviateForDisplay(baseAddr)})`,
    name: prefix,
    address: baseAddr
  };
}

module.exports = { getBaseAddressLabel, abbreviateForDisplay, normalizeAddressLine, normalizeLocationForStorage, formatBaseAddressForStorage };
