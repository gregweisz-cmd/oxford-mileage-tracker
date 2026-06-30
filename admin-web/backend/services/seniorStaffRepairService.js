/**
 * Clears invalid seniorStaffId / supervisorId references and re-routes in-flight reports
 * when a senior-staff approver or supervisor is archived, loses designation, or is otherwise unavailable.
 */
const dbService = require('./dbService');
const notificationService = require('./notificationService');
const websocketService = require('./websocketService');
const { initializeApprovalWorkflow, statusForStage } = require('./approvalWorkflow');
const { canServeAsSeniorStaffApprover } = require('../utils/seniorStaffAssignment');
const { debugWarn } = require('../debug');

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

/**
 * Re-route any of an employee's in-flight reports waiting at the senior-staff stage.
 * @returns {Promise<number>} count of reports updated
 */
async function rerouteInFlightSeniorStaffReports(db, employeeId) {
  const reports = await allAsync(
    db,
    `SELECT * FROM expense_reports WHERE employeeId = ? AND status = 'pending_senior_staff'`,
    [employeeId]
  );
  if (reports.length === 0) return 0;

  const employee = await dbService.getEmployeeById(employeeId);
  const employeeName = employee ? (employee.preferredName || employee.name || 'Employee') : 'Employee';
  const nowIso = new Date().toISOString();
  let count = 0;

  for (const report of reports) {
    const init = await initializeApprovalWorkflow(report);
    const status = statusForStage(init.currentApprovalStage);
    await runAsync(
      db,
      `UPDATE expense_reports
         SET status = ?, approvalWorkflow = ?, currentApprovalStage = ?, currentApproverId = ?, currentApproverName = ?, escalationDueAt = ?, updatedAt = ?
       WHERE id = ?`,
      [
        status,
        JSON.stringify(init.workflow),
        init.currentApprovalStage,
        init.currentApproverId,
        init.currentApproverName,
        init.escalationDueAt,
        nowIso,
        report.id,
      ]
    );

    if (init.currentApproverId) {
      notificationService
        .notifyReportSubmitted(report.id, employeeId, employeeName, init.currentApproverId)
        .catch((err) => debugWarn('⚠️ Failed to notify re-routed approver:', err?.message || err));
    }
    websocketService.handleDataChangeNotification({
      type: 'expense_report',
      action: 'update',
      data: { id: report.id },
      timestamp: new Date(),
      employeeId,
    });
    count++;
  }

  return count;
}

/**
 * Re-route any of an employee's in-flight reports waiting at the supervisor stage.
 * @returns {Promise<number>} count of reports updated
 */
async function rerouteInFlightSupervisorReports(db, employeeId) {
  const reports = await allAsync(
    db,
    `SELECT * FROM expense_reports
     WHERE employeeId = ?
       AND (status = 'pending_supervisor' OR currentApprovalStage = 'supervisor' OR currentApprovalStage = 'pending_supervisor')`,
    [employeeId]
  );
  if (reports.length === 0) return 0;

  const employee = await dbService.getEmployeeById(employeeId);
  const employeeName = employee ? (employee.preferredName || employee.name || 'Employee') : 'Employee';
  const nowIso = new Date().toISOString();
  let count = 0;

  for (const report of reports) {
    const init = await initializeApprovalWorkflow(report);
    const status = statusForStage(init.currentApprovalStage);
    await runAsync(
      db,
      `UPDATE expense_reports
         SET status = ?, approvalWorkflow = ?, currentApprovalStage = ?, currentApproverId = ?, currentApproverName = ?, escalationDueAt = ?, updatedAt = ?
       WHERE id = ?`,
      [
        status,
        JSON.stringify(init.workflow),
        init.currentApprovalStage,
        init.currentApproverId,
        init.currentApproverName,
        init.escalationDueAt,
        nowIso,
        report.id,
      ]
    );

    if (init.currentApproverId) {
      notificationService
        .notifyReportSubmitted(report.id, employeeId, employeeName, init.currentApproverId)
        .catch((err) => debugWarn('⚠️ Failed to notify re-routed approver:', err?.message || err));
    }
    websocketService.handleDataChangeNotification({
      type: 'expense_report',
      action: 'update',
      data: { id: report.id },
      timestamp: new Date(),
      employeeId,
    });
    count++;
  }

  return count;
}

/**
 * Staff who pointed at `supervisorId` are cleared so admins can reassign them;
 * any in-flight supervisor-stage reports are re-routed.
 */
async function repairAfterSupervisorUnavailable(supervisorId) {
  if (!supervisorId) return { clearedStaff: 0, reroutedReports: 0 };
  const db = dbService.getDb();
  const nowIso = new Date().toISOString();
  const staff = await allAsync(
    db,
    `SELECT id FROM employees WHERE supervisorId = ? AND (archived IS NULL OR archived = 0)`,
    [supervisorId]
  );

  let clearedStaff = 0;
  let reroutedReports = 0;
  for (const row of staff) {
    await runAsync(db, 'UPDATE employees SET supervisorId = NULL, updatedAt = ? WHERE id = ?', [
      nowIso,
      row.id,
    ]);
    clearedStaff++;
    reroutedReports += await rerouteInFlightSupervisorReports(db, row.id);
  }

  return { clearedStaff, reroutedReports };
}

/**
 * Clear supervisorId for any active staff still assigned to an archived supervisor.
 */
async function repairAllStaffAssignedToArchivedSupervisors() {
  const db = dbService.getDb();
  const nowIso = new Date().toISOString();
  const staff = await allAsync(
    db,
    `SELECT e.id, e.name, e.supervisorId
     FROM employees e
     INNER JOIN employees sup ON sup.id = e.supervisorId AND sup.archived = 1
     WHERE (e.archived IS NULL OR e.archived = 0)`
  );

  let clearedStaff = 0;
  let reroutedReports = 0;
  for (const row of staff) {
    await runAsync(db, 'UPDATE employees SET supervisorId = NULL, updatedAt = ? WHERE id = ?', [
      nowIso,
      row.id,
    ]);
    clearedStaff++;
    reroutedReports += await rerouteInFlightSupervisorReports(db, row.id);
  }

  return { clearedStaff, reroutedReports, staff: staff.map((r) => ({ id: r.id, name: r.name, formerSupervisorId: r.supervisorId })) };
}

/**
 * Staff who pointed at `seniorStaffId` are cleared to report directly to their supervisor;
 * any in-flight senior-staff-stage reports are re-routed.
 */
async function repairAfterSeniorStaffUnavailable(seniorStaffId) {
  if (!seniorStaffId) return { clearedStaff: 0, reroutedReports: 0 };
  const db = dbService.getDb();
  const nowIso = new Date().toISOString();
  const staff = await allAsync(
    db,
    `SELECT id FROM employees WHERE seniorStaffId = ? AND (archived IS NULL OR archived = 0)`,
    [seniorStaffId]
  );

  let clearedStaff = 0;
  let reroutedReports = 0;
  for (const row of staff) {
    await runAsync(db, 'UPDATE employees SET seniorStaffId = NULL, updatedAt = ? WHERE id = ?', [
      nowIso,
      row.id,
    ]);
    clearedStaff++;
    reroutedReports += await rerouteInFlightSeniorStaffReports(db, row.id);
  }

  return { clearedStaff, reroutedReports };
}

/**
 * Clear a single employee's seniorStaffId when it points at an invalid approver; re-route in-flight reports.
 */
async function repairInvalidSeniorStaffAssignmentForEmployee(employeeId) {
  const employee = await dbService.getEmployeeById(employeeId);
  if (!employee?.seniorStaffId) return { repaired: false, reroutedReports: 0 };
  const senior = await dbService.getEmployeeById(employee.seniorStaffId);
  if (canServeAsSeniorStaffApprover(senior, employee)) {
    return { repaired: false, reroutedReports: 0 };
  }
  const db = dbService.getDb();
  const nowIso = new Date().toISOString();
  await runAsync(db, 'UPDATE employees SET seniorStaffId = NULL, updatedAt = ? WHERE id = ?', [
    nowIso,
    employeeId,
  ]);
  const reroutedReports = await rerouteInFlightSeniorStaffReports(db, employeeId);
  return { repaired: true, reroutedReports };
}

module.exports = {
  rerouteInFlightSeniorStaffReports,
  rerouteInFlightSupervisorReports,
  repairAfterSeniorStaffUnavailable,
  repairAfterSupervisorUnavailable,
  repairAllStaffAssignedToArchivedSupervisors,
  repairInvalidSeniorStaffAssignmentForEmployee,
};
