/**
 * Dashboard and Statistics Routes
 * Extracted from server.js for better organization
 * Includes: Dashboard preferences, statistics, admin reporting
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const dbService = require('../services/dbService');
const helpers = require('../utils/helpers');
const dateHelpers = require('../utils/dateHelpers');
const { debugLog, debugWarn, debugError } = require('../debug');

// ===== DASHBOARD STATISTICS API ENDPOINTS =====

// Get dashboard preferences for a user
router.get('/api/dashboard-preferences/:userId', (req, res) => {
  const db = dbService.getDb();
  const { userId } = req.params;
  
  db.get(
    'SELECT preferences FROM dashboard_preferences WHERE userId = ?',
    [userId],
    (err, row) => {
      if (err) {
        debugError('❌ Error fetching dashboard preferences:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Always return a valid response, even if no preferences exist
      if (row && row.preferences) {
        try {
          const preferences = JSON.parse(row.preferences);
          res.json(preferences);
        } catch (parseErr) {
          res.json({ enabledStatistics: [] });
        }
      } else {
        // Return empty preferences instead of 404
        res.json({ enabledStatistics: [] });
      }
    }
  );
});

// Save dashboard preferences for a user
router.put('/api/dashboard-preferences/:userId', (req, res) => {
  const db = dbService.getDb();
  const { userId } = req.params;
  const { enabledStatistics, categoryPresets, widgetLayouts, defaultPortal } = req.body;
  const now = new Date().toISOString();

  // First, get existing preferences to preserve them
  db.get(
    'SELECT preferences FROM dashboard_preferences WHERE userId = ?',
    [userId],
    (err, row) => {
      if (err) {
        debugError('❌ Error fetching existing preferences:', err);
        res.status(500).json({ error: err.message });
        return;
      }

      // Start with existing preferences or empty object
      let existingPreferences = {};
      if (row && row.preferences) {
        try {
          existingPreferences = JSON.parse(row.preferences);
        } catch (parseErr) {
          debugWarn('⚠️ Could not parse existing preferences, starting fresh');
          existingPreferences = {};
        }
      }

      // Sanitize and merge new values with existing preferences
      const sanitizedEnabledStats = Array.isArray(enabledStatistics)
        ? enabledStatistics.filter(statId => typeof statId === 'string')
        : (existingPreferences.enabledStatistics || []);

      const sanitizedCategoryPresets = Array.isArray(categoryPresets)
        ? categoryPresets
            .map((preset) => {
              if (!preset || typeof preset !== 'object') return null;
              const id = typeof preset.id === 'string' && preset.id.trim() ? preset.id.trim() : `preset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
              const name = typeof preset.name === 'string' && preset.name.trim() ? preset.name.trim() : 'Preset';
              const states = Array.isArray(preset.states) ? preset.states.filter(state => typeof state === 'string') : [];
              const costCenters = Array.isArray(preset.costCenters) ? preset.costCenters.filter(cc => typeof cc === 'string') : [];
              const chartType = preset.chartType === 'bar' ? 'bar' : 'donut';
              return { id, name, states, costCenters, chartType };
            })
            .filter(Boolean)
        : (existingPreferences.categoryPresets || []);

      const sanitizedWidgetLayouts = widgetLayouts && typeof widgetLayouts === 'object'
        ? widgetLayouts
        : (existingPreferences.widgetLayouts || {});

      // Validate defaultPortal if provided
      const validPortals = ['admin', 'supervisor', 'staff', 'finance'];
      const sanitizedDefaultPortal = defaultPortal && validPortals.includes(defaultPortal) 
        ? defaultPortal 
        : (existingPreferences.defaultPortal || null);

      const preferencesObject = {
        enabledStatistics: sanitizedEnabledStats,
        categoryPresets: sanitizedCategoryPresets,
        widgetLayouts: sanitizedWidgetLayouts,
        ...(sanitizedDefaultPortal && { defaultPortal: sanitizedDefaultPortal }),
      };

      debugLog('💾 Saving preferences:', { userId, preferencesObject });

      const preferences = JSON.stringify(preferencesObject);

      db.run(
        `INSERT OR REPLACE INTO dashboard_preferences (userId, preferences, createdAt, updatedAt)
         VALUES (?, ?, COALESCE((SELECT createdAt FROM dashboard_preferences WHERE userId = ?), ?), ?)`,
        [userId, preferences, userId, now, now],
        function(err) {
          if (err) {
            debugError('❌ Error saving dashboard preferences:', err);
            res.status(500).json({ error: err.message });
            return;
          }
          debugLog('✅ Dashboard preferences saved successfully');
          res.json({ message: 'Dashboard preferences saved successfully' });
        }
      );
    }
  );
});

// Helper function to calculate total expenses from reportData
function calculateTotalExpensesFromReportData(reportData) {
  if (!reportData) return 0;
  const {
    totalMileageAmount = 0,
    airRailBus = 0,
    vehicleRentalFuel = 0,
    parkingTolls = 0,
    groundTransportation = 0,
    hotelsAirbnb = 0,
    perDiem = 0,
    phoneInternetFax = 0,
    shippingPostage = 0,
    printingCopying = 0,
    officeSupplies = 0,
    eesReceipt = 0,
    meals = 0,
    other = 0,
  } = reportData;

  return totalMileageAmount + airRailBus + vehicleRentalFuel + parkingTolls +
         groundTransportation + hotelsAirbnb + perDiem + phoneInternetFax +
         shippingPostage + printingCopying + officeSupplies + eesReceipt + meals + other;
}

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function dbAllAsync(query, params = []) {
  const db = dbService.getDb();
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGetAsync(query, params = []) {
  const db = dbService.getDb();
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRunAsync(query, params = []) {
  const db = dbService.getDb();
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function parseDateInput(value) {
  if (!value || typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeListParam(param) {
  if (!param) return [];
  const arrayValue = Array.isArray(param) ? param : [param];
  return Array.from(
    new Set(
      arrayValue
        .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  );
}

function toSqlDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDateByMonths(date, months) {
  const shifted = new Date(date.getFullYear(), date.getMonth(), 1);
  shifted.setMonth(shifted.getMonth() + months);
  return shifted;
}

const REPORT_BUILDER_MAX_ROWS = 750;

const REPORT_BUILDER_STATUS_OPTIONS = [
  'draft',
  'submitted',
  'pending_supervisor',
  'pending_finance',
  'under_review',
  'needs_revision',
  'approved',
  'rejected',
];

const REPORT_BUILDER_FIELDS = [
  {
    id: 'reportId',
    label: 'Report ID',
    description: 'Unique identifier of the expense report',
    type: 'string',
    category: 'Report',
  },
  {
    id: 'employeeId',
    label: 'Employee ID',
    description: 'Identifier of the employee who submitted the report',
    type: 'string',
    category: 'Employee',
  },
  {
    id: 'employeeName',
    label: 'Employee Name',
    description: 'Full name of the employee',
    type: 'string',
    category: 'Employee',
  },
  {
    id: 'employeePreferredName',
    label: 'Preferred Name',
    description: 'Preferred name or nickname of the employee',
    type: 'string',
    category: 'Employee',
  },
  {
    id: 'employeeEmail',
    label: 'Employee Email',
    description: 'Email address of the employee',
    type: 'string',
    category: 'Employee',
  },
  {
    id: 'employeePosition',
    label: 'Position',
    description: 'Employee role or position',
    type: 'string',
    category: 'Employee',
  },
  {
    id: 'oxfordHouseId',
    label: 'Oxford House ID',
    description: 'Oxford House identifier associated with the employee',
    type: 'string',
    category: 'Employee',
  },
  {
    id: 'supervisorName',
    label: 'Supervisor Name',
    description: 'Supervisor responsible for the employee',
    type: 'string',
    category: 'Employee',
  },
  {
    id: 'defaultCostCenter',
    label: 'Default Cost Center',
    description: 'Primary cost center associated with the employee',
    type: 'string',
    category: 'Financial',
  },
  {
    id: 'costCenters',
    label: 'Report Cost Centers',
    description: 'Cost centers tagged on this report',
    type: 'string',
    category: 'Financial',
  },
  {
    id: 'periodLabel',
    label: 'Period (Label)',
    description: 'Human-readable reporting period (e.g. Nov 2025)',
    type: 'string',
    category: 'Report',
  },
  {
    id: 'reportMonth',
    label: 'Period Month',
    description: 'Month number for the report period',
    type: 'number',
    category: 'Report',
  },
  {
    id: 'reportYear',
    label: 'Period Year',
    description: 'Year for the report period',
    type: 'number',
    category: 'Report',
  },
  {
    id: 'status',
    label: 'Status',
    description: 'Current status of the report in the approval workflow',
    type: 'string',
    category: 'Report',
  },
  {
    id: 'submittedAt',
    label: 'Submitted At',
    description: 'Timestamp when the report was submitted',
    type: 'date',
    category: 'Workflow',
  },
  {
    id: 'approvedAt',
    label: 'Approved At',
    description: 'Timestamp when the report was approved',
    type: 'date',
    category: 'Workflow',
  },
  {
    id: 'updatedAt',
    label: 'Last Updated',
    description: 'Timestamp of the last update to the report',
    type: 'date',
    category: 'Report',
  },
  {
    id: 'escalationDueAt',
    label: 'Escalation Due',
    description: 'When the next escalation should occur if pending',
    type: 'date',
    category: 'Workflow',
  },
  {
    id: 'approvalStage',
    label: 'Approval Stage',
    description: 'Stage currently reviewing the report',
    type: 'string',
    category: 'Workflow',
  },
  {
    id: 'currentApprover',
    label: 'Current Approver',
    description: 'Name of the approver currently assigned',
    type: 'string',
    category: 'Workflow',
  },
  {
    id: 'totalExpenses',
    label: 'Total Expenses',
    description: 'Total reimbursable amount for the report',
    type: 'currency',
    category: 'Financial',
  },
  {
    id: 'totalMileageAmount',
    label: 'Mileage Amount',
    description: 'Total dollar amount claimed for mileage',
    type: 'currency',
    category: 'Financial',
  },
  {
    id: 'perDiem',
    label: 'Per Diem',
    description: 'Per diem reimbursements associated with the report',
    type: 'currency',
    category: 'Financial',
  },
  {
    id: 'receiptSpend',
    label: 'Receipt Spend',
    description: 'Spend captured from receipt-backed expenses',
    type: 'currency',
    category: 'Financial',
  },
  {
    id: 'totalMiles',
    label: 'Miles Logged',
    description: 'Total miles submitted on the report',
    type: 'number',
    category: 'Activity',
  },
  {
    id: 'totalHours',
    label: 'Hours Logged',
    description: 'Total hours submitted on the report',
    type: 'number',
    category: 'Activity',
  },
  {
    id: 'mileageEntryCount',
    label: 'Mileage Entries',
    description: 'Number of mileage entries included in the report',
    type: 'number',
    category: 'Activity',
  },
  {
    id: 'receiptCount',
    label: 'Receipt Count',
    description: 'Number of receipts attached to the report',
    type: 'number',
    category: 'Financial',
  },
  {
    id: 'agingDays',
    label: 'Aging (days)',
    description: 'Days elapsed since submission or last update',
    type: 'number',
    category: 'Workflow',
  },
  {
    id: 'cycleTimeDays',
    label: 'Cycle Time (days)',
    description: 'Days between submission and approval',
    type: 'number',
    category: 'Workflow',
  },
  {
    id: 'openDays',
    label: 'Open Days',
    description: 'Days the report has remained open without approval',
    type: 'number',
    category: 'Workflow',
  },
];

const REPORT_BUILDER_FIELD_MAP = REPORT_BUILDER_FIELDS.reduce((map, field) => {
  map.set(field.id, field);
  return map;
}, new Map());

const REPORT_BUILDER_DEFAULT_COLUMNS = [
  'reportId',
  'employeeName',
  'defaultCostCenter',
  'periodLabel',
  'status',
  'totalExpenses',
  'receiptSpend',
  'totalMileageAmount',
  'perDiem',
  'submittedAt',
  'approvedAt',
  'agingDays',
];

const REPORT_SCHEDULE_ALLOWED_FREQUENCIES = ['daily', 'weekly', 'monthly'];
const REPORT_SCHEDULE_MAX_RECIPIENTS = 20;
const REPORT_SCHEDULE_DEFAULT_TIME = '08:00';
const REPORT_SCHEDULE_DEFAULT_TIMEZONE = 'America/New_York';
const REPORT_SCHEDULE_DEFAULT_ROW_LIMIT = 250;
const REPORT_SCHEDULE_CHECK_INTERVAL_MS = 60 * 1000;
const REPORT_SCHEDULE_ATTACHMENT_ROW_LIMIT = 500;

// System settings storage (in-memory for now, can be moved to database)
let systemSettings = {
  email: {
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: process.env.SMTP_PASSWORD || '',
    fromEmail: process.env.FROM_EMAIL || '',
    fromName: process.env.FROM_NAME || 'Oxford House Expense System'
  },
  reportSchedule: {
    defaultTime: REPORT_SCHEDULE_DEFAULT_TIME,
    defaultTimezone: REPORT_SCHEDULE_DEFAULT_TIMEZONE,
    defaultRowLimit: REPORT_SCHEDULE_DEFAULT_ROW_LIMIT,
    maxRecipients: REPORT_SCHEDULE_MAX_RECIPIENTS,
    checkIntervalMs: REPORT_SCHEDULE_CHECK_INTERVAL_MS
  },
  approval: {
    defaultFrequency: 'monthly',
    escalationHours: 48,
    autoApproveThreshold: 0
  }
};

const REPORT_OUTBOX_DIR = path.join(__dirname, 'scheduled-report-outbox');
try {
  if (!fs.existsSync(REPORT_OUTBOX_DIR)) {
    fs.mkdirSync(REPORT_OUTBOX_DIR, { recursive: true });
  }
} catch (err) {
  debugWarn('⚠️ Unable to create report outbox directory:', err);
}

let reportScheduleRunner = null;
let reportScheduleCheckInProgress = false;
let emailTransport = null;
let emailTransportInitPromise = null;

function sanitizeReportBuilderColumns(columns) {
  if (!Array.isArray(columns)) {
    return [...REPORT_BUILDER_DEFAULT_COLUMNS];
  }
  const seen = new Set();
  const valid = [];
  columns.forEach((columnId) => {
    if (typeof columnId !== 'string') return;
    if (!REPORT_BUILDER_FIELD_MAP.has(columnId)) return;
    if (seen.has(columnId)) return;
    seen.add(columnId);
    valid.push(columnId);
  });
  return valid.length > 0 ? valid : [...REPORT_BUILDER_DEFAULT_COLUMNS];
}

function sanitizeReportBuilderFilters(filters) {
  if (!filters || typeof filters !== 'object') {
    return {};
  }
  const sanitized = {};
  if (filters.startDate && typeof filters.startDate === 'string') {
    sanitized.startDate = filters.startDate;
  }
  if (filters.endDate && typeof filters.endDate === 'string') {
    sanitized.endDate = filters.endDate;
  }
  const statuses = normalizeListParam(filters.statuses);
  if (statuses.length > 0) {
    sanitized.statuses = statuses;
  }
  const costCenters = normalizeListParam(filters.costCenters);
  if (costCenters.length > 0) {
    sanitized.costCenters = costCenters;
  }
  const employeeIds = normalizeListParam(filters.employeeIds);
  if (employeeIds.length > 0) {
    sanitized.employeeIds = employeeIds;
  }
  if (typeof filters.search === 'string' && filters.search.trim().length > 0) {
    sanitized.search = filters.search.trim();
  }
  const minTotal = Number(filters.minTotalExpenses);
  if (Number.isFinite(minTotal)) {
    sanitized.minTotalExpenses = minTotal;
  }
  const maxTotal = Number(filters.maxTotalExpenses);
  if (Number.isFinite(maxTotal)) {
    sanitized.maxTotalExpenses = maxTotal;
  }
  return sanitized;
}

function formatReportPeriodLabel(month, year) {
  const safeYear = Number.isFinite(Number(year)) ? Number(year) : new Date().getFullYear();
  const monthIndex = Number.isFinite(Number(month)) ? Math.max(0, Math.min(11, Number(month) - 1)) : 0;
  const periodDate = new Date(safeYear, monthIndex, 1);
  return periodDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function coerceNumber(value, fractionDigits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (typeof fractionDigits !== 'number' || fractionDigits < 0) {
    return num;
  }
  const factor = Math.pow(10, fractionDigits);
  return Math.round(num * factor) / factor;
}

function buildReportBuilderRow(row, referenceDate) {
  const parsedReportData = typeof row.reportData === 'string'
    ? helpers.parseJsonSafe(row.reportData, {})
    : (row.reportData || {});
  const workflow = Array.isArray(row.approvalWorkflow)
    ? row.approvalWorkflow
    : helpers.parseJsonSafe(row.approvalWorkflow, []);

  const costCenterList = Array.isArray(parsedReportData.costCenters)
    ? parsedReportData.costCenters.filter((value) => typeof value === 'string' && value.trim().length > 0)
    : [];
  if (costCenterList.length === 0 && row.defaultCostCenter) {
    costCenterList.push(row.defaultCostCenter);
  }
  if (costCenterList.length === 0) {
    costCenterList.push('Unassigned');
  }

  const totalMiles = coerceNumber(parsedReportData.totalMiles, 2);
  const totalHours = coerceNumber(parsedReportData.totalHours, 2);
  const totalMileageAmount = coerceNumber(parsedReportData.totalMileageAmount, 2);
  const perDiem = coerceNumber(parsedReportData.perDiem, 2);
  const receiptCount = Array.isArray(parsedReportData.receipts) ? parsedReportData.receipts.length : 0;
  const mileageEntryCount = Array.isArray(parsedReportData.mileageEntries)
    ? parsedReportData.mileageEntries.length
    : 0;
  const totalExpenses = coerceNumber(calculateTotalExpensesFromReportData(parsedReportData), 2);
  const receiptSpend = coerceNumber(totalExpenses - totalMileageAmount - perDiem, 2);

  const submittedAt = row.submittedAt ? new Date(row.submittedAt) : null;
  const approvedAt = row.approvedAt ? new Date(row.approvedAt) : null;
  const updatedAt = row.updatedAt ? new Date(row.updatedAt) : null;
  const agingReference = submittedAt || updatedAt;

  let agingDays = null;
  if (agingReference && !Number.isNaN(agingReference.getTime())) {
    const diff = Math.floor((referenceDate - agingReference) / MS_IN_DAY);
    agingDays = diff >= 0 ? diff : 0;
  }

  let cycleTimeDays = null;
  if (
    submittedAt &&
    !Number.isNaN(submittedAt.getTime()) &&
    approvedAt &&
    !Number.isNaN(approvedAt.getTime())
  ) {
    const diff = Math.floor((approvedAt - submittedAt) / MS_IN_DAY);
    cycleTimeDays = diff >= 0 ? diff : 0;
  }

  let openDays = null;
  if (submittedAt && !Number.isNaN(submittedAt.getTime()) && (!approvedAt || Number.isNaN(approvedAt.getTime()))) {
    const diff = Math.floor((referenceDate - submittedAt) / MS_IN_DAY);
    openDays = diff >= 0 ? diff : 0;
  }

  let inferredStage = '';
  if (!row.currentApprovalStage && Array.isArray(workflow)) {
    const activeStep = workflow.find((step) => step && typeof step === 'object' && step.status === 'pending');
    inferredStage = activeStep?.role || '';
  }

  return {
    id: row.id,
    reportId: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName || 'Unknown',
    employeePreferredName: row.employeePreferredName || '',
    employeeEmail: row.employeeEmail || '',
    employeePosition: row.position || '',
    supervisorName: row.supervisorName || '',
    defaultCostCenter: row.defaultCostCenter || '',
    costCenters: costCenterList.join(', '),
    costCenterList,
    periodLabel: formatReportPeriodLabel(row.month, row.year),
    reportMonth: Number(row.month) || 0,
    reportYear: Number(row.year) || 0,
    status: row.status || 'draft',
    submittedAt: row.submittedAt || null,
    approvedAt: row.approvedAt || null,
    updatedAt: row.updatedAt || null,
    escalationDueAt: row.escalationDueAt || null,
    approvalStage: row.currentApprovalStage || inferredStage || '',
    currentApprover: row.currentApproverName || '',
    totalExpenses,
    totalMileageAmount,
    perDiem,
    receiptSpend,
    totalMiles,
    totalHours,
    mileageEntryCount,
    receiptCount,
    agingDays,
    cycleTimeDays,
    openDays,
    oxfordHouseId: row.oxfordHouseId || '',
  };
}

function generateMonthRange(startDate, endDate) {
  const months = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const endCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (cursor <= endCursor) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    months.push({
      year,
      month,
      key: `${year}-${String(month).padStart(2, '0')}`,
      label: cursor.toLocaleString('default', { month: 'short', year: 'numeric' }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function buildCostCenterClause(columnName, costCenterSqlValues) {
  if (!Array.isArray(costCenterSqlValues) || costCenterSqlValues.length === 0) {
    return { clause: '', params: [] };
  }
  const placeholders = costCenterSqlValues.map(() => '?').join(',');
  return {
    clause: ` AND ${columnName} IN (${placeholders})`,
    params: [...costCenterSqlValues],
  };
}

function bucketCoordinate(value, precision = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const factor = Math.pow(10, precision);
  return Math.round(num * factor) / factor;
}

function reportMatchesCostCenterFilter(reportData, selectedCostCenters) {
  if (!selectedCostCenters || selectedCostCenters.length === 0) {
    return true;
  }

  const reportCostCenters = Array.isArray(reportData?.costCenters)
    ? reportData.costCenters.filter(Boolean)
    : [];

  const normalizedCostCenters =
    reportCostCenters.length > 0
      ? reportCostCenters
      : ['Unassigned'];

  return normalizedCostCenters.some((cc) => {
    if (cc === 'Unassigned') {
      return selectedCostCenters.some((value) => value.toLowerCase() === 'unassigned' || value === '');
    }
    return selectedCostCenters.includes(cc);
  });
}

async function executeReportBuilderQuery(selectedColumnsInput, filtersInput, limitInput) {
  const sanitizedColumns = sanitizeReportBuilderColumns(selectedColumnsInput);
  const sanitizedFilters = sanitizeReportBuilderFilters(filtersInput);

  let limit = Number(limitInput);
  if (!Number.isFinite(limit) || limit <= 0) {
    limit = REPORT_SCHEDULE_DEFAULT_ROW_LIMIT;
  }
  limit = Math.min(Math.max(Math.floor(limit), 1), REPORT_BUILDER_MAX_ROWS);

  let startIso = null;
  let endIso = null;

  if (sanitizedFilters.startDate) {
    const parsedStart = parseDateInput(sanitizedFilters.startDate);
    if (parsedStart) startIso = toSqlDate(parsedStart);
  }
  if (sanitizedFilters.endDate) {
    const parsedEnd = parseDateInput(sanitizedFilters.endDate);
    if (parsedEnd) endIso = toSqlDate(parsedEnd);
  }

  if (!startIso && !endIso) {
    const defaultEnd = new Date();
    const defaultStart = shiftDateByMonths(defaultEnd, -6);
    endIso = toSqlDate(defaultEnd);
    startIso = toSqlDate(defaultStart);
    sanitizedFilters.startDate = startIso;
    sanitizedFilters.endDate = endIso;
  } else if (startIso && !endIso) {
    const derivedEnd = shiftDateByMonths(parseDateInput(startIso) || new Date(), 6);
    endIso = toSqlDate(derivedEnd);
    sanitizedFilters.endDate = endIso;
  } else if (!startIso && endIso) {
    const derivedStart = shiftDateByMonths(parseDateInput(endIso) || new Date(), -6);
    startIso = toSqlDate(derivedStart);
    sanitizedFilters.startDate = startIso;
  } else {
    sanitizedFilters.startDate = startIso;
    sanitizedFilters.endDate = endIso;
  }

  const startDateObj = parseDateInput(startIso);
  const endDateObj = parseDateInput(endIso);
  if (startDateObj && endDateObj && startDateObj > endDateObj) {
    const temp = startIso;
    startIso = endIso;
    endIso = temp;
    sanitizedFilters.startDate = startIso;
    sanitizedFilters.endDate = endIso;
  }

  const referenceDate =
    endDateObj && !Number.isNaN(endDateObj.getTime()) ? new Date(endDateObj) : new Date();

  const sqlParams = [];
  let query = `
    SELECT
      er.id,
      er.employeeId,
      er.month,
      er.year,
      er.status,
      er.submittedAt,
      er.approvedAt,
      er.updatedAt,
      er.currentApprovalStage,
      er.currentApproverName,
      er.approvalWorkflow,
      er.escalationDueAt,
      er.reportData,
      er.createdAt,
      e.name AS employeeName,
      e.preferredName AS employeePreferredName,
      e.email AS employeeEmail,
      e.position AS position,
      e.oxfordHouseId AS oxfordHouseId,
      e.defaultCostCenter AS defaultCostCenter,
      e.supervisorId AS supervisorId,
      sup.name AS supervisorName
    FROM expense_reports er
    LEFT JOIN employees e ON e.id = er.employeeId
    LEFT JOIN employees sup ON sup.id = e.supervisorId
    WHERE 1=1
  `;

  if (startIso) {
    query += ' AND date(COALESCE(er.submittedAt, er.createdAt)) >= date(?)';
    sqlParams.push(startIso);
  }
  if (endIso) {
    query += ' AND date(COALESCE(er.submittedAt, er.createdAt)) <= date(?)';
    sqlParams.push(endIso);
  }

  if (sanitizedFilters.statuses && sanitizedFilters.statuses.length > 0) {
    const placeholders = sanitizedFilters.statuses.map(() => '?').join(',');
    query += ` AND er.status IN (${placeholders})`;
    sqlParams.push(...sanitizedFilters.statuses);
  }

  if (sanitizedFilters.employeeIds && sanitizedFilters.employeeIds.length > 0) {
    const placeholders = sanitizedFilters.employeeIds.map(() => '?').join(',');
    query += ` AND er.employeeId IN (${placeholders})`;
    sqlParams.push(...sanitizedFilters.employeeIds);
  }

  if (sanitizedFilters.search) {
    const likeValue = `%${sanitizedFilters.search.toLowerCase()}%`;
    query += `
      AND (
        LOWER(e.name) LIKE ?
        OR LOWER(IFNULL(e.preferredName, '')) LIKE ?
        OR LOWER(IFNULL(e.email, '')) LIKE ?
        OR LOWER(IFNULL(e.oxfordHouseId, '')) LIKE ?
        OR LOWER(er.id) LIKE ?
      )
    `;
    sqlParams.push(likeValue, likeValue, likeValue, likeValue, likeValue);
  }

  query += `
    ORDER BY date(COALESCE(er.submittedAt, er.createdAt)) DESC, er.updatedAt DESC, er.id DESC
    LIMIT ?
  `;

  const fetchLimit = Math.min(
    Math.max(limit * 3, limit + 50),
    REPORT_BUILDER_MAX_ROWS * 2
  );
  sqlParams.push(fetchLimit);

  const rows = await dbAllAsync(query, sqlParams);

  const costCenterFilter = sanitizedFilters.costCenters || [];
  const minTotal = Number.isFinite(sanitizedFilters.minTotalExpenses)
    ? sanitizedFilters.minTotalExpenses
    : null;
  const maxTotal = Number.isFinite(sanitizedFilters.maxTotalExpenses)
    ? sanitizedFilters.maxTotalExpenses
    : null;

  const mappedRows = [];

  rows.forEach((row) => {
    const parsedReportData =
      typeof row.reportData === 'string' ? helpers.parseJsonSafe(row.reportData, {}) : row.reportData || {};

    if (costCenterFilter.length > 0 && !reportMatchesCostCenterFilter(parsedReportData, costCenterFilter)) {
      return;
    }

    row.reportData = parsedReportData;
    row.approvalWorkflow = helpers.parseJsonSafe(row.approvalWorkflow, []);

    const normalizedRow = buildReportBuilderRow(row, referenceDate);

    if (minTotal !== null && normalizedRow.totalExpenses < minTotal) {
      return;
    }

    if (maxTotal !== null && normalizedRow.totalExpenses > maxTotal) {
      return;
    }

    mappedRows.push(normalizedRow);
  });

  const total = mappedRows.length;
  const truncated = total > limit;
  const rowsLimited = mappedRows.slice(0, limit);

  return {
    rows: rowsLimited,
    total,
    truncated,
    selectedColumns: sanitizedColumns,
    appliedFilters: { ...sanitizedFilters },
    generatedAt: new Date().toISOString(),
    limit,
  };
}

function sanitizeEmailRecipients(value, fallback = []) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  const seen = new Set();
  const result = [];

  const pushEmail = (email) => {
    if (!email || typeof email !== 'string') return;
    const trimmed = email.trim();
    if (trimmed.length === 0) return;
    if (!emailRegex.test(trimmed)) return;
    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    result.push(trimmed);
  };

  const extractEmails = (source) => {
    if (!source) return;
    if (Array.isArray(source)) {
      source.forEach(pushEmail);
    } else if (typeof source === 'string') {
      source
        .split(/[\s,;]+/)
        .filter(Boolean)
        .forEach(pushEmail);
    }
  };

  extractEmails(value);
  if (result.length === 0) {
    extractEmails(fallback);
  }

  return result.slice(0, REPORT_SCHEDULE_MAX_RECIPIENTS);
}

function parseTimeOfDay(value) {
  const fallback = { hours: 8, minutes: 0, value: REPORT_SCHEDULE_DEFAULT_TIME };
  if (typeof value !== 'string') {
    return fallback;
  }
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return fallback;
  }
  let hours = Number(match[1]);
  let minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return fallback;
  }
  hours = Math.floor(hours);
  minutes = Math.floor(minutes);
  return {
    hours,
    minutes,
    value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  };
}

function computeNextRunAt(schedule, referenceDate = new Date()) {
  if (!schedule || schedule.active === false || schedule.active === 0) {
    return null;
  }

  const { hours, minutes } = parseTimeOfDay(schedule.timeOfDay || REPORT_SCHEDULE_DEFAULT_TIME);
  const freq = REPORT_SCHEDULE_ALLOWED_FREQUENCIES.includes(schedule.frequency)
    ? schedule.frequency
    : 'weekly';

  const now = new Date(referenceDate);
  const candidate = new Date(now.getTime());
  candidate.setSeconds(0, 0);
  candidate.setHours(hours, minutes, 0, 0);

  if (freq === 'daily') {
    if (candidate <= now) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate.toISOString();
  }

  if (freq === 'weekly') {
    let targetDow = Number.isFinite(Number(schedule.dayOfWeek))
      ? ((Number(schedule.dayOfWeek) % 7) + 7) % 7
      : 1;
    const currentDow = candidate.getDay();
    let diff = (targetDow - currentDow + 7) % 7;
    if (diff === 0 && candidate <= now) {
      diff = 7;
    }
    candidate.setDate(candidate.getDate() + diff);
    candidate.setHours(hours, minutes, 0, 0);
    return candidate.toISOString();
  }

  let dayOfMonth = Number(schedule.dayOfMonth);
  if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1) {
    dayOfMonth = 1;
  }
  dayOfMonth = Math.min(Math.floor(dayOfMonth), 28);
  const monthCandidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    dayOfMonth,
    hours,
    minutes,
    0,
    0
  );
  if (monthCandidate <= now) {
    monthCandidate.setMonth(monthCandidate.getMonth() + 1);
    monthCandidate.setDate(dayOfMonth);
    monthCandidate.setHours(hours, minutes, 0, 0);
  }
  return monthCandidate.toISOString();
}

function sanitizeReportSchedulePayload(payload = {}, existing = null) {
  const base = existing || {};
  const sanitized = {};

  sanitized.name =
    typeof payload.name === 'string' && payload.name.trim().length > 0
      ? payload.name.trim()
      : base.name;
  if (!sanitized.name) {
    throw new Error('Schedule name is required');
  }

  sanitized.description =
    typeof payload.description === 'string'
      ? payload.description.trim()
      : base.description || '';

  const recipients = sanitizeEmailRecipients(payload.recipients, base.recipients || []);
  if (recipients.length === 0) {
    throw new Error('At least one valid recipient email is required');
  }
  sanitized.recipients = recipients;

  const frequencyInput =
    typeof payload.frequency === 'string' ? payload.frequency.toLowerCase() : base.frequency;
  const frequency = REPORT_SCHEDULE_ALLOWED_FREQUENCIES.includes(frequencyInput)
    ? frequencyInput
    : base.frequency || 'weekly';
  sanitized.frequency = frequency;

  let dayOfWeek =
    payload.dayOfWeek !== undefined ? payload.dayOfWeek : base.dayOfWeek !== undefined ? base.dayOfWeek : 1;
  if (frequency === 'weekly') {
    dayOfWeek = Number(dayOfWeek);
    if (!Number.isFinite(dayOfWeek)) {
      dayOfWeek = 1;
    }
    dayOfWeek = ((Math.floor(dayOfWeek) % 7) + 7) % 7;
    sanitized.dayOfWeek = dayOfWeek;
  } else {
    sanitized.dayOfWeek = null;
  }

  let dayOfMonth =
    payload.dayOfMonth !== undefined
      ? payload.dayOfMonth
      : base.dayOfMonth !== undefined
      ? base.dayOfMonth
      : 1;
  if (frequency === 'monthly') {
    dayOfMonth = Number(dayOfMonth);
    if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1) {
      dayOfMonth = 1;
    }
    dayOfMonth = Math.min(Math.floor(dayOfMonth), 28);
    sanitized.dayOfMonth = dayOfMonth;
  } else {
    sanitized.dayOfMonth = null;
  }

  const timeParts = parseTimeOfDay(
    typeof payload.timeOfDay === 'string' && payload.timeOfDay.trim().length > 0
      ? payload.timeOfDay
      : base.timeOfDay
  );
  sanitized.timeOfDay = timeParts.value;

  sanitized.timezone =
    typeof payload.timezone === 'string' && payload.timezone.trim().length > 0
      ? payload.timezone.trim()
      : base.timezone || REPORT_SCHEDULE_DEFAULT_TIMEZONE;

  const includeCsv =
    payload.includeCsv !== undefined
      ? Boolean(payload.includeCsv)
      : base.includeCsv !== undefined
      ? Boolean(base.includeCsv)
      : true;
  const includePdf =
    payload.includePdf !== undefined
      ? Boolean(payload.includePdf)
      : base.includePdf !== undefined
      ? Boolean(base.includePdf)
      : false;
  sanitized.includeCsv = includeCsv;
  sanitized.includePdf = includePdf;

  if (!includeCsv && !includePdf) {
    throw new Error('Enable at least one attachment format (CSV or PDF)');
  }

  sanitized.columns = sanitizeReportBuilderColumns(payload.columns || base.columns || []);
  sanitized.filters = sanitizeReportBuilderFilters(payload.filters || base.filters || {});

  let rowLimit =
    payload.rowLimit !== undefined
      ? Number(payload.rowLimit)
      : base.rowLimit !== undefined
      ? Number(base.rowLimit)
      : REPORT_SCHEDULE_DEFAULT_ROW_LIMIT;
  if (!Number.isFinite(rowLimit) || rowLimit <= 0) {
    rowLimit = REPORT_SCHEDULE_DEFAULT_ROW_LIMIT;
  }
  rowLimit = Math.min(Math.max(Math.floor(rowLimit), 1), REPORT_BUILDER_MAX_ROWS);
  sanitized.rowLimit = rowLimit;

  sanitized.active =
    payload.active !== undefined
      ? Boolean(payload.active)
      : base.active !== undefined
      ? Boolean(base.active)
      : true;

  if (payload.nextRunAt && typeof payload.nextRunAt === 'string') {
    sanitized.nextRunAt = payload.nextRunAt;
  } else if (sanitized.active) {
    sanitized.nextRunAt = computeNextRunAt(
      {
        frequency,
        dayOfWeek: sanitized.dayOfWeek,
        dayOfMonth: sanitized.dayOfMonth,
        timeOfDay: sanitized.timeOfDay,
        active: sanitized.active,
      },
      new Date()
    );
  } else {
    sanitized.nextRunAt = null;
  }

  return sanitized;
}

function mapScheduleRow(row) {
  const recipients = helpers.parseJsonSafe(row.recipients, []);
  const columns = sanitizeReportBuilderColumns(helpers.parseJsonSafe(row.columns, []));
  const filters = sanitizeReportBuilderFilters(helpers.parseJsonSafe(row.filters, {}));
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    recipients,
    frequency: row.frequency || 'weekly',
    dayOfWeek: row.dayOfWeek !== undefined && row.dayOfWeek !== null ? Number(row.dayOfWeek) : null,
    dayOfMonth:
      row.dayOfMonth !== undefined && row.dayOfMonth !== null ? Number(row.dayOfMonth) : null,
    timeOfDay: row.timeOfDay || REPORT_SCHEDULE_DEFAULT_TIME,
    timezone: row.timezone || REPORT_SCHEDULE_DEFAULT_TIMEZONE,
    includeCsv: Boolean(row.includeCsv),
    includePdf: Boolean(row.includePdf),
    columns,
    filters,
    rowLimit: row.rowLimit ? Number(row.rowLimit) : REPORT_SCHEDULE_DEFAULT_ROW_LIMIT,
    active: row.active === 1,
    lastRunAt: row.lastRunAt || null,
    nextRunAt: row.nextRunAt || null,
    lastStatus: row.lastStatus || null,
    lastError: row.lastError || null,
    createdBy: row.createdBy || null,
    updatedBy: row.updatedBy || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function formatValueForExport(value, fieldMeta) {
  if (value === null || value === undefined) {
    return '';
  }
  if (!fieldMeta) {
    return String(value);
  }
  switch (fieldMeta.type) {
    case 'currency': {
      const num = Number(value);
      return Number.isFinite(num) ? num.toFixed(2) : String(value);
    }
    case 'number': {
      const num = Number(value);
      return Number.isFinite(num)
        ? Number.isInteger(num)
          ? num.toString()
          : num.toFixed(2)
        : String(value);
    }
    case 'date': {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
    }
    default:
      return String(value);
  }
}

function generateScheduleCsv(columns, rows) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return '';
  }
  const headers = columns.map(
    (columnId) => REPORT_BUILDER_FIELD_MAP.get(columnId)?.label || columnId
  );
  const lines = [];
  lines.push(headers.map((header) => `"${String(header).replace(/"/g, '""')}"`).join(','));
  rows.forEach((row) => {
    const values = columns.map((columnId) => {
      const fieldMeta = REPORT_BUILDER_FIELD_MAP.get(columnId);
      const formatted = formatValueForExport(row[columnId], fieldMeta);
      return `"${String(formatted ?? '').replace(/"/g, '""')}"`;
    });
    lines.push(values.join(','));
  });
  return lines.join('\n');
}

function generateSchedulePdf(columns, rows) {
  const orientation = columns.length > 6 ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation });
  doc.setFontSize(14);
  doc.text('Reports & Analytics - Scheduled Export', 14, 18);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);

  const headerLine = columns
    .map((columnId) => REPORT_BUILDER_FIELD_MAP.get(columnId)?.label || columnId)
    .join(' | ');

  let y = 36;
  const lineHeight = 6;
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont(undefined, 'bold');
  doc.text(headerLine, 14, y);
  doc.setFont(undefined, 'normal');
  y += lineHeight;

  rows.forEach((row) => {
    const rowLine = columns
      .map((columnId) => {
        const fieldMeta = REPORT_BUILDER_FIELD_MAP.get(columnId);
        const formatted = String(formatValueForExport(row[columnId], fieldMeta));
        return formatted.length > 64 ? `${formatted.slice(0, 61)}…` : formatted;
      })
      .join(' | ');
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
      doc.setFont(undefined, 'bold');
      doc.text(headerLine, 14, y);
      doc.setFont(undefined, 'normal');
      y += lineHeight;
    }
    doc.text(rowLine, 14, y);
    y += lineHeight;
  });

  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer);
}

async function getEmailTransport() {
  if (emailTransport) {
    return emailTransport;
  }
  if (emailTransportInitPromise) {
    return emailTransportInitPromise;
  }
  if (!process.env.SMTP_HOST) {
    emailTransportInitPromise = Promise.resolve(null);
    return null;
  }

  emailTransportInitPromise = (async () => {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASSWORD
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
              }
            : undefined,
      });
      try {
        await transporter.verify();
      } catch (verifyError) {
        debugWarn('⚠️ SMTP transport verification failed (continuing):', verifyError.message);
      }
      emailTransport = transporter;
      return transporter;
    } catch (error) {
      debugWarn('⚠️ Unable to initialize SMTP transport:', error);
      return null;
    }
  })();

  const transport = await emailTransportInitPromise;
  if (!transport) {
    emailTransportInitPromise = null;
  }
  return transport;
}

function writeOutboxEmail(mailOptions) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(
      REPORT_OUTBOX_DIR,
      `${timestamp}-${Math.random().toString(36).slice(2)}.json`
    );
    const payload = {
      ...mailOptions,
      createdAt: new Date().toISOString(),
      attachments: (mailOptions.attachments || []).map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        content: attachment.content ? attachment.content.toString('base64') : null,
      })),
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    debugLog('📬 Scheduled report written to outbox:', filePath);
  } catch (error) {
    debugError('❌ Failed to write scheduled report email to outbox:', error);
  }
}

async function sendScheduleEmail(schedule, queryResult, attachments) {
  const summaryLines = [
    `Schedule: ${schedule.name}`,
    `Total matching rows: ${queryResult.total}`,
    `Rows included in delivery: ${queryResult.rows.length}${
      queryResult.truncated ? ' (truncated to limit)' : ''
    }`,
    `Generated at: ${new Date(queryResult.generatedAt).toLocaleString()}`,
  ];

  const textBody = [
    'Hello,',
    '',
    `Your scheduled analytics report "${schedule.name}" is ready.`,
    '',
    ...summaryLines,
    '',
    'Applied Filters:',
    JSON.stringify(queryResult.appliedFilters, null, 2),
    '',
    'Thanks,',
    'Oxford Mileage Tracker',
  ].join('\n');

  const htmlBody = `
    <p>Hello,</p>
    <p>Your scheduled analytics report <strong>${schedule.name}</strong> is ready.</p>
    <ul>
      ${summaryLines.map((line) => `<li>${line}</li>`).join('')}
    </ul>
    <p><strong>Applied Filters</strong></p>
    <pre style="background:#f5f5f5;padding:12px;border-radius:8px;">${JSON.stringify(
      queryResult.appliedFilters,
      null,
      2
    )}</pre>
    <p>Thanks,<br/>Oxford Mileage Tracker</p>
  `;

  const mailOptions = {
    from: process.env.REPORTS_FROM_EMAIL || process.env.SMTP_FROM || 'reports@oxford-house.org',
    to: schedule.recipients.join(', '),
    subject: `Scheduled Report: ${schedule.name}`,
    text: textBody,
    html: htmlBody,
    attachments: attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  };

  const transport = await getEmailTransport();
  if (transport) {
    await transport.sendMail(mailOptions);
    debugLog('📧 Scheduled report email sent:', schedule.name);
  } else {
    writeOutboxEmail(mailOptions);
    debugWarn(
      '📬 SMTP not configured; scheduled report email stored in outbox directory instead.'
    );
  }
}

async function deliverReportSchedule(schedule) {
  const queryResult = await executeReportBuilderQuery(
    schedule.columns,
    schedule.filters,
    schedule.rowLimit
  );

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slug =
    schedule.name && typeof schedule.name === 'string'
      ? schedule.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'report'
      : 'report';

  const attachments = [];

  if (schedule.includeCsv) {
    const csvContent = generateScheduleCsv(queryResult.selectedColumns, queryResult.rows);
    attachments.push({
      filename: `${slug}-${timestamp}.csv`,
      content: Buffer.from(csvContent, 'utf8'),
      contentType: 'text/csv',
    });
  }

  if (schedule.includePdf) {
    const pdfBuffer = generateSchedulePdf(queryResult.selectedColumns, queryResult.rows);
    attachments.push({
      filename: `${slug}-${timestamp}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    });
  }

  await sendScheduleEmail(schedule, queryResult, attachments);

  return { queryResult, attachments };
}

async function runReportSchedule(schedule, options = {}) {
  const { manual = false } = options;
  const { queryResult } = await deliverReportSchedule(schedule);
  const nowIso = new Date().toISOString();
  const nextRunAt = schedule.active
    ? computeNextRunAt(schedule, new Date(Date.now() + 1000))
    : null;

  await dbRunAsync(
    `
      UPDATE report_delivery_schedules
      SET lastRunAt = ?, nextRunAt = ?, lastStatus = ?, lastError = NULL, updatedAt = ?
      WHERE id = ?
    `,
    [nowIso, nextRunAt, manual ? 'manual' : 'success', nowIso, schedule.id]
  );

  schedule.lastRunAt = nowIso;
  schedule.nextRunAt = nextRunAt;
  schedule.lastStatus = manual ? 'manual' : 'success';
  schedule.lastError = null;

  return queryResult;
}

async function handleScheduleFailure(schedule, error) {
  const message = error instanceof Error ? error.message : String(error);
  debugError(`❌ Error running report schedule "${schedule.name}":`, message);
  const retryReference = new Date(Date.now() + 60 * 60 * 1000);
  const nextRunAt = schedule.active ? computeNextRunAt(schedule, retryReference) : null;
  await dbRunAsync(
    `
      UPDATE report_delivery_schedules
      SET lastStatus = 'error', lastError = ?, nextRunAt = ?, updatedAt = ?
      WHERE id = ?
    `,
    [message.slice(0, 500), nextRunAt, new Date().toISOString(), schedule.id]
  );
  schedule.lastStatus = 'error';
  schedule.lastError = message.slice(0, 500);
  schedule.nextRunAt = nextRunAt;
}

async function checkReportSchedules() {
  if (reportScheduleCheckInProgress) {
    return;
  }
  reportScheduleCheckInProgress = true;
  try {
    const dueRows = await dbAllAsync(
      `
        SELECT *
        FROM report_delivery_schedules
        WHERE active = 1
          AND (nextRunAt IS NULL OR datetime(nextRunAt) <= datetime('now'))
        ORDER BY COALESCE(nextRunAt, createdAt) ASC
        LIMIT 5
      `
    );

    for (const row of dueRows) {
      const schedule = mapScheduleRow(row);
      try {
        await runReportSchedule(schedule);
      } catch (error) {
        await handleScheduleFailure(schedule, error);
      }
    }
  } catch (error) {
    debugError('❌ Error checking report schedules:', error);
  } finally {
    reportScheduleCheckInProgress = false;
  }
}

function startReportScheduleRunner() {
  if (reportScheduleRunner) {
    return;
  }
  reportScheduleRunner = setInterval(() => {
    checkReportSchedules().catch((error) =>
      debugError('❌ Schedule runner interval error:', error)
    );
  }, REPORT_SCHEDULE_CHECK_INTERVAL_MS);
  // Run immediately on startup
  checkReportSchedules().catch((error) => debugError('❌ Schedule runner startup error:', error));
  debugLog('✅ Report schedule runner started');
}

function stopReportScheduleRunner() {
  if (reportScheduleRunner) {
    clearInterval(reportScheduleRunner);
    reportScheduleRunner = null;
  }
}

async function getCostCenterTotalsForPeriod(startIso, endIso, costCenterSqlValues) {
  const { clause, params } = buildCostCenterClause('costCenter', costCenterSqlValues);
  const rows = await dbAllAsync(
    `
      SELECT COALESCE(NULLIF(costCenter, ''), 'Unassigned') AS costCenterName,
             IFNULL(SUM(amount), 0) AS totalAmount,
             COUNT(*) AS receiptCount
      FROM receipts
      WHERE date(date) BETWEEN date(?) AND date(?)
      ${clause}
      GROUP BY costCenterName
    `,
    [startIso, endIso, ...params]
  );

  const totals = new Map();
  rows.forEach((row) => {
    totals.set(row.costCenterName, {
      totalAmount: row.totalAmount || 0,
      receiptCount: row.receiptCount || 0,
    });
  });
  return totals;
}

// Get dashboard statistics
router.get('/api/dashboard-statistics', async (req, res) => {
  const db = dbService.getDb();
  try {
    const { statistics, startDate, endDate, filterState, filterCostCenter } = req.query;
    const userRole = req.headers['x-user-role'] || 'staff';
    const userId = req.headers['x-user-id'] || '';
    
    const statIds = statistics ? statistics.split(',') : [];
    const results = [];
    
    // Build date filter - note: this is a placeholder, actual date filtering is handled per-statistic
    // The dateFilter string is not used in the current implementation, but kept for future use
    
    // Get current date info
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    for (const statId of statIds) {
      let stat = null;
      
      switch (statId) {
        case 'total-expenses': {
          // Total expenses across all reports
          let query = `
            SELECT er.reportData
            FROM expense_reports er
            WHERE er.status IN ('submitted', 'approved')
          `;
          const params = [];
          
          if (startDate && endDate) {
            query += ' AND date(?) <= date(er.submittedAt) AND date(er.submittedAt) <= date(?)';
            params.push(startDate, endDate);
          }
          
          if (userRole === 'supervisor' && userId) {
            const supervisedEmployees = await new Promise((resolve, reject) => {
              const db = dbService.getDb();
              db.all('SELECT id FROM employees WHERE supervisorId = ?', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.id));
              });
            });
            
            if (supervisedEmployees.length > 0) {
              const placeholders = supervisedEmployees.map(() => '?').join(',');
              query += ` AND er.employeeId IN (${placeholders})`;
              params.push(...supervisedEmployees);
            } else {
              query += ' AND 1=0';
            }
          }
          
          const total = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
              if (err) reject(err);
              else {
                let sum = 0;
                rows.forEach(row => {
                  try {
                    const reportData = typeof row.reportData === 'string' 
                      ? JSON.parse(row.reportData) 
                      : row.reportData;
                    sum += calculateTotalExpensesFromReportData(reportData);
                  } catch (e) {
                    // Skip invalid reportData
                  }
                });
                resolve(sum);
              }
            });
          });
          
          stat = {
            id: statId,
            title: 'Total Expenses',
            value: total || 0,
            icon: 'money',
            color: '#1976d2',
          };
          break;
        }
        
        case 'pending-reports': {
          // Count pending reports
          let query = "SELECT COUNT(*) as count FROM expense_reports WHERE status = 'submitted'";
          const params = [];
          
          if (userRole === 'supervisor' && userId) {
            // Get supervised employees
            const supervisedEmployees = await new Promise((resolve, reject) => {
              db.all('SELECT id FROM employees WHERE supervisorId = ?', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.id));
              });
            });
            
            if (supervisedEmployees.length > 0) {
              const placeholders = supervisedEmployees.map(() => '?').join(',');
              query += ` AND employeeId IN (${placeholders})`;
              params.push(...supervisedEmployees);
            } else {
              query += ' AND 1=0'; // No employees supervised
            }
          }
          
          stat = await new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
              if (err) reject(err);
              else resolve({
                id: statId,
                title: 'Pending Reports',
                value: row.count || 0,
                icon: 'hourglass',
                color: '#ff9800',
              });
            });
          });
          break;
        }
        
        case 'approved-reports': {
          // Count approved reports
          let query = "SELECT COUNT(*) as count FROM expense_reports WHERE status = 'approved'";
          const params = [];
          
          if (startDate && endDate) {
            query += ' AND date(?) <= date(submittedAt) AND date(submittedAt) <= date(?)';
            params.push(startDate, endDate);
          }
          
          if (userRole === 'supervisor' && userId) {
            const supervisedEmployees = await new Promise((resolve, reject) => {
              db.all('SELECT id FROM employees WHERE supervisorId = ?', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.id));
              });
            });
            
            if (supervisedEmployees.length > 0) {
              const placeholders = supervisedEmployees.map(() => '?').join(',');
              query += ` AND employeeId IN (${placeholders})`;
              params.push(...supervisedEmployees);
            } else {
              query += ' AND 1=0';
            }
          }
          
          stat = await new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
              if (err) reject(err);
              else resolve({
                id: statId,
                title: 'Approved Reports',
                value: row.count || 0,
                icon: 'check',
                color: '#4caf50',
              });
            });
          });
          break;
        }
        
        case 'total-receipts': {
          // Count total receipts
          let query = 'SELECT COUNT(*) as count FROM receipts';
          const params = [];
          let hasWhere = false;
          
          if (startDate && endDate) {
            query += ' WHERE date(?) <= date(r.date) AND date(r.date) <= date(?)';
            params.push(startDate, endDate);
            hasWhere = true;
          }
          
          if (userRole === 'supervisor' && userId) {
            const supervisedEmployees = await new Promise((resolve, reject) => {
              db.all('SELECT id FROM employees WHERE supervisorId = ?', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.id));
              });
            });
            
            if (supervisedEmployees.length > 0) {
              const placeholders = supervisedEmployees.map(() => '?').join(',');
              const whereClause = hasWhere ? ' AND' : ' WHERE';
              query += `${whereClause} employeeId IN (${placeholders})`;
              params.push(...supervisedEmployees);
            } else {
              query += hasWhere ? ' AND 1=0' : ' WHERE 1=0';
            }
          }
          
          stat = await new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
              if (err) reject(err);
              else resolve({
                id: statId,
                title: 'Total Receipts',
                value: row.count || 0,
                icon: 'receipt',
                color: '#9c27b0',
              });
            });
          });
          break;
        }
        
        case 'total-miles': {
          // Total miles across all reports
          let query = `
            SELECT er.reportData
            FROM expense_reports er
            WHERE er.status IN ('submitted', 'approved')
          `;
          const params = [];
          
          if (startDate && endDate) {
            query += ' AND date(?) <= date(er.submittedAt) AND date(er.submittedAt) <= date(?)';
            params.push(startDate, endDate);
          }
          
          if (userRole === 'supervisor' && userId) {
            const supervisedEmployees = await new Promise((resolve, reject) => {
              db.all('SELECT id FROM employees WHERE supervisorId = ?', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.id));
              });
            });
            
            if (supervisedEmployees.length > 0) {
              const placeholders = supervisedEmployees.map(() => '?').join(',');
              query += ` AND er.employeeId IN (${placeholders})`;
              params.push(...supervisedEmployees);
            } else {
              query += ' AND 1=0';
            }
          }
          
          const total = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
              if (err) reject(err);
              else {
                let sum = 0;
                rows.forEach(row => {
                  try {
                    const reportData = typeof row.reportData === 'string' 
                      ? JSON.parse(row.reportData) 
                      : row.reportData;
                    sum += reportData?.totalMiles || 0;
                  } catch (e) {
                    // Skip invalid reportData
                  }
                });
                resolve(sum);
              }
            });
          });
          
          stat = {
            id: statId,
            title: 'Total Miles',
            value: Math.round(total || 0),
            icon: 'location',
            color: '#00bcd4',
          };
          break;
        }
        
        case 'total-employees': {
          // Count active employees (only for finance/admin)
          if (userRole === 'finance' || userRole === 'admin') {
            stat = await new Promise((resolve, reject) => {
              db.get("SELECT COUNT(*) as count FROM employees WHERE archived = 0 OR archived IS NULL", [], (err, row) => {
                if (err) reject(err);
                else resolve({
                  id: statId,
                  title: 'Active Employees',
                  value: row.count || 0,
                  icon: 'people',
                  color: '#3f51b5',
                });
              });
            });
          }
          break;
        }
        
        case 'team-members': {
          // Count team members (only for supervisor)
          if (userRole === 'supervisor' && userId) {
            stat = await new Promise((resolve, reject) => {
              db.get('SELECT COUNT(*) as count FROM employees WHERE supervisorId = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve({
                  id: statId,
                  title: 'Team Members',
                  value: row.count || 0,
                  icon: 'people',
                  color: '#3f51b5',
                });
              });
            });
          }
          break;
        }
        
        case 'average-expense': {
          // Average expense per report
          let query = `
            SELECT er.reportData
            FROM expense_reports er
            WHERE er.status IN ('submitted', 'approved')
          `;
          const params = [];
          
          if (startDate && endDate) {
            query += ' AND date(?) <= date(er.submittedAt) AND date(er.submittedAt) <= date(?)';
            params.push(startDate, endDate);
          }
          
          if (userRole === 'supervisor' && userId) {
            const supervisedEmployees = await new Promise((resolve, reject) => {
              db.all('SELECT id FROM employees WHERE supervisorId = ?', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.id));
              });
            });
            
            if (supervisedEmployees.length > 0) {
              const placeholders = supervisedEmployees.map(() => '?').join(',');
              query += ` AND er.employeeId IN (${placeholders})`;
              params.push(...supervisedEmployees);
            } else {
              query += ' AND 1=0';
            }
          }
          
          const result = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
              if (err) reject(err);
              else {
                let sum = 0;
                let count = 0;
                rows.forEach(row => {
                  try {
                    const reportData = typeof row.reportData === 'string' 
                      ? JSON.parse(row.reportData) 
                      : row.reportData;
                    const total = calculateTotalExpensesFromReportData(reportData);
                    if (total > 0) {
                      sum += total;
                      count++;
                    }
                  } catch (e) {
                    // Skip invalid reportData
                  }
                });
                const avg = count > 0 ? sum / count : 0;
                resolve({ avg, count });
              }
            });
          });
          
          stat = {
            id: statId,
            title: 'Average Expense per Report',
            value: Math.round(result.avg * 100) / 100,
            icon: 'assessment',
            color: '#ff5722',
            subtitle: `Based on ${result.count} reports`,
          };
          break;
        }
        
        case 'submissions-this-month': {
          // Reports submitted this month
          let query = `
            SELECT COUNT(*) as count
            FROM expense_reports
            WHERE status = 'submitted'
              AND strftime('%m', submittedAt) = ?
              AND strftime('%Y', submittedAt) = ?
          `;
          const params = [String(currentMonth).padStart(2, '0'), String(currentYear)];
          
          if (userRole === 'supervisor' && userId) {
            const supervisedEmployees = await new Promise((resolve, reject) => {
              db.all('SELECT id FROM employees WHERE supervisorId = ?', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.id));
              });
            });
            
            if (supervisedEmployees.length > 0) {
              const placeholders = supervisedEmployees.map(() => '?').join(',');
              query += ` AND employeeId IN (${placeholders})`;
              params.push(...supervisedEmployees);
            } else {
              query += ' AND 1=0';
            }
          }
          
          stat = await new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
              if (err) reject(err);
              else resolve({
                id: statId,
                title: 'Submissions This Month',
                value: row.count || 0,
                icon: 'schedule',
                color: '#009688',
              });
            });
          });
          break;
        }
        
        case 'expenses-trend': {
          // Expense trend over time (finance and supervisors)
          let query = `
            SELECT er.reportData, er.submittedAt, er.employeeId
            FROM expense_reports er
            WHERE er.status IN ('submitted', 'approved')
          `;
          const params = [];

          if (startDate && endDate) {
            query += ' AND date(?) <= date(er.submittedAt) AND date(er.submittedAt) <= date(?)';
            params.push(startDate, endDate);
          }

          if (userRole === 'supervisor' && userId) {
            const supervisedEmployees = await new Promise((resolve, reject) => {
              db.all('SELECT id FROM employees WHERE supervisorId = ?', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.id));
              });
            });

            if (supervisedEmployees.length > 0) {
              const placeholders = supervisedEmployees.map(() => '?').join(',');
              query += ` AND er.employeeId IN (${placeholders})`;
              params.push(...supervisedEmployees);
            } else {
              query += ' AND 1=0';
            }
          }

          const now = endDate ? new Date(endDate) : new Date();
          const monthsToInclude = 6;
          const startRangeDate = startDate
            ? new Date(startDate)
            : new Date(now.getFullYear(), now.getMonth() - (monthsToInclude - 1), 1);
          const endRangeDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

          const formatDateToISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const effectiveStartISO = formatDateToISO(startRangeDate);
          const effectiveEndISO = formatDateToISO(endRangeDate);

          if (!(startDate && endDate)) {
            query += ' AND date(?) <= date(er.submittedAt) AND date(er.submittedAt) <= date(?)';
            params.push(effectiveStartISO, effectiveEndISO);
          }

          const monthKeys = [];
          const tempDate = new Date(startRangeDate.getFullYear(), startRangeDate.getMonth(), 1);
          while (tempDate <= endRangeDate) {
            const key = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
            monthKeys.push(key);
            tempDate.setMonth(tempDate.getMonth() + 1);
          }

          const monthTotals = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
              if (err) {
                reject(err);
                return;
              }

              const totalsMap = new Map();
              rows.forEach(row => {
                try {
                  const reportData = typeof row.reportData === 'string'
                    ? JSON.parse(row.reportData)
                    : row.reportData;
                  const submittedAt = row.submittedAt ? new Date(row.submittedAt) : null;
                  if (!submittedAt || Number.isNaN(submittedAt.getTime())) return;

                  const monthKey = `${submittedAt.getFullYear()}-${String(submittedAt.getMonth() + 1).padStart(2, '0')}`;
                  const totalExpenses = calculateTotalExpensesFromReportData(reportData);
                  if (!totalsMap.has(monthKey)) {
                    totalsMap.set(monthKey, 0);
                  }
                  totalsMap.set(monthKey, totalsMap.get(monthKey) + (totalExpenses || 0));
                } catch (e) {
                  // Ignore malformed rows
                }
              });

              resolve(totalsMap);
            });
          });

          const trendData = monthKeys.map(monthKey => {
            const [year, month] = monthKey.split('-').map(part => parseInt(part, 10));
            const labelDate = new Date(year, month - 1, 1);
            return {
              monthKey,
              label: labelDate.toLocaleString('default', { month: 'short' }),
              value: Number((monthTotals.get(monthKey) || 0).toFixed(2)),
            };
          });

          const latestPoint = trendData[trendData.length - 1];
          const previousPoint = trendData.length > 1 ? trendData[trendData.length - 2] : null;
          let percentChange = null;
          if (latestPoint && previousPoint && previousPoint.value !== 0) {
            percentChange = ((latestPoint.value - previousPoint.value) / previousPoint.value) * 100;
          }

          stat = {
            id: statId,
            title: 'Expense Trend',
            value: latestPoint ? latestPoint.value : 0,
            icon: 'trend',
            color: '#1e88e5',
            trend: percentChange !== null ? {
              value: percentChange,
              label: `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}% vs prior`,
            } : undefined,
            subtitle: trendData.length > 0
              ? `${trendData[0].label} - ${trendData[trendData.length - 1].label}`
              : 'No data available',
            metadata: {
              trendData,
              trendUnit: 'currency',
              periodLabel: `${monthsToInclude} months`,
            },
          };
          break;
        }

        case 'expenses-by-category': {
          let query = `
            SELECT er.reportData, er.submittedAt, er.employeeId
            FROM expense_reports er
            WHERE er.status IN ('submitted', 'approved')
          `;
          const params = [];

          if (startDate && endDate) {
            query += ' AND date(?) <= date(er.submittedAt) AND date(er.submittedAt) <= date(?)';
            params.push(startDate, endDate);
          }

          if (userRole === 'supervisor' && userId) {
            const supervisedEmployees = await new Promise((resolve, reject) => {
              db.all('SELECT id FROM employees WHERE supervisorId = ?', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.id));
              });
            });

            if (supervisedEmployees.length > 0) {
              const placeholders = supervisedEmployees.map(() => '?').join(',');
              query += ` AND er.employeeId IN (${placeholders})`;
              params.push(...supervisedEmployees);
            } else {
              query += ' AND 1=0';
            }
          }

          const filterStatesParam = (req.query.filterStates || '').toString();
          const filterStates = filterStatesParam
            ? filterStatesParam.split(',').map(s => s.trim()).filter(Boolean)
            : [];
          const stateFilterSet = new Set(filterStates);

          const filterCostCentersParam = (req.query.filterCostCenters || '').toString();
          const filterCostCenters = filterCostCentersParam
            ? filterCostCentersParam.split(',').map(s => s.trim()).filter(Boolean)
            : [];
          const costCenterFilterSet = new Set(filterCostCenters);

          const now = endDate ? new Date(endDate) : new Date();
          const monthsToInclude = 6;
          const startRangeDate = startDate
            ? new Date(startDate)
            : new Date(now.getFullYear(), now.getMonth() - (monthsToInclude - 1), 1);
          const endRangeDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

          const formatDateToISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const effectiveStartISO = formatDateToISO(startRangeDate);
          const effectiveEndISO = formatDateToISO(endRangeDate);

          if (!(startDate && endDate)) {
            query += ' AND date(?) <= date(er.submittedAt) AND date(er.submittedAt) <= date(?)';
            params.push(effectiveStartISO, effectiveEndISO);
          }

          const categoryDefinitions = [
            { id: 'mileage', key: 'totalMileageAmount', label: 'Mileage' },
            { id: 'airRailBus', key: 'airRailBus', label: 'Air / Rail / Bus' },
            { id: 'vehicleRentalFuel', key: 'vehicleRentalFuel', label: 'Vehicle Rental & Fuel' },
            { id: 'parkingTolls', key: 'parkingTolls', label: 'Parking & Tolls' },
            { id: 'groundTransportation', key: 'groundTransportation', label: 'Ground Transportation' },
            { id: 'hotelsAirbnb', key: 'hotelsAirbnb', label: 'Lodging' },
            { id: 'perDiem', key: 'perDiem', label: 'Per Diem' },
            { id: 'phoneInternetFax', key: 'phoneInternetFax', label: 'Phone / Internet / Fax' },
            { id: 'shippingPostage', key: 'shippingPostage', label: 'Shipping & Postage' },
            { id: 'printingCopying', key: 'printingCopying', label: 'Printing & Copying' },
            { id: 'officeSupplies', key: 'officeSupplies', label: 'Office Supplies' },
            { id: 'eesReceipt', key: 'eesReceipt', label: 'EES Receipt' },
            { id: 'meals', key: 'meals', label: 'Meals' },
            { id: 'other', key: 'other', label: 'Other' },
          ];

          const availableStatesSet = new Set();
          const availableCostCentersSet = new Set();
          const categoryTotals = new Map(categoryDefinitions.map(def => [def.id, 0]));

          const extractStateFromAddress = (baseAddress) => {
            if (!baseAddress) return '';
            const exactMatch = baseAddress.match(/\b([A-Z]{2})\s+\d{5}(-\d{4})?\b/);
            if (exactMatch) return exactMatch[1];

            const parts = baseAddress.split(',');
            if (parts.length >= 2) {
              const lastPart = parts[parts.length - 1].trim();
              const stateMatch = lastPart.match(/\b([A-Z]{2})\b/);
              if (stateMatch) return stateMatch[1];
            }

            const looseMatch = baseAddress.match(/\b([A-Z]{2})\b/);
            if (looseMatch) {
              const potentialState = looseMatch[1];
              const validStates = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];
              if (validStates.includes(potentialState)) {
                return potentialState;
              }
            }

            return '';
          };

          await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
              if (err) {
                reject(err);
                return;
              }

              rows.forEach(row => {
                try {
                  const reportData = typeof row.reportData === 'string'
                    ? JSON.parse(row.reportData)
                    : row.reportData;

                  const baseAddress = reportData?.baseAddress || '';
                  const state = extractStateFromAddress(baseAddress);
                  if (state) {
                    availableStatesSet.add(state);
                  }

                  const costCenters = Array.isArray(reportData?.costCenters)
                    ? reportData.costCenters.filter(Boolean)
                    : [];
                  costCenters.forEach(cc => availableCostCentersSet.add(cc));

                  if (stateFilterSet.size > 0 && (!state || !stateFilterSet.has(state))) {
                    return;
                  }

                  if (costCenterFilterSet.size > 0) {
                    const hasIntersection = costCenters.some(cc => costCenterFilterSet.has(cc));
                    if (!hasIntersection) {
                      return;
                    }
                  }

                  categoryDefinitions.forEach(def => {
                    const amount = Number(reportData?.[def.key] || 0);
                    if (!Number.isNaN(amount) && amount !== 0) {
                      categoryTotals.set(def.id, (categoryTotals.get(def.id) || 0) + amount);
                    }
                  });
                } catch (e) {
                  // Skip malformed report data
                }
              });

              resolve();
            });
          });

          const categories = categoryDefinitions
            .map(def => ({
              id: def.id,
              label: def.label,
              value: Number((categoryTotals.get(def.id) || 0).toFixed(2)),
            }))
            .filter(cat => cat.value > 0)
            .sort((a, b) => b.value - a.value);

          const totalExpenses = categories.reduce((sum, cat) => sum + cat.value, 0);

          stat = {
            id: statId,
            title: 'Expenses by Category',
            value: totalExpenses,
            icon: 'assessment',
            color: '#8e24aa',
            subtitle: categories.length > 0 ? `${categories.length} categories` : 'No category data available',
            metadata: {
              categories,
              trendUnit: 'currency',
              availableStates: Array.from(availableStatesSet).sort(),
              availableCostCenters: Array.from(availableCostCentersSet).sort(),
              selectedStates: filterStates,
              selectedCostCenters: filterCostCenters,
            },
          };
          break;
        }

        case 'expenses-by-state': {
          // Expenses by state (only for finance)
          if (userRole === 'finance') {
            let query = `
              SELECT 
                er.reportData,
                er.submittedAt
              FROM expense_reports er
              WHERE er.status IN ('submitted', 'approved')
            `;
            const params = [];
            
            if (startDate && endDate) {
              query += ' AND date(?) <= date(er.submittedAt) AND date(er.submittedAt) <= date(?)';
              params.push(startDate, endDate);
            }
            
            const stateTotals = await new Promise((resolve, reject) => {
              db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else {
                  // Extract state from reportData and aggregate
                  const stateMap = new Map();
                  rows.forEach(row => {
                    try {
                      const reportData = typeof row.reportData === 'string' 
                        ? JSON.parse(row.reportData) 
                        : row.reportData;
                      const baseAddress = reportData?.baseAddress || '';
                      const totalExpenses = calculateTotalExpensesFromReportData(reportData);
                      
                      let state = '';
                      if (baseAddress) {
                        // Try multiple patterns to extract state
                        // Pattern 1: "ST ZIP" (e.g., "CA 90210")
                        const stateMatch = baseAddress.match(/\b([A-Z]{2})\s+\d{5}(-\d{4})?\b/);
                        if (stateMatch) {
                          state = stateMatch[1];
                        } else {
                          // Pattern 2: "City, ST" or "Address, City, ST"
                          const parts = baseAddress.split(',');
                          if (parts.length >= 2) {
                            const lastPart = parts[parts.length - 1].trim();
                            // Look for 2-letter uppercase code (state abbreviation)
                            const stateFromLastPart = lastPart.match(/\b([A-Z]{2})\b/);
                            if (stateFromLastPart) {
                              state = stateFromLastPart[1];
                            }
                          }
                          // Pattern 3: Try to find state anywhere in the address
                          if (!state) {
                            const anywhereMatch = baseAddress.match(/\b([A-Z]{2})\b/);
                            if (anywhereMatch) {
                              // Validate it's likely a state (2 uppercase letters, not part of a word)
                              const potentialState = anywhereMatch[1];
                              // Common state abbreviations - if it matches, use it
                              const validStates = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];
                              if (validStates.includes(potentialState)) {
                                state = potentialState;
                              }
                            }
                          }
                        }
                      }
                      if (state && totalExpenses > 0) {
                        stateMap.set(state, (stateMap.get(state) || 0) + totalExpenses);
                      }
                    } catch (e) {
                      // Skip invalid reportData
                    }
                  });
                  resolve(stateMap);
                }
              });
            });
            
            // If a specific state is filtered, return only that state's total
            if (filterState) {
              const filteredTotal = stateTotals.get(filterState) || 0;
              stat = {
                id: statId,
                title: `Expenses by State: ${filterState}`,
                value: filteredTotal,
                icon: 'location',
                color: '#795548',
                subtitle: `Total expenses for ${filterState}`,
                metadata: {
                  availableStates: Array.from(stateTotals.keys()).sort(),
                  selectedState: filterState,
                },
              };
            } else {
              // Format as a summary string
              const stateEntries = Array.from(stateTotals.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([state, total]) => `${state}: $${total.toLocaleString()}`)
                .join(', ');
              
              stat = {
                id: statId,
                title: 'Expenses by State',
                value: stateTotals.size,
                icon: 'location',
                color: '#795548',
                subtitle: stateEntries || 'No state data available',
                metadata: {
                  availableStates: Array.from(stateTotals.keys()).sort(),
                },
              };
            }
          }
          break;
        }
        
        case 'expenses-by-cost-center': {
          // Expenses by cost center
          let query = `
            SELECT 
              er.reportData,
              er.employeeId,
              er.submittedAt
            FROM expense_reports er
            WHERE er.status IN ('submitted', 'approved')
          `;
          const params = [];
          
          if (startDate && endDate) {
            query += ' AND date(?) <= date(er.submittedAt) AND date(er.submittedAt) <= date(?)';
            params.push(startDate, endDate);
          }
          
          if (userRole === 'supervisor' && userId) {
            const supervisedEmployees = await new Promise((resolve, reject) => {
              db.all('SELECT id FROM employees WHERE supervisorId = ?', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.id));
              });
            });
            
            if (supervisedEmployees.length > 0) {
              const placeholders = supervisedEmployees.map(() => '?').join(',');
              query += ` AND er.employeeId IN (${placeholders})`;
              params.push(...supervisedEmployees);
            } else {
              query += ' AND 1=0';
            }
          }
          
          const costCenterTotals = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
              if (err) reject(err);
              else {
                const ccMap = new Map();
                rows.forEach(row => {
                  try {
                    const reportData = typeof row.reportData === 'string' 
                      ? JSON.parse(row.reportData) 
                      : row.reportData;
                    const costCenters = reportData?.costCenters || [];
                    const totalExpenses = calculateTotalExpensesFromReportData(reportData);
                    
                    if (costCenters.length > 0 && totalExpenses > 0) {
                      // Distribute total evenly across cost centers
                      const perCC = totalExpenses / costCenters.length;
                      costCenters.forEach((cc) => {
                        ccMap.set(cc, (ccMap.get(cc) || 0) + perCC);
                      });
                    }
                  } catch (e) {
                    // Skip invalid reportData
                  }
                });
                resolve(ccMap);
              }
            });
          });
          
          // Get all available cost centers from the cost_centers table
          const allCostCenters = await new Promise((resolve, reject) => {
            db.all('SELECT code FROM cost_centers ORDER BY code', [], (err, rows) => {
              if (err) reject(err);
              else resolve(rows.map(r => r.code));
            });
          });
          
          // If a specific cost center is filtered, return only that cost center's total
          if (filterCostCenter) {
            const filteredTotal = costCenterTotals.get(filterCostCenter) || 0;
            stat = {
              id: statId,
              title: `Expenses by Cost Center: ${filterCostCenter}`,
              value: filteredTotal,
              icon: 'assessment',
              color: '#607d8b',
              subtitle: `Total expenses for ${filterCostCenter}`,
              metadata: {
                availableCostCenters: allCostCenters,
                selectedCostCenter: filterCostCenter,
              },
            };
          } else {
            // Format as a summary string
            const ccEntries = Array.from(costCenterTotals.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([cc, total]) => `${cc}: $${total.toFixed(0)}`)
              .join(', ');
            
            stat = {
              id: statId,
              title: 'Expenses by Cost Center',
              value: costCenterTotals.size,
              icon: 'assessment',
              color: '#607d8b',
              subtitle: ccEntries || 'No cost center data available',
              metadata: {
                availableCostCenters: allCostCenters,
              },
            };
          }
          break;
        }
      }
      
      if (stat) {
        results.push(stat);
      }
    }
    
    res.json({ statistics: results });
  } catch (error) {
    debugError('❌ Error fetching dashboard statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/admin/reporting/overview', async (req, res) => {
  const db = dbService.getDb();
  try {
    const now = new Date();
    const requestedEnd = parseDateInput(req.query.endDate);
    const requestedStart = parseDateInput(req.query.startDate);

    let endDate = requestedEnd || new Date(now);
    let startDate = requestedStart || new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    if (startDate > endDate) {
      const temp = startDate;
      startDate = endDate;
      endDate = temp;
    }

    startDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const startIso = toSqlDate(startDate);
    const endIso = toSqlDate(endDate);

    const monthRange = generateMonthRange(startDate, endDate);
    const monthsInRange = monthRange.length || 1;

    const startMonthKey =
      monthRange.length > 0
        ? monthRange[0].year * 100 + monthRange[0].month
        : startDate.getFullYear() * 100 + (startDate.getMonth() + 1);

    const endMonthKey =
      monthRange.length > 0
        ? monthRange[monthRange.length - 1].year * 100 + monthRange[monthRange.length - 1].month
        : endDate.getFullYear() * 100 + (endDate.getMonth() + 1);

    const costCenters = normalizeListParam(req.query.costCenters ?? req.query.costCenter);
    const normalizedCostCenters = Array.from(new Set(costCenters));
    const costCenterSqlValues = Array.from(
      new Set(
        normalizedCostCenters.map((cc) =>
          typeof cc === 'string' && cc.toLowerCase() === 'unassigned' ? '' : cc
        )
      )
    );

    const collectEmployeeIds = async (ccValuesForFilter, includeAssignments) => {
      const employeeSet = new Set();
      const filterClause = Array.isArray(ccValuesForFilter) && ccValuesForFilter.length > 0
        ? buildCostCenterClause('costCenter', ccValuesForFilter)
        : { clause: '', params: [] };
      const hasFilter = filterClause.params.length > 0;

      const collectFromTable = async (tableName, dateColumn) => {
        let sql = `
          SELECT DISTINCT employeeId
          FROM ${tableName}
          WHERE date(${dateColumn}) BETWEEN date(?) AND date(?)
        `;
        const params = [startIso, endIso, ...filterClause.params];
        sql += filterClause.clause;

        const rows = await dbAllAsync(sql, params);
        rows.forEach((row) => {
          if (row && row.employeeId) {
            employeeSet.add(row.employeeId);
          }
        });
      };

      await collectFromTable('receipts', 'date');
      await collectFromTable('mileage_entries', 'date');
      await collectFromTable('time_tracking', 'date');

      if (includeAssignments && normalizedCostCenters.length > 0) {
        const assignmentClauses = [];
        const assignmentParams = [];

        normalizedCostCenters.forEach((cc) => {
          if (typeof cc === 'string' && cc.toLowerCase() === 'unassigned') {
            assignmentClauses.push('(defaultCostCenter IS NULL OR defaultCostCenter = "")');
          } else {
            assignmentClauses.push('defaultCostCenter = ?');
            assignmentParams.push(cc);
            assignmentClauses.push('selectedCostCenters LIKE ?');
            assignmentParams.push(`%${cc}%`);
          }
        });

        if (assignmentClauses.length > 0) {
          const rows = await dbAllAsync(
            `SELECT id FROM employees WHERE ${assignmentClauses.join(' OR ')}`,
            assignmentParams
          );
          rows.forEach((row) => {
            if (row && row.id) {
              employeeSet.add(row.id);
            }
          });
        }
      }

      return employeeSet;
    };

    const activeEmployeeIdsSet = await collectEmployeeIds(
      costCenterSqlValues.length ? costCenterSqlValues : null,
      normalizedCostCenters.length > 0
    );
    const activeEmployeeCount = activeEmployeeIdsSet.size;
    const employeeIdsForPipeline = normalizedCostCenters.length > 0
      ? Array.from(activeEmployeeIdsSet)
      : null;

    const mileageClause = buildCostCenterClause('costCenter', costCenterSqlValues);
    const mileageSummary = await dbGetAsync(
      `
        SELECT 
          IFNULL(SUM(miles), 0) AS totalMiles,
          COUNT(*) AS entryCount
        FROM mileage_entries
        WHERE date(date) BETWEEN date(?) AND date(?)
        ${mileageClause.clause}
      `,
      [startIso, endIso, ...mileageClause.params]
    );

    const receiptsClause = buildCostCenterClause('costCenter', costCenterSqlValues);
    const receiptsSummary = await dbGetAsync(
      `
        SELECT 
          IFNULL(SUM(amount), 0) AS totalAmount,
          COUNT(*) AS totalCount
        FROM receipts
        WHERE date(date) BETWEEN date(?) AND date(?)
        ${receiptsClause.clause}
      `,
      [startIso, endIso, ...receiptsClause.params]
    );

    const perDiemSummary = await dbGetAsync(
      `
        SELECT 
          IFNULL(SUM(amount), 0) AS totalAmount,
          COUNT(*) AS entryCount
        FROM receipts
        WHERE category = 'Per Diem'
          AND date(date) BETWEEN date(?) AND date(?)
        ${receiptsClause.clause}
      `,
      [startIso, endIso, ...receiptsClause.params]
    );

    const timeClause = buildCostCenterClause('costCenter', costCenterSqlValues);
    const timeSummary = await dbGetAsync(
      `
        SELECT 
          IFNULL(SUM(hours), 0) AS totalHours,
          COUNT(*) AS entryCount
        FROM time_tracking
        WHERE date(date) BETWEEN date(?) AND date(?)
        ${timeClause.clause}
      `,
      [startIso, endIso, ...timeClause.params]
    );

    const trackedStatuses = [
      'draft',
      'submitted',
      'pending_supervisor',
      'pending_finance',
      'under_review',
      'needs_revision',
      'approved',
      'rejected',
    ];

    let statusCounts = {};
    if (!employeeIdsForPipeline || employeeIdsForPipeline.length > 0) {
      let pipelineSql = `
        SELECT status, COUNT(*) AS count
        FROM expense_reports
        WHERE ((year * 100) + month) BETWEEN ? AND ?
          AND status IN (${trackedStatuses.map(() => '?').join(',')})
      `;
      const pipelineParams = [startMonthKey, endMonthKey, ...trackedStatuses];

      if (employeeIdsForPipeline && employeeIdsForPipeline.length > 0) {
        const placeholders = employeeIdsForPipeline.map(() => '?').join(',');
        pipelineSql += ` AND employeeId IN (${placeholders})`;
        pipelineParams.push(...employeeIdsForPipeline);
      }

      const pipelineRows = await dbAllAsync(pipelineSql, pipelineParams);
      statusCounts = pipelineRows.reduce((acc, row) => {
        acc[row.status] = row.count;
        return acc;
      }, {});
    }

    const pipelineStages = [
      { id: 'draft', label: 'Draft', description: 'Reports saved but not submitted' },
      { id: 'submitted', label: 'Submitted', description: 'Submitted by staff' },
      { id: 'pending_supervisor', label: 'Supervisor Review', description: 'Waiting on supervisor' },
      { id: 'pending_finance', label: 'Finance Review', description: 'Awaiting finance approval' },
      { id: 'under_review', label: 'Under Review', description: 'Being reviewed by finance' },
      { id: 'needs_revision', label: 'Needs Revision', description: 'Sent back for updates' },
      { id: 'approved', label: 'Approved', description: 'Fully approved reports' },
      { id: 'rejected', label: 'Rejected', description: 'Reports rejected or voided' },
    ];

    const submissionFunnel = pipelineStages.map((stage) => ({
      id: stage.id,
      label: stage.label,
      description: stage.description,
      count: Number(statusCounts[stage.id] || 0),
    }));

    const costCenterTotalsMap = await getCostCenterTotalsForPeriod(
      startIso,
      endIso,
      costCenterSqlValues
    );

    const baselineEndDate = new Date(startDate.getFullYear(), startDate.getMonth(), 0);
    const baselineStartDate = shiftDateByMonths(startDate, -monthsInRange);
    const baselineStartIso = toSqlDate(baselineStartDate);
    const baselineEndIso = toSqlDate(baselineEndDate);
    const baselineCostCenterTotalsMap = await getCostCenterTotalsForPeriod(
      baselineStartIso,
      baselineEndIso,
      costCenterSqlValues
    );

    const topSpendEntries = Array.from(costCenterTotalsMap.entries())
      .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
      .slice(0, 5)
      .map(([costCenter, value]) => ({
        costCenter,
        totalAmount: value.totalAmount,
        receiptCount: value.receiptCount,
      }));

    const topMilesRows = await dbAllAsync(
      `
        SELECT 
          COALESCE(NULLIF(costCenter, ''), 'Unassigned') AS costCenterName,
          IFNULL(SUM(miles), 0) AS totalMiles,
          COUNT(*) AS entryCount
        FROM mileage_entries
        WHERE date(date) BETWEEN date(?) AND date(?)
        ${mileageClause.clause}
        GROUP BY costCenterName
        ORDER BY totalMiles DESC
        LIMIT 5
      `,
      [startIso, endIso, ...mileageClause.params]
    );

    const topCostCenters = {
      bySpend: topSpendEntries,
      byMiles: topMilesRows.map((row) => ({
        costCenter: row.costCenterName,
        totalMiles: Number(row.totalMiles || 0),
        entryCount: row.entryCount || 0,
      })),
    };

    const reportsInRange = await dbAllAsync(
      `
        SELECT er.*, e.name AS employeeName
        FROM expense_reports er
        LEFT JOIN employees e ON e.id = er.employeeId
        WHERE ((er.year * 100) + er.month) BETWEEN ? AND ?
      `,
      [startMonthKey, endMonthKey]
    );

    const missingReceipts = [];
    reportsInRange.forEach((row) => {
      try {
        const reportData =
          typeof row.reportData === 'string' ? JSON.parse(row.reportData) : row.reportData || {};
        if (!reportMatchesCostCenterFilter(reportData, normalizedCostCenters)) {
          return;
        }
        const totalExpenses = calculateTotalExpensesFromReportData(reportData);
        const receiptCount = Array.isArray(reportData?.receipts) ? reportData.receipts.length : 0;
        if (receiptCount === 0 && totalExpenses > 0) {
          missingReceipts.push({
            reportId: row.id,
            employeeId: row.employeeId,
            employeeName: row.employeeName || 'Unknown',
            status: row.status,
            month: row.month,
            year: row.year,
            totalExpenses,
          });
        }
      } catch (error) {
        // Skip malformed report data
      }
    });
    missingReceipts.sort((a, b) => b.totalExpenses - a.totalExpenses);

    const thresholdParam = Number.parseInt(req.query.thresholdDays, 10);
    const attentionThresholdDays = Number.isFinite(thresholdParam) && thresholdParam > 0
      ? Math.min(thresholdParam, 60)
      : 5;
    const staleDate = new Date(endDate);
    staleDate.setDate(staleDate.getDate() - attentionThresholdDays);
    const staleIso = toSqlDate(staleDate);

    let attentionTotal = 0;
    let attentionRecords = [];
    if (!employeeIdsForPipeline || employeeIdsForPipeline.length > 0) {
      let attentionSql = `
        SELECT 
          er.id,
          er.employeeId,
          er.status,
          er.submittedAt,
          er.updatedAt,
          er.month,
          er.year,
          er.currentApprovalStage,
          er.currentApproverName,
          e.name AS employeeName,
          e.defaultCostCenter
        FROM expense_reports er
        LEFT JOIN employees e ON e.id = er.employeeId
        WHERE er.status IN ('submitted','pending_supervisor','pending_finance','needs_revision','under_review')
          AND (
            (er.submittedAt IS NOT NULL AND date(er.submittedAt) <= date(?))
            OR (er.submittedAt IS NULL AND er.updatedAt IS NOT NULL AND date(er.updatedAt) <= date(?))
          )
          AND ((er.year * 100) + er.month) BETWEEN ? AND ?
      `;
      const attentionParams = [staleIso, staleIso, startMonthKey, endMonthKey];

      if (employeeIdsForPipeline && employeeIdsForPipeline.length > 0) {
        const placeholders = employeeIdsForPipeline.map(() => '?').join(',');
        attentionSql += ` AND er.employeeId IN (${placeholders})`;
        attentionParams.push(...employeeIdsForPipeline);
      }

      const attentionRows = await dbAllAsync(attentionSql, attentionParams);
      const referenceDate = new Date(endIso);

      const mappedAttention = attentionRows.map((row) => {
        const submitted = row.submittedAt ? new Date(row.submittedAt)
          : (row.updatedAt ? new Date(row.updatedAt) : null);
        let agingDays = null;
        if (submitted && !Number.isNaN(submitted.getTime())) {
          agingDays = Math.floor((referenceDate - submitted) / MS_IN_DAY);
          if (agingDays < 0) agingDays = 0;
        }

        return {
          reportId: row.id,
          employeeId: row.employeeId,
          employeeName: row.employeeName || 'Unknown',
          status: row.status,
          currentStage: row.currentApprovalStage || null,
          currentApprover: row.currentApproverName || null,
          submittedAt: row.submittedAt,
          updatedAt: row.updatedAt,
          month: row.month,
          year: row.year,
          defaultCostCenter: row.defaultCostCenter || '',
          agingDays,
        };
      }).sort((a, b) => (b.agingDays || 0) - (a.agingDays || 0));

      attentionTotal = mappedAttention.length;
      attentionRecords = mappedAttention.slice(0, 10);
    }

    const overdueApprovals = attentionRecords.filter((record) =>
      ['submitted', 'pending_supervisor', 'pending_finance', 'under_review'].includes(record.status)
    );

    const overBudget = [];
    costCenterTotalsMap.forEach((value, costCenter) => {
      const actual = value.totalAmount;
      const baselineValue = baselineCostCenterTotalsMap.get(costCenter);
      const baseline = baselineValue ? baselineValue.totalAmount : 0;
      if (baseline > 0) {
        const variance = actual - baseline;
        const variancePct = variance / baseline;
        if (variancePct >= 0.1) {
          overBudget.push({
            costCenter,
            actual,
            baseline,
            variance,
            variancePct: Number((variancePct * 100).toFixed(1)),
          });
        }
      }
    });
    overBudget.sort((a, b) => (b.variancePct || 0) - (a.variancePct || 0));

    const attentionCategories = {
      overdueApprovals: overdueApprovals.slice(0, 10),
      missingReceipts: missingReceipts.slice(0, 10),
      overBudget: overBudget.slice(0, 10),
    };

    const summaryCards = [
      {
        id: 'totalMiles',
        label: 'Total Miles',
        value: Number(mileageSummary?.totalMiles || 0),
        unit: 'mi',
        meta: { entries: mileageSummary?.entryCount || 0 },
      },
      {
        id: 'receiptSpend',
        label: 'Receipt Spend',
        value: Number(receiptsSummary?.totalAmount || 0),
        unit: 'usd',
        meta: { receipts: receiptsSummary?.totalCount || 0 },
      },
      {
        id: 'perDiem',
        label: 'Per Diem',
        value: Number(perDiemSummary?.totalAmount || 0),
        unit: 'usd',
        meta: { claims: perDiemSummary?.entryCount || 0 },
      },
      {
        id: 'totalHours',
        label: 'Hours Logged',
        value: Number(timeSummary?.totalHours || 0),
        unit: 'hrs',
        meta: { entries: timeSummary?.entryCount || 0 },
      },
      {
        id: 'activeEmployees',
        label: 'Active Employees',
        value: activeEmployeeCount,
        unit: 'people',
      },
    ];

    const allCostCenters = await dbAllAsync(
      'SELECT code FROM cost_centers ORDER BY code',
      []
    );

    res.json({
      range: { start: startIso, end: endIso },
      filters: { costCenters: normalizedCostCenters },
      summaryCards,
      submissionFunnel,
      topCostCenters,
      attention: {
        thresholdDays: attentionThresholdDays,
        total: attentionTotal,
        records: attentionRecords,
        categories: attentionCategories,
      },
      generatedAt: new Date().toISOString(),
      metadata: {
        availableCostCenters: allCostCenters.map((row) => row.code),
        baselineRange: { start: baselineStartIso, end: baselineEndIso },
      },
    });
  } catch (error) {
    debugError('❌ Error generating admin reporting overview:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/admin/reporting/trends', async (req, res) => {
  const db = dbService.getDb();
  try {
    const now = new Date();
    let endDate = parseDateInput(req.query.endDate) || new Date(now);
    let startDate = parseDateInput(req.query.startDate);

    const monthsParam = Number.parseInt(req.query.months, 10);
    if (Number.isFinite(monthsParam) && monthsParam > 0) {
      const monthsBack = Math.max(monthsParam - 1, 0);
      startDate = shiftDateByMonths(endDate, -monthsBack);
    }

    if (!startDate) {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 5, 1);
    }

    if (startDate > endDate) {
      const temp = startDate;
      startDate = endDate;
      endDate = temp;
    }

    startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);
    endDate.setHours(23, 59, 59, 999);

    const startIso = toSqlDate(startDate);
    const endIso = toSqlDate(endDate);

    const months = generateMonthRange(startDate, endDate);
    const monthsInRange = months.length || 1;

    const startMonthKey =
      months.length > 0
        ? months[0].year * 100 + months[0].month
        : startDate.getFullYear() * 100 + (startDate.getMonth() + 1);
    const endMonthKey =
      months.length > 0
        ? months[months.length - 1].year * 100 + months[months.length - 1].month
        : endDate.getFullYear() * 100 + (endDate.getMonth() + 1);

    const costCenters = normalizeListParam(req.query.costCenters ?? req.query.costCenter);
    const normalizedCostCenters = Array.from(new Set(costCenters));
    const costCenterSqlValues = Array.from(
      new Set(
        normalizedCostCenters.map((cc) =>
          typeof cc === 'string' && cc.toLowerCase() === 'unassigned' ? '' : cc
        )
      )
    );

    const mileageClause = buildCostCenterClause('costCenter', costCenterSqlValues);
    const receiptsClause = buildCostCenterClause('costCenter', costCenterSqlValues);

    const totalsByMonth = new Map(
      months.map((m) => [
        m.key,
        {
          monthKey: m.key,
          label: m.label,
          totalExpenses: 0,
          totalMileageAmount: 0,
          totalMiles: 0,
          reportCount: 0,
        },
      ])
    );

    const statusByMonth = new Map(
      months.map((m) => [
        m.key,
        {
          draft: 0,
          submitted: 0,
          pending_supervisor: 0,
          pending_finance: 0,
          under_review: 0,
          needs_revision: 0,
          approved: 0,
          rejected: 0,
        },
      ])
    );

    const expenseRows = await dbAllAsync(
      `
        SELECT id, employeeId, month, year, status, reportData
        FROM expense_reports
        WHERE ((year * 100) + month) BETWEEN ? AND ?
      `,
      [startMonthKey, endMonthKey]
    );

    expenseRows.forEach((row) => {
      try {
        const reportData =
          typeof row.reportData === 'string' ? JSON.parse(row.reportData) : row.reportData || {};
        if (!reportMatchesCostCenterFilter(reportData, normalizedCostCenters)) {
          return;
        }

        const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
        const totalsEntry = totalsByMonth.get(key);
        if (!totalsEntry) {
          return;
        }

        const totalExpenses = calculateTotalExpensesFromReportData(reportData);
        const totalMileageAmount = Number(reportData?.totalMileageAmount || 0);
        const totalMiles = Number(reportData?.totalMiles || 0);

        totalsEntry.totalExpenses += totalExpenses;
        totalsEntry.totalMileageAmount += totalMileageAmount;
        totalsEntry.totalMiles += totalMiles;
        totalsEntry.reportCount += 1;

        const statusEntry = statusByMonth.get(key);
        if (statusEntry) {
          statusEntry[row.status] = (statusEntry[row.status] || 0) + 1;
        }
      } catch (error) {
        // Skip malformed data
      }
    });

    const receiptsRows = await dbAllAsync(
      `
        SELECT strftime('%Y-%m', date) AS monthKey,
               IFNULL(SUM(amount), 0) AS totalAmount,
               COUNT(*) AS receiptCount
        FROM receipts
        WHERE date(date) BETWEEN date(?) AND date(?)
        ${receiptsClause.clause}
        GROUP BY monthKey
      `,
      [startIso, endIso, ...receiptsClause.params]
    );

    const receiptsByMonth = new Map(
      months.map((m) => [
        m.key,
        {
          monthKey: m.key,
          totalAmount: 0,
          receiptCount: 0,
        },
      ])
    );
    receiptsRows.forEach((row) => {
      if (receiptsByMonth.has(row.monthKey)) {
        receiptsByMonth.get(row.monthKey).totalAmount = Number(row.totalAmount || 0);
        receiptsByMonth.get(row.monthKey).receiptCount = row.receiptCount || 0;
      }
    });

    const mileageRows = await dbAllAsync(
      `
        SELECT strftime('%Y-%m', date) AS monthKey,
               IFNULL(SUM(miles), 0) AS totalMiles,
               COUNT(*) AS entryCount
        FROM mileage_entries
        WHERE date(date) BETWEEN date(?) AND date(?)
        ${mileageClause.clause}
        GROUP BY monthKey
      `,
      [startIso, endIso, ...mileageClause.params]
    );

    const mileageByMonth = new Map(
      months.map((m) => [
        m.key,
        {
          monthKey: m.key,
          totalMiles: 0,
          entryCount: 0,
        },
      ])
    );
    mileageRows.forEach((row) => {
      if (mileageByMonth.has(row.monthKey)) {
        mileageByMonth.get(row.monthKey).totalMiles = Number(row.totalMiles || 0);
        mileageByMonth.get(row.monthKey).entryCount = row.entryCount || 0;
      }
    });

    const costCenterTotalsMap = await getCostCenterTotalsForPeriod(
      startIso,
      endIso,
      costCenterSqlValues
    );

    const baselineEndDate = new Date(startDate.getFullYear(), startDate.getMonth(), 0);
    const baselineStartDate = shiftDateByMonths(startDate, -monthsInRange);
    const baselineStartIso = toSqlDate(baselineStartDate);
    const baselineEndIso = toSqlDate(baselineEndDate);
    const baselineCostCenterTotalsMap = await getCostCenterTotalsForPeriod(
      baselineStartIso,
      baselineEndIso,
      costCenterSqlValues
    );

    const totalSpend = Array.from(totalsByMonth.values()).reduce(
      (sum, entry) => sum + entry.totalExpenses,
      0
    );
    const averageSpend = months.length > 0 ? totalSpend / months.length : 0;
    const recentWindow = Math.min(3, months.length);
    const recentTotals = recentWindow
      ? Array.from(totalsByMonth.values())
          .slice(-recentWindow)
          .reduce((sum, entry) => sum + entry.totalExpenses, 0) / recentWindow
      : 0;

    const nextMonthDate = shiftDateByMonths(endDate, 1);
    const nextMonthLabel = nextMonthDate.toLocaleString('default', {
      month: 'short',
      year: 'numeric',
    });

    const costCenterVarianceItems = Array.from(costCenterTotalsMap.entries())
      .map(([costCenter, value]) => {
        const baselineValue = baselineCostCenterTotalsMap.get(costCenter);
        const baseline = baselineValue ? baselineValue.totalAmount : 0;
        const variance = value.totalAmount - baseline;
        const variancePct = baseline > 0 ? variance / baseline : null;
        return {
          costCenter,
          actual: value.totalAmount,
          baseline,
          variance,
          variancePct: variancePct != null ? Number((variancePct * 100).toFixed(1)) : null,
          receiptCount: value.receiptCount,
        };
      })
      .sort((a, b) => (b.variance || 0) - (a.variance || 0));

    res.json({
      range: { start: startIso, end: endIso },
      months,
      monthlyTotals: months.map((m) => totalsByMonth.get(m.key)),
      monthlyStatus: months.map((m) => ({
        monthKey: m.key,
        label: m.label,
        statuses: statusByMonth.get(m.key),
      })),
      receipts: months.map((m) => receiptsByMonth.get(m.key)),
      mileageEntries: months.map((m) => mileageByMonth.get(m.key)),
      costCenterVariance: {
        baselineRange: { start: baselineStartIso, end: baselineEndIso },
        items: costCenterVarianceItems,
      },
      forecast: {
        nextMonthKey: `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`,
        nextMonthLabel,
        expectedSpend: Number(recentTotals.toFixed(2)),
        averageSpend: Number(averageSpend.toFixed(2)),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    debugError('❌ Error generating admin reporting trends:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/admin/reporting/map-data', async (req, res) => {
  const db = dbService.getDb();
  try {
    const now = new Date();
    let endDate = parseDateInput(req.query.endDate) || new Date(now);
    let startDate = parseDateInput(req.query.startDate);

    const monthsParam = Number.parseInt(req.query.months, 10);
    if (Number.isFinite(monthsParam) && monthsParam > 0) {
      startDate = shiftDateByMonths(endDate, -Math.max(monthsParam - 1, 0));
    }

    if (!startDate) {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    }

    if (startDate > endDate) {
      const temp = startDate;
      startDate = endDate;
      endDate = temp;
    }

    startDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    endDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const startIso = toSqlDate(startDate);
    const endIso = toSqlDate(endDate);

    const costCenters = normalizeListParam(req.query.costCenters ?? req.query.costCenter);
    const normalizedCostCenters = Array.from(new Set(costCenters));
    const rows = await dbAllAsync(
      `
        SELECT 
          me.id,
          me.employeeId,
          me.date,
          me.miles,
          me.startLocationLat,
          me.startLocationLng,
          me.endLocationLat,
          me.endLocationLng,
          me.costCenter,
          e.name AS employeeName,
          e.defaultCostCenter
        FROM mileage_entries me
        LEFT JOIN employees e ON e.id = me.employeeId
        WHERE date(me.date) BETWEEN date(?) AND date(?)
          AND me.startLocationLat IS NOT NULL
          AND me.startLocationLng IS NOT NULL
          AND me.endLocationLat IS NOT NULL
          AND me.endLocationLng IS NOT NULL
          AND ABS(me.startLocationLat) > 0.0001
          AND ABS(me.startLocationLng) > 0.0001
          AND ABS(me.endLocationLat) > 0.0001
          AND ABS(me.endLocationLng) > 0.0001
      `,
      [startIso, endIso]
    );

    const allowUnassigned = normalizedCostCenters.some(
      (cc) => typeof cc === 'string' && cc.toLowerCase() === 'unassigned'
    );

    const segmentsMap = new Map();
    const startClustersMap = new Map();
    const endClustersMap = new Map();

    let totalMiles = 0;
    let totalSegments = 0;
    let maxSegmentMiles = 0;
    let maxSegmentCount = 0;

    rows.forEach((row) => {
      const startLat = bucketCoordinate(row.startLocationLat);
      const startLng = bucketCoordinate(row.startLocationLng);
      const endLat = bucketCoordinate(row.endLocationLat);
      const endLng = bucketCoordinate(row.endLocationLng);

      if (startLat == null || startLng == null || endLat == null || endLng == null) {
        return;
      }

      const entryCostCenter = row.costCenter || row.defaultCostCenter || 'Unassigned';
      if (
        normalizedCostCenters.length > 0 &&
        !normalizedCostCenters.includes(entryCostCenter) &&
        !(entryCostCenter === 'Unassigned' && allowUnassigned)
      ) {
        return;
      }

      const miles = Number(row.miles || 0);
      const date = row.date ? new Date(row.date).toISOString().split('T')[0] : null;

      const segmentKey = `${startLat}|${startLng}->${endLat}|${endLng}`;
      if (!segmentsMap.has(segmentKey)) {
        segmentsMap.set(segmentKey, {
          startLat,
          startLng,
          endLat,
          endLng,
          miles: 0,
          count: 0,
          costCenters: new Set(),
          dates: new Set(),
        });
      }
      const segmentEntry = segmentsMap.get(segmentKey);
      segmentEntry.miles += miles;
      segmentEntry.count += 1;
      segmentEntry.costCenters.add(entryCostCenter);
      if (date) segmentEntry.dates.add(date);

      totalMiles += miles;
      totalSegments += 1;
      maxSegmentMiles = Math.max(maxSegmentMiles, segmentEntry.miles);
      maxSegmentCount = Math.max(maxSegmentCount, segmentEntry.count);

      const addCluster = (clusterMap, lat, lng) => {
        const key = `${lat}|${lng}`;
        if (!clusterMap.has(key)) {
          clusterMap.set(key, {
            lat,
            lng,
            miles: 0,
            count: 0,
          });
        }
        const clusterEntry = clusterMap.get(key);
        clusterEntry.miles += miles;
        clusterEntry.count += 1;
      };

      addCluster(startClustersMap, startLat, startLng);
      addCluster(endClustersMap, endLat, endLng);
    });

    const segments = Array.from(segmentsMap.values())
      .map((segment) => ({
        startLat: segment.startLat,
        startLng: segment.startLng,
        endLat: segment.endLat,
        endLng: segment.endLng,
        miles: Number(segment.miles.toFixed(2)),
        count: segment.count,
        costCenters: Array.from(segment.costCenters).slice(0, 5),
        sampleDate: segment.dates.size > 0 ? Array.from(segment.dates)[0] : null,
      }))
      .sort((a, b) => b.miles - a.miles)
      .slice(0, 400);

    const clusters = {
      start: Array.from(startClustersMap.values())
        .map((cluster) => ({
          lat: cluster.lat,
          lng: cluster.lng,
          miles: Number(cluster.miles.toFixed(2)),
          count: cluster.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 300),
      end: Array.from(endClustersMap.values())
        .map((cluster) => ({
          lat: cluster.lat,
          lng: cluster.lng,
          miles: Number(cluster.miles.toFixed(2)),
          count: cluster.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 300),
    };

    res.json({
      range: { start: startIso, end: endIso },
      filters: { costCenters: normalizedCostCenters },
      totals: {
        totalMiles: Number(totalMiles.toFixed(2)),
        totalSegments,
        maxSegmentMiles: Number(maxSegmentMiles.toFixed(2)),
        maxSegmentCount,
      },
      segments,
      clusters,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    debugError('❌ Error generating admin reporting map data:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/admin/reporting/report-builder/fields', (req, res) => {
  const db = dbService.getDb();
  res.json({
    fields: REPORT_BUILDER_FIELDS,
    defaultColumns: REPORT_BUILDER_DEFAULT_COLUMNS,
    statusOptions: REPORT_BUILDER_STATUS_OPTIONS,
    limits: { maxRows: REPORT_BUILDER_MAX_ROWS },
  });
});

router.get('/api/admin/reporting/report-builder/presets', async (req, res) => {
  const db = dbService.getDb();
  try {
    const rows = await dbAllAsync(
      `SELECT * FROM report_builder_presets ORDER BY updatedAt DESC`,
      []
    );

    const presets = rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      columns: sanitizeReportBuilderColumns(helpers.parseJsonSafe(row.columns, [])),
      filters: sanitizeReportBuilderFilters(helpers.parseJsonSafe(row.filters, {})),
      createdBy: row.createdBy || null,
      updatedBy: row.updatedBy || null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    res.json({ presets });
  } catch (error) {
    debugError('❌ Error fetching report builder presets:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/admin/reporting/report-builder/presets', async (req, res) => {
  const db = dbService.getDb();
  try {
    const { name, description = '', columns, filters, createdBy } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Preset name is required' });
      return;
    }

    const sanitizedColumns = sanitizeReportBuilderColumns(columns);
    const sanitizedFilters = sanitizeReportBuilderFilters(filters);
    const presetDescription = typeof description === 'string' ? description.trim() : '';
    const nowIso = new Date().toISOString();
    const presetId = randomUUID();

    await new Promise((resolve, reject) => {
  const db = dbService.getDb();
      db.run(
        `
          INSERT INTO report_builder_presets (
            id, name, description, columns, filters, createdBy, updatedBy, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          presetId,
          name.trim(),
          presetDescription,
          JSON.stringify(sanitizedColumns),
          JSON.stringify(sanitizedFilters),
          createdBy || null,
          createdBy || null,
          nowIso,
          nowIso,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.status(201).json({
      preset: {
        id: presetId,
        name: name.trim(),
        description: presetDescription,
        columns: sanitizedColumns,
        filters: sanitizedFilters,
        createdBy: createdBy || null,
        updatedBy: createdBy || null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    });
  } catch (error) {
    debugError('❌ Error creating report builder preset:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/admin/reporting/report-builder/presets/:id', async (req, res) => {
  const db = dbService.getDb();
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'Preset ID is required' });
    return;
  }

  try {
    const existing = await dbGetAsync(
      `SELECT * FROM report_builder_presets WHERE id = ?`,
      [id]
    );

    if (!existing) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }

    const { name, description, columns, filters, updatedBy } = req.body || {};

    const nextName =
      typeof name === 'string' && name.trim().length > 0 ? name.trim() : existing.name;
    const nextDescription =
      typeof description === 'string' ? description.trim() : existing.description || '';
    const nextColumns = columns ? sanitizeReportBuilderColumns(columns) : sanitizeReportBuilderColumns(helpers.parseJsonSafe(existing.columns, []));
    const nextFilters = filters
      ? sanitizeReportBuilderFilters(filters)
      : sanitizeReportBuilderFilters(helpers.parseJsonSafe(existing.filters, {}));
    const nowIso = new Date().toISOString();

    await new Promise((resolve, reject) => {
  const db = dbService.getDb();
      db.run(
        `
          UPDATE report_builder_presets
          SET name = ?, description = ?, columns = ?, filters = ?, updatedBy = ?, updatedAt = ?
          WHERE id = ?
        `,
        [
          nextName,
          nextDescription,
          JSON.stringify(nextColumns),
          JSON.stringify(nextFilters),
          updatedBy || existing.updatedBy || null,
          nowIso,
          id,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({
      preset: {
        id,
        name: nextName,
        description: nextDescription,
        columns: nextColumns,
        filters: nextFilters,
        createdBy: existing.createdBy || null,
        updatedBy: updatedBy || existing.updatedBy || null,
        createdAt: existing.createdAt,
        updatedAt: nowIso,
      },
    });
  } catch (error) {
    debugError('❌ Error updating report builder preset:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/api/admin/reporting/report-builder/presets/:id', async (req, res) => {
  const db = dbService.getDb();
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'Preset ID is required' });
    return;
  }

  try {
    await new Promise((resolve, reject) => {
  const db = dbService.getDb();
      db.run(
        `DELETE FROM report_builder_presets WHERE id = ?`,
        [id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.status(204).end();
  } catch (error) {
    debugError('❌ Error deleting report builder preset:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/admin/reporting/report-builder/query', async (req, res) => {
  const db = dbService.getDb();
  try {
    const { selectedColumns, filters, limit } = req.body || {};
    const result = await executeReportBuilderQuery(selectedColumns, filters, limit);
    res.json(result);
  } catch (error) {
    debugError('❌ Error executing report builder query:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/admin/reporting/schedules', async (req, res) => {
  const db = dbService.getDb();
  try {
    const rows = await dbAllAsync(
      `SELECT * FROM report_delivery_schedules ORDER BY updatedAt DESC`,
      []
    );
    const schedules = rows.map(mapScheduleRow);
    res.json({ schedules });
  } catch (error) {
    debugError('❌ Error fetching report schedules:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/admin/reporting/schedules', async (req, res) => {
  const db = dbService.getDb();
  try {
    const payload = req.body || {};
    const sanitized = sanitizeReportSchedulePayload(payload, null);
    const nowIso = new Date().toISOString();
    const scheduleId = randomUUID();

    await dbRunAsync(
      `
        INSERT INTO report_delivery_schedules (
          id, name, description, recipients, frequency, dayOfWeek, dayOfMonth,
          timeOfDay, timezone, includeCsv, includePdf, columns, filters, rowLimit,
          active, lastRunAt, nextRunAt, lastStatus, lastError, createdBy, updatedBy,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        scheduleId,
        sanitized.name,
        sanitized.description,
        JSON.stringify(sanitized.recipients),
        sanitized.frequency,
        sanitized.dayOfWeek,
        sanitized.dayOfMonth,
        sanitized.timeOfDay,
        sanitized.timezone,
        sanitized.includeCsv ? 1 : 0,
        sanitized.includePdf ? 1 : 0,
        JSON.stringify(sanitized.columns),
        JSON.stringify(sanitized.filters),
        sanitized.rowLimit,
        sanitized.active ? 1 : 0,
        null,
        sanitized.nextRunAt,
        null,
        null,
        payload.createdBy || null,
        payload.updatedBy || payload.createdBy || null,
        nowIso,
        nowIso,
      ]
    );

    const createdRow = await dbGetAsync(
      `SELECT * FROM report_delivery_schedules WHERE id = ?`,
      [scheduleId]
    );
    res.status(201).json({ schedule: mapScheduleRow(createdRow) });
  } catch (error) {
    debugError('❌ Error creating report schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/admin/reporting/schedules/:id', async (req, res) => {
  const db = dbService.getDb();
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'Schedule ID is required' });
    return;
  }

  try {
    const existingRow = await dbGetAsync(
      `SELECT * FROM report_delivery_schedules WHERE id = ?`,
      [id]
    );
    if (!existingRow) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    const existing = mapScheduleRow(existingRow);
    const sanitized = sanitizeReportSchedulePayload(req.body || {}, existing);
    const nowIso = new Date().toISOString();

    await dbRunAsync(
      `
        UPDATE report_delivery_schedules
        SET
          name = ?,
          description = ?,
          recipients = ?,
          frequency = ?,
          dayOfWeek = ?,
          dayOfMonth = ?,
          timeOfDay = ?,
          timezone = ?,
          includeCsv = ?,
          includePdf = ?,
          columns = ?,
          filters = ?,
          rowLimit = ?,
          active = ?,
          nextRunAt = ?,
          updatedBy = ?,
          updatedAt = ?
        WHERE id = ?
      `,
      [
        sanitized.name,
        sanitized.description,
        JSON.stringify(sanitized.recipients),
        sanitized.frequency,
        sanitized.dayOfWeek,
        sanitized.dayOfMonth,
        sanitized.timeOfDay,
        sanitized.timezone,
        sanitized.includeCsv ? 1 : 0,
        sanitized.includePdf ? 1 : 0,
        JSON.stringify(sanitized.columns),
        JSON.stringify(sanitized.filters),
        sanitized.rowLimit,
        sanitized.active ? 1 : 0,
        sanitized.active ? sanitized.nextRunAt : null,
        req.body?.updatedBy || existing.updatedBy || null,
        nowIso,
        id,
      ]
    );

    const updatedRow = await dbGetAsync(
      `SELECT * FROM report_delivery_schedules WHERE id = ?`,
      [id]
    );
    res.json({ schedule: mapScheduleRow(updatedRow) });
  } catch (error) {
    debugError('❌ Error updating report schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/api/admin/reporting/schedules/:id', async (req, res) => {
  const db = dbService.getDb();
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'Schedule ID is required' });
    return;
  }

  try {
    await dbRunAsync(
      `
        UPDATE report_delivery_schedules
        SET active = 0, nextRunAt = NULL, updatedAt = ?
        WHERE id = ?
      `,
      [new Date().toISOString(), id]
    );
    res.status(204).end();
  } catch (error) {
    debugError('❌ Error deleting report schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/admin/reporting/schedules/:id/trigger', async (req, res) => {
  const db = dbService.getDb();
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: 'Schedule ID is required' });
    return;
  }

  try {
    const existingRow = await dbGetAsync(
      `SELECT * FROM report_delivery_schedules WHERE id = ?`,
      [id]
    );
    if (!existingRow) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }
    const schedule = mapScheduleRow(existingRow);
    const result = await runReportSchedule(schedule, { manual: true });
    res.json({
      schedule,
      result: {
        total: result.total,
        rows: result.rows.length,
        truncated: result.truncated,
        generatedAt: result.generatedAt,
      },
    });
  } catch (error) {
    debugError('❌ Error triggering report schedule:', error);
    res.status(500).json({ error: error.message });
  }
});


// Export the router and schedule runner functions
module.exports = router;
module.exports.startReportScheduleRunner = startReportScheduleRunner;
module.exports.stopReportScheduleRunner = stopReportScheduleRunner;
