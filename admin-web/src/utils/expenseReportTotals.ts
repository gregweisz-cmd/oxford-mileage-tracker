/**
 * Expense report total calculations shared across portals.
 *
 * Staff Portal's Summary Sheet grand total is derived from per-cost-center
 * breakdowns (plus otherExpenses), not from top-level category fields alone.
 * Finance/Contracts list views must use the same logic or they can show stale
 * amounts left in reportData after source data was cleared.
 */

const SUMMARY_CATEGORY_KEYS = [
  'totalMileageAmount',
  'airRailBus',
  'vehicleRentalFuel',
  'parkingTolls',
  'groundTransportation',
  'hotelsAirbnb',
  'perDiem',
  'phoneInternetFax',
  'shippingPostage',
  'printingCopying',
  'officeSupplies',
  'eesReceipt',
] as const;

export function getCostCenterAmountFromReport(
  reportData: any,
  category: string,
  costCenterIndex: number
): number {
  const breakdown = reportData?.costCenterBreakdowns?.[category];
  if (breakdown && breakdown[costCenterIndex] !== undefined) {
    return Number(breakdown[costCenterIndex]) || 0;
  }
  // Per diem is often stored on reportData.perDiem only (not in costCenterBreakdowns).
  if (category === 'perDiem' && costCenterIndex === 0) {
    const breakdownSum = breakdown
      ? breakdown.reduce((sum: number, value: number) => sum + (Number(value) || 0), 0)
      : 0;
    if (breakdownSum <= 0 && (Number(reportData?.perDiem) || 0) > 0) {
      return Number(reportData.perDiem) || 0;
    }
  }
  return 0;
}

const PER_DIEM_MONTHLY_CAP = 350;

export function buildPerDiemBreakdownFromReceipts(
  receipts: Array<{ category?: string; amount?: number; costCenter?: string }>,
  costCenters: string[],
  monthlyCap = PER_DIEM_MONTHLY_CAP
): { total: number; byCostCenter: number[] } {
  const byCostCenter = new Array(Math.max(costCenters.length, 1)).fill(0);
  const normalizeKey = (value: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const resolveIndex = (receiptCostCenter?: string) => {
    if (!receiptCostCenter) return 0;
    const normalized = normalizeKey(receiptCostCenter);
    const direct = costCenters.findIndex((cc) => normalizeKey(cc) === normalized);
    return direct >= 0 ? direct : 0;
  };

  receipts.forEach((receipt) => {
    if (String(receipt.category || '').trim() !== 'Per Diem') return;
    const idx = resolveIndex(receipt.costCenter);
    byCostCenter[idx] += Number(receipt.amount) || 0;
  });

  const rawTotal = byCostCenter.reduce((sum, value) => sum + value, 0);
  const total = Math.min(rawTotal, monthlyCap);
  if (rawTotal > monthlyCap && rawTotal > 0) {
    const scale = monthlyCap / rawTotal;
    for (let i = 0; i < byCostCenter.length; i += 1) {
      byCostCenter[i] = Math.round(byCostCenter[i] * scale * 100) / 100;
    }
  }

  return { total, byCostCenter };
}

function getOtherExpensesForCostCenter(reportData: any, costCenterIndex: number): number {
  const entries = reportData?.otherExpenses;
  if (!Array.isArray(entries)) return 0;
  return entries.reduce((sum: number, entry: any) => {
    const idx = entry?.costCenterIndex ?? 0;
    return idx === costCenterIndex ? sum + (Number(entry.amount) || 0) : sum;
  }, 0);
}

/** Sum top-level summary category fields (legacy reports). */
export function calculateTotalExpensesFromTopLevelFields(reportData: any): number {
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

  return (
    totalMileageAmount +
    airRailBus +
    vehicleRentalFuel +
    parkingTolls +
    groundTransportation +
    hotelsAirbnb +
    perDiem +
    phoneInternetFax +
    shippingPostage +
    printingCopying +
    officeSupplies +
    eesReceipt +
    meals +
    other
  );
}

/**
 * Grand total matching Staff Portal "GRAND TOTAL REQUESTED" / Overall Subtotal.
 */
export function calculateGrandTotalFromReportData(reportData: any): number {
  if (!reportData) return 0;

  const costCenters =
    Array.isArray(reportData.costCenters) && reportData.costCenters.length > 0
      ? reportData.costCenters
      : [''];

  // Modern reports: authoritative total from per-cost-center breakdowns.
  if (reportData.costCenterBreakdowns != null) {
    return costCenters.reduce((total: number, _cc: string, ccIndex: number) => {
      const categorySubtotal = SUMMARY_CATEGORY_KEYS.reduce(
        (sum, key) => sum + getCostCenterAmountFromReport(reportData, key, ccIndex),
        0
      );
      return total + categorySubtotal + getOtherExpensesForCostCenter(reportData, ccIndex);
    }, 0);
  }

  return calculateTotalExpensesFromTopLevelFields(reportData);
}
