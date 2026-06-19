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

module.exports = {
  stripDesignationSuffixes,
  resolveHrSyncPosition,
  mergeLegacyDesignationsIntoPermissions,
};
