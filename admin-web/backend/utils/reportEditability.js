/**
 * Staff may edit expense reports after submission while reviewers are still working.
 * Only approved reports are locked.
 */

function monthYearFromDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) };
}

function getExpenseReportForMonth(db, employeeId, month, year) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id, status FROM expense_reports WHERE employeeId = ? AND month = ? AND year = ?',
      [employeeId, month, year],
      (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      }
    );
  });
}

async function assertStaffCanEditReportMonth(db, employeeId, month, year) {
  if (!employeeId || !month || !year) return;

  const report = await getExpenseReportForMonth(db, employeeId, month, year);
  if (report && String(report.status).toLowerCase() === 'approved') {
    const error = new Error('This expense report has been approved and can no longer be edited.');
    error.statusCode = 403;
    throw error;
  }
}

async function assertStaffCanEditReportDate(db, employeeId, dateStr) {
  const parts = monthYearFromDate(dateStr);
  if (!parts) return;
  await assertStaffCanEditReportMonth(db, employeeId, parts.month, parts.year);
}

module.exports = {
  monthYearFromDate,
  assertStaffCanEditReportMonth,
  assertStaffCanEditReportDate,
};
