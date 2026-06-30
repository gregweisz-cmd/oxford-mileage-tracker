const SENIOR_STAFF_SUFFIX = /\s*-\s*Senior Staff\b/i;
const SUPERVISOR_SUFFIX = /\s*-\s*Supervisor\b/i;

function parsePermissions(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function stripDesignationSuffixes(position) {
  return String(position || '')
    .replace(SENIOR_STAFF_SUFFIX, '')
    .replace(SUPERVISOR_SUFFIX, '')
    .trim();
}

/**
 * HR is source-of-truth for job title. Supervisor/Senior Staff designations live in permissions.
 * @param {string} incomingPosition
 * @param {string} existingPosition
 * @returns {string}
 */
function resolveHrSyncPosition(incomingPosition, existingPosition) {
  const incoming = String(incomingPosition || '').trim();
  if (incoming) return incoming;
  return stripDesignationSuffixes(existingPosition) || String(existingPosition || '').trim();
}

/**
 * Move legacy position suffix designations into permissions so HR title updates do not drop access.
 * @param {string|Array|undefined} permissionsValue
 * @param {string} position
 * @returns {string[]}
 */
function mergeLegacyDesignationsIntoPermissions(permissionsValue, position) {
  const perms = new Set(parsePermissions(permissionsValue));
  const pos = String(position || '');
  const posLower = pos.toLowerCase();

  if (SENIOR_STAFF_SUFFIX.test(pos) || posLower.includes('senior staff')) {
    perms.add('senior_staff');
  } else if (SUPERVISOR_SUFFIX.test(pos) || (posLower.includes('supervisor') && !posLower.includes('senior staff'))) {
    perms.add('supervisor');
  }

  return Array.from(perms);
}

/** True when the employee holds the senior-staff designation (permission or legacy position). */
function hasSeniorStaffDesignation(employee) {
  if (!employee) return false;
  const perms = parsePermissions(employee.permissions);
  if (perms.includes('senior_staff')) return true;
  const pos = String(employee.position || '');
  return SENIOR_STAFF_SUFFIX.test(pos) || pos.toLowerCase().includes('senior staff');
}

/** True when the employee holds the supervisor designation (permission, role, or legacy position). */
function hasSupervisorDesignation(employee) {
  if (!employee) return false;
  if (hasSeniorStaffDesignation(employee)) return false;
  const perms = parsePermissions(employee.permissions);
  if (perms.includes('supervisor')) return true;
  if (employee.role === 'supervisor') return true;
  const pos = String(employee.position || '');
  const posLower = pos.toLowerCase();
  return SUPERVISOR_SUFFIX.test(pos) || (posLower.includes('supervisor') && !posLower.includes('senior staff'));
}

/** Add a designation permission (and ensure 'staff' baseline). Returns a new array. */
function addDesignationPermission(permissionsValue, designation) {
  const perms = new Set(parsePermissions(permissionsValue));
  perms.add(designation);
  if (!perms.has('staff')) perms.add('staff');
  return Array.from(perms);
}

/** Remove a designation permission. Returns a new array. */
function removeDesignationPermission(permissionsValue, designation) {
  const perms = new Set(parsePermissions(permissionsValue));
  perms.delete(designation);
  return Array.from(perms);
}

module.exports = {
  parsePermissions,
  stripDesignationSuffixes,
  resolveHrSyncPosition,
  mergeLegacyDesignationsIntoPermissions,
  hasSeniorStaffDesignation,
  hasSupervisorDesignation,
  addDesignationPermission,
  removeDesignationPermission,
};
