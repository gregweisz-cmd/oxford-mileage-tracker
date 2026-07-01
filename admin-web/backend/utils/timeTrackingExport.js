/**
 * Time-tracking helpers for PDF export — mirrors Staff Portal timesheet / cost-center logic.
 */

const { normalizeDateString } = require('./dateHelpers');

const TIMESHEET_CATEGORY_TYPES = ['G&A', 'Holiday', 'PTO', 'STD/LTD', 'PFL/PFML'];

function normalizeCostCenterForMatch(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeTimesheetCategory(category) {
  if (typeof category !== 'string') return null;
  const base = category.trim().replace(/\s+hours$/i, '').replace(/\s+/g, ' ').trim();
  if (!base) return null;
  return TIMESHEET_CATEGORY_TYPES.find((type) => type.toLowerCase() === base.toLowerCase()) ?? null;
}

function categoryToExportKey(category) {
  if (category === 'Holiday') return 'HOLIDAY';
  return category;
}

function buildTimeTrackingDedupKey(entry) {
  const dateKey = normalizeDateString(entry?.date);
  const normalizedCostCenter = normalizeCostCenterForMatch(entry?.costCenter || '');
  const normalizedCategory = String(entry?.category || '').trim().toLowerCase();
  const bucket = normalizedCostCenter || normalizedCategory || 'working hours';
  return `${dateKey}::${bucket}`;
}

function dedupeTimeTrackingEntries(entries) {
  const entryMap = new Map();
  (entries || []).forEach((entry) => {
    const key = buildTimeTrackingDedupKey(entry);
    const existing = entryMap.get(key);
    if (!existing) {
      entryMap.set(key, entry);
      return;
    }
    const existingUpdated = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
    const incomingUpdated = entry?.updatedAt ? new Date(entry.updatedAt).getTime() : 0;
    const existingCreated = existing?.createdAt ? new Date(existing.createdAt).getTime() : 0;
    const incomingCreated = entry?.createdAt ? new Date(entry.createdAt).getTime() : 0;
    const existingRank = Math.max(existingUpdated, existingCreated);
    const incomingRank = Math.max(incomingUpdated, incomingCreated);
    if (incomingRank >= existingRank) {
      entryMap.set(key, entry);
    }
  });
  return Array.from(entryMap.values());
}

function getDayFromStoredDate(dateValue) {
  const ymd = normalizeDateString(dateValue);
  if (!ymd) return null;
  const day = parseInt(ymd.split('-')[2], 10);
  return Number.isNaN(day) ? null : day;
}

/** Billable cost-center hours for one day (deduped — excludes PTO and other category hours). */
function getBillableHoursForCostCenterDay(timeEntries, dateStr, costCenter) {
  if (!dateStr || !costCenter) return 0;
  const matching = dedupeTimeTrackingEntries(timeEntries || []).filter((t) => {
    const tDate = normalizeDateString(t.date);
    if (tDate !== dateStr) return false;
    if ((t.costCenter || '') !== costCenter) return false;
    const cat = t.category || '';
    return cat === 'Working Hours' || cat === 'Regular Hours' || cat === '';
  });
  if (matching.length === 0) return 0;
  const sorted = [...matching].sort((a, b) => {
    const aT = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bT = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bT - aT;
  });
  return Number(sorted[0]?.hours) || 0;
}

function buildTimesheetDailyMaps(timeEntries, gridDaysToShow) {
  const costCenterDailyMap = {};
  const categoryDailyMap = {
    'G&A': {},
    'HOLIDAY': {},
    'PTO': {},
    'STD/LTD': {},
    'PFL/PFML': {}
  };

  dedupeTimeTrackingEntries(timeEntries || []).forEach((entry) => {
    const day = getDayFromStoredDate(entry.date);
    if (!day || day > gridDaysToShow) return;
    const hours = parseFloat(entry.hours) || 0;
    const normalizedCategory = normalizeTimesheetCategory(entry.category);
    if (normalizedCategory) {
      const key = categoryToExportKey(normalizedCategory);
      if (categoryDailyMap[key]) {
        categoryDailyMap[key][day] = hours;
      }
    } else if (entry.costCenter) {
      if (!costCenterDailyMap[entry.costCenter]) {
        costCenterDailyMap[entry.costCenter] = {};
      }
      costCenterDailyMap[entry.costCenter][day] = hours;
    } else if (
      entry.category === 'Working Hours' ||
      entry.category === 'Regular Hours' ||
      !entry.category
    ) {
      const fallbackCc = '__working_hours__';
      if (!costCenterDailyMap[fallbackCc]) {
        costCenterDailyMap[fallbackCc] = {};
      }
      costCenterDailyMap[fallbackCc][day] = hours;
    }
  });

  return { costCenterDailyMap, categoryDailyMap };
}

function mapReceiptToTravelCategory(categoryValue) {
  const category = String(categoryValue || '').toLowerCase();
  if (category.includes('air') || category.includes('rail') || category.includes('bus') || category.includes('flight')) {
    return 'airRailBus';
  }
  if (category.includes('vehicle') || category.includes('rental') || category.includes('fuel')) {
    return 'vehicleRentalFuel';
  }
  if (category.includes('parking') || category.includes('toll')) {
    return 'parkingTolls';
  }
  if (category.includes('ground') || category.includes('transportation') || category.includes('taxi') || category.includes('uber') || category.includes('lyft')) {
    return 'groundTransportation';
  }
  if (category.includes('hotel') || category.includes('lodging') || category.includes('airbnb')) {
    return 'lodging';
  }
  return null;
}

function emptyTravelExpenseTotals() {
  return {
    airRailBus: 0,
    vehicleRentalFuel: 0,
    parkingTolls: 0,
    groundTransportation: 0,
    lodging: 0,
    perDiem: 0
  };
}

function buildPerDiemByDate(dailyEntries, receipts) {
  const map = {};
  (dailyEntries || []).forEach((entry) => {
    const key = normalizeDateString(entry.date);
    if (key) map[key] = Number(entry.perDiem) || 0;
  });
  (receipts || []).forEach((receipt) => {
    if (String(receipt.category || '').trim() !== 'Per Diem') return;
    const key = normalizeDateString(receipt.date);
    if (key) map[key] = Number(receipt.amount) || 0;
  });
  return map;
}

module.exports = {
  dedupeTimeTrackingEntries,
  getBillableHoursForCostCenterDay,
  buildTimesheetDailyMaps,
  mapReceiptToTravelCategory,
  emptyTravelExpenseTotals,
  buildPerDiemByDate,
  normalizeDateString,
  normalizeCostCenterForMatch,
  getDayFromStoredDate
};
