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
 * Includes externalId so we can use a stable employee ID and avoid duplicates.
 * @param {object} ext
 * @returns {{ name: string, email: string, position: string, costCenters: string[], phoneNumber?: string, baseAddress?: string, externalId?: string }|null}
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
  // Employee ID from API (id, Id, userName, employeeId, employee_id) – assign for everyone when present
  const externalId = (
    ext.id || ext.Id || ext.userName || ext.employeeId || ext.employee_id || ''
  ).toString().trim() || undefined;
  const oxfordHouseId = externalId || '';

  return {
    name,
    email,
    position,
    costCenters,
    phoneNumber,
    baseAddress,
    externalId,
    oxfordHouseId,
  };
}

/**
 * Find the canonical employee by email (case-insensitive).
 * If multiple rows exist, returns the oldest by createdAt so we consistently update the same record.
 * @param {string} email
 * @returns {Promise<object|null>}
 */
function getEmployeeByEmail(email) {
  return new Promise((resolve, reject) => {
    const db = dbService.getDb();
    db.get(
      'SELECT * FROM employees WHERE LOWER(TRIM(email)) = ? AND (archived IS NULL OR archived = 0) ORDER BY createdAt ASC, id ASC LIMIT 1',
      [email.trim().toLowerCase()],
      (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      }
    );
  });
}

/**
 * Find all active employees with this email (for dedupe/archive step).
 * @param {string} email
 * @returns {Promise<Array<{ id: string, createdAt: string }>>}
 */
function getActiveEmployeeIdsByEmail(email) {
  return new Promise((resolve, reject) => {
    const db = dbService.getDb();
    db.all(
      'SELECT id, createdAt FROM employees WHERE LOWER(TRIM(email)) = ? AND (archived IS NULL OR archived = 0) ORDER BY createdAt ASC, id ASC',
      [email.trim().toLowerCase()],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
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
    // Always assign Employee ID from API when the API provides one; otherwise keep existing
    const oxfordHouseId =
      mapped.oxfordHouseId !== undefined && String(mapped.oxfordHouseId || '').trim() !== ''
        ? String(mapped.oxfordHouseId).trim()
        : (existing.oxfordHouseId || '');
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE employees SET
          name = ?, preferredName = ?, position = ?, phoneNumber = ?, baseAddress = ?,
          costCenters = ?, selectedCostCenters = ?, defaultCostCenter = ?, oxfordHouseId = ?, updatedAt = ?
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
          oxfordHouseId,
          now,
          id,
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });
    return { created: false, updated: true, id };
  }

  // Re-check: another row with this email may exist (e.g. duplicate in same batch)
  const existingAgain = await getEmployeeByEmail(mapped.email);
  if (existingAgain) {
    await upsertOne(mapped, existingAgain);
    return { created: false, updated: true, id: existingAgain.id };
  }

  // Use stable ID from HR when available so we never create a second row for the same person
  const rawExternalId = mapped.externalId && String(mapped.externalId).trim();
  const id = rawExternalId
    ? 'hr-' + rawExternalId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)
    : helpers.generateEmployeeId(mapped.name);
  const plainPassword = helpers.generateDefaultPassword(mapped.name);
  let hashedPassword;
  try {
    hashedPassword = await helpers.hashPassword(plainPassword);
  } catch (e) {
    throw new Error(`Failed to hash password: ${e.message}`);
  }

  // Assign Employee ID from API when present (everyone from HR gets it)
  const oxfordHouseId =
    mapped.oxfordHouseId !== undefined && String(mapped.oxfordHouseId || '').trim() !== ''
      ? String(mapped.oxfordHouseId).trim()
      : '';
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
        oxfordHouseId,
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
 * Fetch from external API and return deduped list of mapped employee records (no DB write).
 * @returns {Promise<Array<{ name, email, position, costCenters, phoneNumber, baseAddress }>>}
 */
async function fetchAndMapExternal() {
  const token = getToken();
  if (!token) {
    throw new Error(
      'External employee API not configured. Set EMPLOYEE_API_TOKEN or APPWARMER_EMPLOYEE_API_TOKEN in the environment. ' +
      'Use a .env file in the backend directory (admin-web/backend/.env), then restart the server.'
    );
  }
  const res = await fetch(EXTERNAL_API_URL, {
    method: 'GET',
    headers: { token, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`External API returned ${res.status}: ${res.statusText}`);
  const body = await res.json().catch(() => ({}));
  const rawList = normalizeResponse(body);
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
  const mappedList = [];
  for (const ext of mergedList) {
    const mapped = mapExternalToOur(ext);
    if (mapped) mappedList.push(mapped);
  }
  // One person per email: HR may return same email under different external ids; keep first only
  const byEmail = new Map();
  for (const m of mappedList) {
    const key = m.email.toLowerCase().trim();
    if (!byEmail.has(key)) byEmail.set(key, m);
  }
  return Array.from(byEmail.values());
}

/**
 * Preview what sync would do: returns creates, updates, and archives without writing.
 * @returns {Promise<{ creates: Array<{email,name,position,costCenters}>, updates: Array<{email,name,position,costCenters,previous}>, archives: Array<{id,name,email}> }>}
 */
async function previewSyncFromExternal() {
  const mappedList = await fetchAndMapExternal();
  const syncedEmails = new Set(mappedList.map((m) => m.email.toLowerCase().trim()));
  const creates = [];
  const updates = [];
  for (const mapped of mappedList) {
    const existing = await getEmployeeByEmail(mapped.email);
    const prevCC = existing && existing.costCenters
      ? (typeof existing.costCenters === 'string' ? JSON.parse(existing.costCenters || '[]') : existing.costCenters)
      : [];
    const prevSelected = existing && existing.selectedCostCenters
      ? (typeof existing.selectedCostCenters === 'string' ? JSON.parse(existing.selectedCostCenters || '[]') : existing.selectedCostCenters)
      : [];
    if (!existing) {
      creates.push({ email: mapped.email, name: mapped.name, position: mapped.position, costCenters: mapped.costCenters });
    } else {
      const same =
        (existing.name || '') === (mapped.name || '') &&
        (existing.position || '') === (mapped.position || '') &&
        JSON.stringify(prevCC.sort()) === JSON.stringify((mapped.costCenters || []).sort()) &&
        (existing.phoneNumber || '') === (mapped.phoneNumber || '') &&
        (existing.baseAddress || '') === (mapped.baseAddress || '');
      if (!same) {
        updates.push({
          email: mapped.email,
          name: mapped.name,
          position: mapped.position,
          costCenters: mapped.costCenters,
          previous: {
            name: existing.name,
            position: existing.position,
            costCenters: prevCC,
            selectedCostCenters: prevSelected,
          },
        });
      }
    }
  }
  const db = dbService.getDb();
  const rows = await new Promise((resolve, reject) => {
    db.all('SELECT id, name, email FROM employees WHERE (archived IS NULL OR archived = 0)', [], (err, r) => (err ? reject(err) : resolve(r || [])));
  });
  const archives = rows
    .filter((r) => !syncedEmails.has((r.email || '').toLowerCase().trim()))
    .map((r) => ({ id: r.id, name: r.name, email: r.email }));
  return { creates, updates, archives };
}

/** Tables that reference employees.id via employeeId (reassign to keepId before deleting duplicate) */
const EMPLOYEE_ID_TABLES = [
  'mileage_entries',
  'receipts',
  'time_tracking',
  'daily_descriptions',
  'daily_odometer_readings',
  'monthly_reports',
  'weekly_reports',
  'biweekly_reports',
  'expense_reports',
  'staff_notifications',
];

/**
 * Reassign all rows referencing duplicateId to keepId, then delete the duplicate employee.
 * @param {string} keepId - employee id to keep
 * @param {string} duplicateId - employee id to remove
 * @returns {Promise<void>}
 */
async function reassignAndDeleteDuplicate(keepId, duplicateId) {
  const db = dbService.getDb();
  for (const table of EMPLOYEE_ID_TABLES) {
    await new Promise((resolve, reject) => {
      db.run(`UPDATE ${table} SET employeeId = ? WHERE employeeId = ?`, [keepId, duplicateId], (err) => (err ? reject(err) : resolve()));
    });
  }
  await new Promise((resolve, reject) => {
    db.run('UPDATE employees SET supervisorId = ? WHERE supervisorId = ?', [keepId, duplicateId], (err) => (err ? reject(err) : resolve()));
  });
  await new Promise((resolve, reject) => {
    db.run('DELETE FROM employees WHERE id = ?', [duplicateId], (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * For each email that has multiple active employees, keep the oldest (by createdAt) and remove the rest:
 * reassign their data to the kept employee, then delete the duplicate rows.
 * @param {Set<string>} syncedEmails - lowercase emails we consider "canonical" from this sync
 * @returns {Promise<number>} count of removed (deleted) duplicate rows
 */
async function removeDuplicateEmails(syncedEmails) {
  let removed = 0;
  const db = dbService.getDb();
  for (const email of syncedEmails) {
    const rows = await getActiveEmployeeIdsByEmail(email);
    if (rows.length <= 1) continue;
    const [keep, ...toRemove] = rows;
    for (const row of toRemove) {
      try {
        await reassignAndDeleteDuplicate(keep.id, row.id);
        removed++;
        debugLog('ExternalEmployeeSync: removed duplicate email', email, 'kept', keep.id, 'deleted', row.id);
      } catch (err) {
        debugError('ExternalEmployeeSync: failed to remove duplicate', row.id, err);
      }
    }
  }
  return removed;
}

/**
 * Apply only approved sync changes.
 * @param {{ toCreate: string[], toUpdate: string[], toArchive: string[] }} body - emails for create/update, ids for archive
 * @returns {Promise<{ synced: number, created: number, updated: number, archived: number, errors: string[] }>}
 */
async function applySyncFromExternal(body) {
  const toCreate = Array.isArray(body.toCreate) ? body.toCreate.map((e) => String(e).trim().toLowerCase()) : [];
  const toUpdate = Array.isArray(body.toUpdate) ? body.toUpdate.map((e) => String(e).trim().toLowerCase()) : [];
  const toArchive = Array.isArray(body.toArchive) ? body.toArchive.map((id) => String(id).trim()) : [];
  const mappedList = await fetchAndMapExternal();
  const stats = { synced: 0, created: 0, updated: 0, archived: 0, errors: [] };
  const createSet = new Set(toCreate);
  const updateSet = new Set(toUpdate);
  for (const mapped of mappedList) {
    const emailKey = mapped.email.toLowerCase().trim();
    const existing = await getEmployeeByEmail(mapped.email);
    if (!existing && createSet.has(emailKey)) {
      try {
        await upsertOne(mapped, null);
        stats.created++;
        stats.synced++;
      } catch (err) {
        stats.errors.push(`${mapped.email}: ${err.message}`);
      }
    } else if (existing && updateSet.has(emailKey)) {
      try {
        await upsertOne(mapped, existing);
        stats.updated++;
        stats.synced++;
      } catch (err) {
        stats.errors.push(`${mapped.email}: ${err.message}`);
      }
    }
  }
  const archiveSet = new Set(toArchive);
  const db = dbService.getDb();
  for (const id of archiveSet) {
    try {
      await new Promise((resolve, reject) => {
        db.run('UPDATE employees SET archived = 1, updatedAt = ? WHERE id = ?', [new Date().toISOString(), id], (err) => (err ? reject(err) : resolve()));
      });
      stats.archived++;
    } catch (err) {
      stats.errors.push(`Archive ${id}: ${err.message}`);
    }
  }

  // Build set of emails we touched (from mappedList) and archive any duplicate local rows
  const appliedEmails = new Set();
  for (const m of mappedList) {
    if (createSet.has(m.email.toLowerCase().trim()) || updateSet.has(m.email.toLowerCase().trim())) {
      appliedEmails.add(m.email.toLowerCase().trim());
    }
  }
  try {
    const dupRemoved = await removeDuplicateEmails(appliedEmails);
    stats.archived += dupRemoved;
  } catch (err) {
    stats.errors.push(`Remove-duplicates: ${err.message}`);
  }

  return stats;
}

/**
 * Fetch from external API and sync into local DB (apply all changes; used when no preview flow).
 * @returns {Promise<{ synced: number, created: number, updated: number, archived: number, errors: string[] }>}
 */
async function syncFromExternal() {
  const mappedList = await fetchAndMapExternal();
  const stats = { synced: 0, created: 0, updated: 0, archived: 0, errors: [] };
  const syncedEmails = new Set();

  for (const mapped of mappedList) {
    try {
      const existing = await getEmployeeByEmail(mapped.email);
      const result = await upsertOne(mapped, existing);
      stats.synced++;
      if (result.created) stats.created++;
      if (result.updated) stats.updated++;
      syncedEmails.add(mapped.email.toLowerCase().trim());
    } catch (err) {
      stats.errors.push(`${mapped.email}: ${err.message}`);
      debugError('ExternalEmployeeSync: error for record', err);
    }
  }

  // Remove duplicate local rows (same email): keep oldest, reassign their data, then delete
  try {
    const dupRemoved = await removeDuplicateEmails(syncedEmails);
    stats.archived += dupRemoved;
    if (dupRemoved > 0) debugLog('ExternalEmployeeSync: removed', dupRemoved, 'duplicate-by-email rows');
  } catch (err) {
    stats.errors.push(`Remove-duplicates: ${err.message}`);
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
    stats.archived += toArchive.length;
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
  previewSyncFromExternal,
  applySyncFromExternal,
  normalizeResponse,
  mapExternalToOur,
};
