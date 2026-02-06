/**
 * External Employee Sync Service
 * Fetches employee data from https://api.appwarmer.com/api/employee
 * and creates/updates local employees by email.
 *
 * Requires env: EMPLOYEE_API_TOKEN or APPWARMER_EMPLOYEE_API_TOKEN
 */

const dbService = require('./dbService');
const helpers = require('../utils/helpers');
const { debugLog, debugError } = require('../debug');

const EXTERNAL_API_URL = 'https://api.appwarmer.com/api/employee';
const TOKEN_ENV_KEYS = ['EMPLOYEE_API_TOKEN', 'APPWARMER_EMPLOYEE_API_TOKEN'];

/**
 * Get the API token from environment
 * @returns {string|null}
 */
function getToken() {
  for (const key of TOKEN_ENV_KEYS) {
    const v = process.env[key];
    if (v && typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Normalize external API response to array of records.
 * Handles: raw array, { data: [] }, { employees: [] }, { users: [] }
 * @param {any} body
 * @returns {Array<object>}
 */
function normalizeResponse(body) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    if (Array.isArray(body.data)) return body.data;
    if (Array.isArray(body.employees)) return body.employees;
    if (Array.isArray(body.Employees)) return body.Employees; // Appwarmer API uses capital E
    if (Array.isArray(body.users)) return body.users;
    if (Array.isArray(body.records)) return body.records;
    if (Array.isArray(body.items)) return body.items;
    if (Array.isArray(body.result)) return body.result;
  }
  return [];
}

/**
 * Format name with proper Mc, Mac, O' capitalization (e.g. Mckinney -> McKinney).
 * @param {string} name
 * @returns {string}
 */
function formatNameForDisplay(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      const mcMatch = word.match(/^([Mm]c)(.+)$/);
      if (mcMatch) {
        return 'Mc' + mcMatch[2].charAt(0).toUpperCase() + mcMatch[2].slice(1).toLowerCase();
      }
      const macMatch = word.match(/^([Mm]ac)(.+)$/);
      if (macMatch && macMatch[2].length > 0) {
        return 'Mac' + macMatch[2].charAt(0).toUpperCase() + macMatch[2].slice(1).toLowerCase();
      }
      const oMatch = word.match(/^[oO]'(.+)$/);
      if (oMatch) {
        return "O'" + oMatch[1].charAt(0).toUpperCase() + oMatch[1].slice(1).toLowerCase();
      }
      return word;
    })
    .join(' ');
}

/**
 * Derive display name from email (e.g. greg.weisz@oxfordhouse.org -> Greg Weisz)
 */
function nameFromEmail(email) {
  const local = (email || '').split('@')[0];
  if (!local) return '';
  return local
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Parse cost centers from external record. Handles:
 * - costCenters, cost_centers, CostCenters, CostCenter (array or string)
 * - costCenter, cost_center, CostCenterName, costCenterName (string)
 * - Department, Departments, department (array or string)
 * - Division, division (string)
 * - Comma/pipe/semicolon-separated strings
 * - Arrays of objects with .name, .code, .value, or stringified
 */
function parseCostCenters(ext) {
  if (!ext || typeof ext !== 'object') return [];
  const raw =
    ext.costCenters ?? ext.cost_centers ?? ext.CostCenters ?? ext.CostCenter ??
    ext.costCenter ?? ext.cost_center ?? ext.CostCenterName ?? ext.costCenterName ??
    ext.Department ?? ext.Departments ?? ext.department ?? ext.departments ??
    ext.Division ?? ext.division ?? ext.Location ?? ext.Locations ?? ext.location;
  if (Array.isArray(raw)) {
    return raw
      .map((v) => (v && typeof v === 'object' ? (v.name ?? v.code ?? v.value ?? v.displayName ?? '') : String(v)))
      .filter((s) => s && s.trim());
  }
  if (raw && typeof raw === 'object') {
    const s = raw.name ?? raw.code ?? raw.value ?? raw.displayName ?? '';
    return s ? [String(s).trim()] : [];
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/[,|;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Map one external record to our employee shape.
 * Tolerates: name, email, userName (Appwarmer), cost_center, cost_centers, position, phone, address, base_address, etc.
 * @param {object} ext
 * @returns {{ name: string, email: string, position: string, costCenters: string[], phoneNumber?: string, baseAddress?: string }|null}
 */
function mapExternalToOur(ext) {
  if (!ext || typeof ext !== 'object') return null;
  const email = (ext.email || ext.Email || ext.mail || ext.userName || '').toString().trim().toLowerCase();
  if (!email || !email.includes('@')) return null;
  let name = (ext.name || ext.Name || ext.fullName || ext.full_name || ext.displayName || ext.DisplayName || '').toString().trim();
  if (!name) name = nameFromEmail(email);
  if (!name) return null;
  name = formatNameForDisplay(name);

  let costCenters = parseCostCenters(ext);
  if (costCenters.length === 0) costCenters = ['Program Services'];

  const position = (ext.position || ext.Position || ext.title || ext.jobTitle || 'Staff').toString().trim() || 'Staff';
  const phoneNumber = (ext.phoneNumber || ext.phone || ext.Phone || ext.telephone || '').toString().trim() || '';
  const baseAddress = (ext.baseAddress || ext.base_address || ext.address || ext.Address || '').toString().trim() || '';

  return {
    name,
    email,
    position,
    costCenters,
    phoneNumber,
    baseAddress,
  };
}

/**
 * Find employee by email (case-insensitive)
 * @param {string} email
 * @returns {Promise<object|null>}
 */
function getEmployeeByEmail(email) {
  return new Promise((resolve, reject) => {
    const db = dbService.getDb();
    db.get('SELECT * FROM employees WHERE LOWER(TRIM(email)) = ?', [email.trim().toLowerCase()], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

/**
 * Create or update one employee from mapped data
 * @param {object} mapped
 * @param {object} [existing] - existing row if update
 * @returns {Promise<{ created: boolean, updated: boolean, id: string }>}
 */
async function upsertOne(mapped, existing) {
  const db = dbService.getDb();
  const now = new Date().toISOString();

  if (existing) {
    const id = existing.id;
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE employees SET
          name = ?, preferredName = ?, position = ?, phoneNumber = ?, baseAddress = ?,
          costCenters = ?, selectedCostCenters = ?, defaultCostCenter = ?, updatedAt = ?
        WHERE id = ?`,
        [
          mapped.name,
          existing.preferredName || '',
          mapped.position,
          mapped.phoneNumber || '',
          mapped.baseAddress || '',
          JSON.stringify(mapped.costCenters),
          JSON.stringify(existing.selectedCostCenters ? (typeof existing.selectedCostCenters === 'string' ? JSON.parse(existing.selectedCostCenters || '[]') : existing.selectedCostCenters) : mapped.costCenters),
          existing.defaultCostCenter || (mapped.costCenters[0] || ''),
          now,
          id,
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });
    return { created: false, updated: true, id };
  }

  const id = helpers.generateEmployeeId(mapped.name);
  const plainPassword = helpers.generateDefaultPassword(mapped.name);
  let hashedPassword;
  try {
    hashedPassword = await helpers.hashPassword(plainPassword);
  } catch (e) {
    throw new Error(`Failed to hash password: ${e.message}`);
  }

  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO employees (id, name, preferredName, email, password, oxfordHouseId, position, role, permissions, phoneNumber, baseAddress, baseAddress2, costCenters, selectedCostCenters, defaultCostCenter, supervisorId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        mapped.name,
        '',
        mapped.email,
        hashedPassword,
        '',
        mapped.position,
        'employee',
        '[]',
        mapped.phoneNumber || '',
        mapped.baseAddress || '',
        '',
        JSON.stringify(mapped.costCenters),
        JSON.stringify(mapped.costCenters),
        mapped.costCenters[0] || '',
        null,
        now,
        now,
      ],
      (err) => (err ? reject(err) : resolve())
    );
  });
  return { created: true, updated: false, id };
}

/**
 * Fetch from external API and sync into local DB
 * @returns {Promise<{ synced: number, created: number, updated: number, errors: string[] }>}
 */
async function syncFromExternal() {
  const token = getToken();
  if (!token) {
    throw new Error(
      'External employee API not configured. Set EMPLOYEE_API_TOKEN or APPWARMER_EMPLOYEE_API_TOKEN in the environment. ' +
      'Use a .env file in the backend directory (admin-web/backend/.env), then restart the server.'
    );
  }

  const res = await fetch(EXTERNAL_API_URL, {
    method: 'GET',
    headers: {
      token,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`External API returned ${res.status}: ${res.statusText}`);
  }

  const body = await res.json().catch(() => ({}));
  const rawList = normalizeResponse(body);
  const stats = { synced: 0, created: 0, updated: 0, archived: 0, errors: [] };
  const syncedEmails = new Set();

  // Debug: log API response shape (no sensitive values) so we can fix normalizer if needed
  const shape =
    body == null
      ? 'null'
      : Array.isArray(body)
        ? `array(${body.length})`
        : typeof body === 'object'
          ? `object keys [${Object.keys(body).join(', ')}]`
          : typeof body;
  debugLog('ExternalEmployeeSync: API response', shape, 'normalized list length=', rawList.length);
  if (rawList.length === 0 && body && typeof body === 'object' && !Array.isArray(body)) {
    const arrKeys = Object.keys(body).filter((k) => Array.isArray(body[k]));
    if (arrKeys.length) {
      debugLog('ExternalEmployeeSync: found array keys but not used:', arrKeys.map((k) => `${k}(${body[k].length})`).join(', '));
    }
  }
  if (rawList.length > 0) {
    debugLog('ExternalEmployeeSync: first record keys (for cost-center mapping):', Object.keys(rawList[0]).join(', '));
  }

  // Dedupe: one person per external id (or per email if no id). Merge cost centers from all rows for that person.
  const personKey = (ext) => (ext.id || ext.Id || '').toString().trim() || (ext.userName || ext.email || ext.Email || '').toString().trim().toLowerCase();
  const byPerson = new Map();
  for (const ext of rawList) {
    const k = personKey(ext);
    if (!k) continue;
    if (!byPerson.has(k)) byPerson.set(k, []);
    byPerson.get(k).push(ext);
  }
  const mergedList = [];
  for (const group of byPerson.values()) {
    const first = group[0];
    const combined = [...new Set(group.flatMap((e) => parseCostCenters(e)))];
    mergedList.push(combined.length ? { ...first, costCenters: combined } : first);
  }
  debugLog('ExternalEmployeeSync: deduped', rawList.length, 'rows ->', mergedList.length, 'people');

  for (const ext of mergedList) {
    let mapped = null;
    try {
      mapped = mapExternalToOur(ext);
      if (!mapped) {
        stats.errors.push(`Skipped record (missing name/email): ${JSON.stringify(ext).slice(0, 80)}`);
        continue;
      }
      const existing = await getEmployeeByEmail(mapped.email);
      const result = await upsertOne(mapped, existing);
      stats.synced++;
      if (result.created) stats.created++;
      if (result.updated) stats.updated++;
      syncedEmails.add(mapped.email.toLowerCase().trim());
    } catch (err) {
      stats.errors.push(`${mapped ? mapped.email : 'unknown'}: ${err.message}`);
      debugError('ExternalEmployeeSync: error for record', err);
    }
  }

  // Archive any local employee whose email is not in the HR response (HR is source of truth)
  const db = dbService.getDb();
  try {
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT id, email FROM employees WHERE (archived IS NULL OR archived = 0)', [], (err, r) => (err ? reject(err) : resolve(r || [])));
    });
    const toArchive = rows.filter((r) => !syncedEmails.has((r.email || '').toLowerCase().trim()));
    const now = new Date().toISOString();
    for (const row of toArchive) {
      await new Promise((resolve, reject) => {
        db.run('UPDATE employees SET archived = 1, updatedAt = ? WHERE id = ?', [now, row.id], (err) => (err ? reject(err) : resolve()));
      });
    }
    stats.archived = toArchive.length;
    if (toArchive.length > 0) {
      debugLog('ExternalEmployeeSync: archived', toArchive.length, 'local employees not in HR');
    }
  } catch (err) {
    stats.errors.push(`Archive-not-in-HR: ${err.message}`);
    debugError('ExternalEmployeeSync: error archiving employees not in HR', err);
  }

  debugLog('ExternalEmployeeSync: finished', stats);
  return stats;
}

module.exports = {
  getToken,
  syncFromExternal,
  normalizeResponse,
  mapExternalToOur,
};
