function normalizeOxfordHouseIdPart(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildOxfordHouseStableId(house) {
  const parts = [
    house.name,
    house.address,
    house.city,
    house.state,
    house.zip || house.zipCode || '',
  ].map(normalizeOxfordHouseIdPart);
  const key = parts.join('|');
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0;
  }
  return `oh-${(hash >>> 0).toString(36)}`;
}

function normalizeOxfordHouseRecord(raw, index) {
  const zip = String(raw.zipCode || raw.zip || '').trim();
  const record = {
    name: String(raw.name || '').trim(),
    address: String(raw.address || '').trim(),
    city: String(raw.city || '').trim(),
    state: String(raw.state || '').trim(),
    zip,
    zipCode: zip,
    fullAddress:
      raw.fullAddress ||
      `${raw.address || ''}, ${raw.city || ''}, ${raw.state || ''} ${zip}`.trim(),
  };
  record.id = String(raw.id || '').trim() || buildOxfordHouseStableId(record);
  if (index != null) {
    record.legacyIndexId = `oh_${index}`;
  }
  return record;
}

function normalizeOxfordHouseList(houses) {
  return (houses || []).map((house, index) => normalizeOxfordHouseRecord(house, index));
}

function resolveOxfordHouseByStoredId(storedId, houses) {
  if (!storedId || !houses?.length) return null;
  const id = String(storedId).trim();

  const direct = houses.find((house) => house.id === id);
  if (direct) return direct;

  const indexMatch = id.match(/^oh_(\d+)$/);
  if (indexMatch) {
    const idx = parseInt(indexMatch[1], 10);
    if (Number.isFinite(idx) && houses[idx]) return houses[idx];
  }

  const normalizedId = id.toLowerCase();
  return (
    houses.find((house) => {
      const name = (house.name || '').trim().toLowerCase();
      const shortName = name.replace(/^oh\s+/, '');
      return name === normalizedId || shortName === normalizedId;
    }) || null
  );
}

module.exports = {
  buildOxfordHouseStableId,
  normalizeOxfordHouseRecord,
  normalizeOxfordHouseList,
  resolveOxfordHouseByStoredId,
};
