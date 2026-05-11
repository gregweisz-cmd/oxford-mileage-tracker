const dbService = require('./dbService');
const { debugWarn } = require('../debug');

function serializeDetails(details) {
  if (!details) return null;
  try {
    return JSON.stringify(details);
  } catch {
    return JSON.stringify({ note: 'Failed to serialize audit details' });
  }
}

async function logAuditEvent({
  action,
  actor,
  targetType,
  targetId,
  details,
}) {
  if (!action || !targetType) return;

  const db = dbService.getDb();
  if (!db) return;

  const actorEmployee = actor || {};
  const now = new Date().toISOString();

  return new Promise((resolve) => {
    db.run(
      `INSERT INTO audit_logs
        (action, actorId, actorName, actorRole, targetType, targetId, details, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        action,
        actorEmployee.id || actorEmployee.employeeId || null,
        actorEmployee.preferredName || actorEmployee.name || actorEmployee.email || null,
        actorEmployee.role || null,
        targetType,
        targetId || null,
        serializeDetails(details),
        now,
      ],
      (err) => {
        if (err) {
          debugWarn('⚠️ Failed to write audit log:', err.message || err);
        }
        resolve();
      }
    );
  });
}

module.exports = {
  logAuditEvent,
};
