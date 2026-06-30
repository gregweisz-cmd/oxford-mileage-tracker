export interface OxfordHouseLike {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  zipCode?: string;
  fullAddress?: string;
}

function normalizeOxfordHouseIdPart(value: string | undefined): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildOxfordHouseStableId(house: {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  zipCode?: string;
}): string {
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

export function normalizeOxfordHouseRecord(
  raw: Record<string, unknown>,
  index?: number
): OxfordHouseLike {
  const zip = String(raw.zipCode || raw.zip || '').trim();
  const record: OxfordHouseLike = {
    name: String(raw.name || '').trim(),
    address: String(raw.address || '').trim(),
    city: String(raw.city || '').trim(),
    state: String(raw.state || '').trim(),
    zip,
    zipCode: zip,
    fullAddress:
      String(raw.fullAddress || '').trim() ||
      `${raw.address || ''}, ${raw.city || ''}, ${raw.state || ''} ${zip}`.trim(),
    id: '',
  };
  record.id = String(raw.id || '').trim() || buildOxfordHouseStableId(record);
  if (index != null) {
    (record as OxfordHouseLike & { legacyIndexId?: string }).legacyIndexId = `oh_${index}`;
  }
  return record;
}

export function normalizeOxfordHouseList(
  houses: Record<string, unknown>[]
): OxfordHouseLike[] {
  return (houses || []).map((house, index) => normalizeOxfordHouseRecord(house, index));
}

export function resolveOxfordHouseByStoredId(
  storedId: string,
  houses: OxfordHouseLike[]
): OxfordHouseLike | null {
  if (!storedId || !houses.length) return null;
  const id = storedId.trim();

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
