const { hasSeniorStaffDesignation } = require('./staffDesignations');

function isEmployeeArchived(employee) {
  return !employee || employee.archived === 1;
}

/**
 * Whether `seniorStaffRecord` may receive expense reports as the senior-staff approver for `staffEmployee`.
 * Returns false when archived, missing designation, self-assignment, or same person as supervisor.
 */
function canServeAsSeniorStaffApprover(seniorStaffRecord, staffEmployee) {
  if (!seniorStaffRecord || isEmployeeArchived(seniorStaffRecord)) return false;
  if (!hasSeniorStaffDesignation(seniorStaffRecord)) return false;
  if (staffEmployee && String(seniorStaffRecord.id) === String(staffEmployee.id)) return false;
  if (
    staffEmployee?.supervisorId &&
    String(seniorStaffRecord.id) === String(staffEmployee.supervisorId)
  ) {
    return false;
  }
  return true;
}

module.exports = {
  isEmployeeArchived,
  canServeAsSeniorStaffApprover,
};
