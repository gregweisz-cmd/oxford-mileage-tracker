import { OxfordHouse } from '../types';

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
): OxfordHouse {
  const zip = String(raw.zipCode || raw.zip || '').trim();
  const record = {
    name: String(raw.name || '').trim(),
    address: String(raw.address || '').trim(),
    city: String(raw.city || '').trim(),
    state: String(raw.state || '').trim(),
    zipCode: zip,
    phoneNumber: String(raw.phoneNumber || '').trim(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const id = String(raw.id || '').trim() || buildOxfordHouseStableId({ ...record, zip });
  return {
    id,
    ...record,
  };
}

export function resolveOxfordHouseByStoredId(
  storedId: string,
  houses: OxfordHouse[]
): OxfordHouse | null {
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
