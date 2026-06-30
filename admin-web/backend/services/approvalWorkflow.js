/**
 * Approval workflow builder.
 *
 * Extracted from routes/expenseReports.js so it can be reused by other routes
 * (e.g. supervisor team management re-routing in-flight reports when a staff
 * member's senior-staff assignment changes).
 *
 * Routing order: Senior Staff (if assigned) -> Supervisor (if assigned) -> Finance.
 */
const dbService = require('./dbService');
const helpers = require('../utils/helpers');
const constants = require('../utils/constants');
const { canServeAsSeniorStaffApprover } = require('../utils/seniorStaffAssignment');

/**
 * Initialize approval workflow for a report.
 * @param {object} report - report row (must include employeeId; reportData optional)
 * @param {object|null} reportDataOverride - parsed reportData to use instead of report.reportData
 * @returns {Promise<{workflow:Array,currentApprovalStage:string,currentApprovalStep:number,currentApproverId:?string,currentApproverName:?string,escalationDueAt:?string}>}
 */
async function initializeApprovalWorkflow(report, reportDataOverride = null) {
  const workflow = [];
  let currentApprovalStage = '';
  let currentApprovalStep = 0;
  let currentApproverId = null;
  let currentApproverName = null;
  let escalationDueAt = null;

  const employee = await dbService.getEmployeeById(report.employeeId);
  let seniorStaff = null;
  if (employee && employee.seniorStaffId) {
    const candidate = await dbService.getEmployeeById(employee.seniorStaffId);
    if (canServeAsSeniorStaffApprover(candidate, employee)) {
      seniorStaff = candidate;
    }
  }
  let supervisor = null;
  if (employee && employee.supervisorId) {
    const candidate = await dbService.getEmployeeById(employee.supervisorId);
    if (candidate && candidate.archived !== 1) {
      supervisor = candidate;
    }
  }

  // Step 1: Senior Staff (if applicable) — before supervisor
  if (seniorStaff) {
    const seniorStaffName = seniorStaff.preferredName || seniorStaff.name || 'Senior Staff';
    const seniorStaffStep = {
      step: workflow.length,
      role: 'senior_staff',
      approverId: seniorStaff.id,
      approverName: seniorStaffName,
      status: 'pending',
      delegatedToId: null,
      delegatedToName: null,
      dueAt: helpers.computeEscalationDueAt(constants.SUPERVISOR_ESCALATION_HOURS),
      actedAt: null,
      comments: '',
      reminders: []
    };
    workflow.push(seniorStaffStep);
    currentApprovalStage = 'senior_staff';
    currentApproverId = seniorStaff.id;
    currentApproverName = seniorStaffName;
    escalationDueAt = seniorStaffStep.dueAt;
  }

  // Step 2: Supervisor (if applicable)
  if (supervisor) {
    const supervisorName = supervisor.preferredName || supervisor.name || 'Supervisor';
    const supervisorStep = {
      step: workflow.length,
      role: 'supervisor',
      approverId: supervisor.id,
      approverName: supervisorName,
      status: workflow.length === 0 ? 'pending' : 'waiting',
      delegatedToId: null,
      delegatedToName: null,
      dueAt: helpers.computeEscalationDueAt(constants.SUPERVISOR_ESCALATION_HOURS),
      actedAt: null,
      comments: '',
      reminders: []
    };
    workflow.push(supervisorStep);
    if (workflow.length === 1) {
      currentApprovalStage = 'supervisor';
      currentApproverId = supervisor.id;
      currentApproverName = supervisorName;
      escalationDueAt = supervisorStep.dueAt;
    }
  }

  let reportData = reportDataOverride;
  if (!reportData && report && report.reportData) {
    if (typeof report.reportData === 'string') {
      reportData = helpers.parseJsonSafe(report.reportData, {});
    } else if (typeof report.reportData === 'object') {
      reportData = report.reportData;
    }
  }
  const reportCostCenters = Array.isArray(reportData?.costCenters) ? reportData.costCenters : [];

  const financeApprovers = await dbService.getFinanceApproversForCostCenters(reportCostCenters);
  let financeApproverId = null;
  let financeApproverName = 'Finance Team';

  if (financeApprovers.length === 1) {
    financeApproverId = financeApprovers[0].id;
    financeApproverName = financeApprovers[0].preferredName || financeApprovers[0].name || financeApproverName;
  }

  const financeStep = {
    step: workflow.length,
    role: 'finance',
    approverId: financeApproverId,
    approverName: financeApproverName,
    status: workflow.length === 0 ? 'pending' : 'waiting',
    delegatedToId: null,
    delegatedToName: null,
    dueAt: workflow.length === 0 ? helpers.computeEscalationDueAt(constants.FINANCE_ESCALATION_HOURS) : null,
    actedAt: null,
    comments: '',
    reminders: []
  };

  workflow.push(financeStep);

  if (workflow.length === 1) {
    currentApprovalStage = 'finance';
    currentApproverId = financeApproverId;
    currentApproverName = financeApproverName;
    escalationDueAt = financeStep.dueAt;
  }

  return {
    workflow,
    currentApprovalStage,
    currentApprovalStep,
    currentApproverId,
    currentApproverName,
    escalationDueAt
  };
}

/** Map a workflow stage to the report status column value. */
function statusForStage(stage) {
  if (stage === 'finance') return 'pending_finance';
  if (stage === 'senior_staff') return 'pending_senior_staff';
  return 'pending_supervisor';
}

module.exports = {
  initializeApprovalWorkflow,
  statusForStage,
};
