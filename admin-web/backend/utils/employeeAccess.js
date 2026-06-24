const dbService = require('../services/dbService');
const { getEffectiveRole } = require('../middleware/auth');

/**
 * Whether viewer may read/write data belonging to employeeId
 * (self, supervisor, senior staff, admin, finance).
 */
async function canAccessEmployeeData(viewer, employeeId) {
  if (!viewer || !employeeId) return false;
  if (viewer.id === employeeId) return true;
  const role = getEffectiveRole(viewer);
  if (role === 'admin' || role === 'finance') return true;
  const subject = await dbService.getEmployeeById(employeeId);
  if (!subject) return false;
  if (subject.supervisorId && String(subject.supervisorId) === String(viewer.id)) return true;
  if (subject.seniorStaffId && String(subject.seniorStaffId) === String(viewer.id)) return true;
  return false;
}

function getRequestedEmployeeId(req) {
  return (
    req.query?.employeeId ||
    req.body?.employeeId ||
    req.params?.employeeId ||
    null
  );
}

/** Reject when query/body/param employeeId is not accessible to the caller. */
async function guardRequestedEmployeeAccess(req, res, next) {
  try {
    const employeeId = getRequestedEmployeeId(req);
    if (!employeeId) return next();
    const allowed = await canAccessEmployeeData(req.authenticatedEmployee, employeeId);
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return next();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to verify access' });
  }
}

function promisifyDbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/** For :id routes — load employeeId from a table row before mutating. */
function guardResourceEmployeeAccess(tableName, idParam = 'id') {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[idParam];
      if (!resourceId) {
        return res.status(400).json({ error: 'Resource id is required' });
      }
      const db = dbService.getDb();
      const row = await promisifyDbGet(
        db,
        `SELECT employeeId FROM ${tableName} WHERE id = ?`,
        [resourceId]
      );
      if (!row?.employeeId) {
        return res.status(404).json({ error: 'Not found' });
      }
      const allowed = await canAccessEmployeeData(req.authenticatedEmployee, row.employeeId);
      if (!allowed) {
        return res.status(403).json({ error: 'Access denied' });
      }
      return next();
    } catch (error) {
      return res.status(500).json({ error: 'Failed to verify access' });
    }
  };
}

module.exports = {
  canAccessEmployeeData,
  getRequestedEmployeeId,
  guardRequestedEmployeeAccess,
  guardResourceEmployeeAccess,
};
