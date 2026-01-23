export type SummaryUnit = 'usd' | 'mi' | 'hrs' | 'people' | string;

export interface SummaryCard {
  id: string;
  label: string;
  value: number;
  unit: SummaryUnit;
  meta?: Record<string, number | string>;
}

export interface FunnelStage {
  id: string;
  label: string;
  description: string;
  count: number;
}

export interface TopCostCenterSpendEntry {
  costCenter: string;
  totalAmount: number;
  receiptCount: number;
}

export interface TopCostCenterMilesEntry {
  costCenter: string;
  totalMiles: number;
  entryCount: number;
}

export interface TopCostCenters {
  bySpend: TopCostCenterSpendEntry[];
  byMiles: TopCostCenterMilesEntry[];
}

export interface AttentionRecord {
  reportId: string;
  employeeId: string;
  employeeName: string;
  status: string;
  currentStage: string | null;
  currentApprover: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
  month: number;
  year: number;
  defaultCostCenter: string;
  agingDays: number | null;
}

export interface AttentionSummary {
  thresholdDays: number;
  total: number;
  records: AttentionRecord[];
}

export interface OverBudgetItem {
  costCenter: string;
  actual: number;
  baseline: number;
  variance: number;
  variancePct: number | null;
}

export interface MissingReceiptItem {
  reportId: string;
  employeeId: string;
  employeeName: string;
  status?: string;
  month: number;
  year: number;
  totalExpenses: number;
}

export interface AttentionCategories {
  overBudget: OverBudgetItem[];
  overdueApprovals: AttentionRecord[];
  missingReceipts: MissingReceiptItem[];
}

export interface ReportsAnalyticsOverview {
  range: {
    start: string;
    end: string;
  };
  filters: {
    costCenters: string[];
  };
  summaryCards: SummaryCard[];
  submissionFunnel: FunnelStage[];
  topCostCenters: TopCostCenters;
  attention: AttentionSummary & { categories?: AttentionCategories };
  metadata?: {
    availableCostCenters?: string[];
    baselineRange?: { start: string; end: string };
  };
  generatedAt: string;
}

export interface ReportsAnalyticsFilters {
  startDate: string;
  endDate: string;
  costCenters?: string[];
  thresholdDays?: number;
}

export interface MonthlyTotalsEntry {
  monthKey: string;
  label: string;
  totalExpenses: number;
  totalMileageAmount: number;
  totalMiles: number;
  reportCount: number;
}

export interface MonthlyStatusEntry {
  monthKey: string;
  label: string;
  statuses: Record<string, number>;
}

export interface MonthlyReceiptsEntry {
  monthKey: string;
  totalAmount: number;
  receiptCount: number;
}

export interface MonthlyMileageEntry {
  monthKey: string;
  totalMiles: number;
  entryCount: number;
}

export interface CostCenterVarianceItem {
  costCenter: string;
  actual: number;
  baseline: number;
  variance: number;
  variancePct: number | null;
  receiptCount?: number;
}

export interface ReportingTrends {
  range: {
    start: string;
    end: string;
  };
  months: {
    year: number;
    month: number;
    key: string;
    label: string;
  }[];
  monthlyTotals: MonthlyTotalsEntry[];
  monthlyStatus: MonthlyStatusEntry[];
  receipts: MonthlyReceiptsEntry[];
  mileageEntries: MonthlyMileageEntry[];
  costCenterVariance: {
    baselineRange: { start: string; end: string };
    items: CostCenterVarianceItem[];
  };
  forecast: {
    nextMonthKey: string;
    nextMonthLabel: string;
    expectedSpend: number;
    averageSpend: number;
  };
  generatedAt: string;
}

const baseUrl = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/admin/reporting`
  : 'https://oxford-mileage-backend.onrender.com/api/admin/reporting';

export async function fetchReportsAnalyticsOverview(
  filters: ReportsAnalyticsFilters
): Promise<ReportsAnalyticsOverview> {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.costCenters && filters.costCenters.length > 0) {
    params.append('costCenters', filters.costCenters.join(','));
  }
  if (filters.thresholdDays && Number.isFinite(filters.thresholdDays)) {
    params.append('thresholdDays', String(filters.thresholdDays));
  }

  const response = await fetch(`${baseUrl}/overview?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch reporting overview (${response.status})`);
  }

  return response.json();
}

export async function fetchReportsAnalyticsTrends(
  filters: ReportsAnalyticsFilters & { months?: number }
): Promise<ReportingTrends> {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.costCenters && filters.costCenters.length > 0) {
    params.append('costCenters', filters.costCenters.join(','));
  }
  if (filters.months && Number.isFinite(filters.months)) {
    params.append('months', String(filters.months));
  }

  const response = await fetch(`${baseUrl}/trends?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch reporting trends (${response.status})`);
  }

  return response.json();
}

export interface ReportingMapSegment {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  miles: number;
  count: number;
  costCenters: string[];
  sampleDate: string | null;
}

export interface ReportingMapCluster {
  lat: number;
  lng: number;
  miles: number;
  count: number;
}

export interface ReportingMapData {
  range: {
    start: string;
    end: string;
  };
  filters: {
    costCenters: string[];
  };
  totals: {
    totalMiles: number;
    totalSegments: number;
    maxSegmentMiles: number;
    maxSegmentCount: number;
  };
  segments: ReportingMapSegment[];
  clusters: {
    start: ReportingMapCluster[];
    end: ReportingMapCluster[];
  };
  generatedAt: string;
}

export async function fetchReportsAnalyticsMap(
  filters: ReportsAnalyticsFilters & { months?: number }
): Promise<ReportingMapData> {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.costCenters && filters.costCenters.length > 0) {
    params.append('costCenters', filters.costCenters.join(','));
  }
  if (filters.months && Number.isFinite(filters.months)) {
    params.append('months', String(filters.months));
  }

  const response = await fetch(`${baseUrl}/map-data?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch reporting map data (${response.status})`);
  }

  return response.json();
}

export type ReportBuilderFieldType = 'string' | 'number' | 'currency' | 'date';

export interface ReportBuilderField {
  id: string;
  label: string;
  description: string;
  type: ReportBuilderFieldType;
  category: string;
}

export interface ReportBuilderFilters {
  startDate?: string;
  endDate?: string;
  statuses?: string[];
  costCenters?: string[];
  employeeIds?: string[];
  search?: string;
  minTotalExpenses?: number;
  maxTotalExpenses?: number;
}

export interface ReportBuilderPreset {
  id: string;
  name: string;
  description: string;
  columns: string[];
  filters: ReportBuilderFilters;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportBuilderPresetInput {
  name: string;
  description?: string;
  columns: string[];
  filters: ReportBuilderFilters;
}

export interface ReportBuilderRow {
  id: string;
  reportId: string;
  employeeId: string;
  employeeName: string;
  defaultCostCenter: string;
  periodLabel: string;
  status: string;
  totalExpenses: number;
  totalMileageAmount: number;
  perDiem: number;
  receiptSpend: number;
  totalMiles: number;
  totalHours: number;
  mileageEntryCount: number;
  receiptCount: number;
  submittedAt: string | null;
  approvedAt: string | null;
  updatedAt: string | null;
  escalationDueAt: string | null;
  approvalStage: string;
  currentApprover: string;
  agingDays: number | null;
  cycleTimeDays: number | null;
  openDays: number | null;
  [key: string]: unknown;
}

export interface ReportBuilderQueryRequest {
  selectedColumns?: string[];
  filters?: ReportBuilderFilters;
  limit?: number;
}

export interface ReportBuilderQueryResponse {
  rows: ReportBuilderRow[];
  total: number;
  truncated: boolean;
  selectedColumns: string[];
  appliedFilters: ReportBuilderFilters;
  generatedAt: string;
  limit: number;
}

export interface ReportBuilderMetadataResponse {
  fields: ReportBuilderField[];
  defaultColumns: string[];
  statusOptions: string[];
  limits: { maxRows: number };
}

export type ReportScheduleFrequency = 'daily' | 'weekly' | 'monthly';

export interface ReportSchedule {
  id: string;
  name: string;
  description: string;
  recipients: string[];
  frequency: ReportScheduleFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  timezone: string;
  includeCsv: boolean;
  includePdf: boolean;
  columns: string[];
  filters: ReportBuilderFilters;
  rowLimit: number;
  active: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSchedulePayload {
  name: string;
  description?: string;
  recipients: string[];
  frequency: ReportScheduleFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  timeOfDay?: string;
  timezone?: string;
  includeCsv?: boolean;
  includePdf?: boolean;
  columns?: string[];
  filters?: ReportBuilderFilters;
  rowLimit?: number;
  active?: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
  nextRunAt?: string | null;
}

export async function fetchReportBuilderFields(): Promise<ReportBuilderMetadataResponse> {
  const response = await fetch(`${baseUrl}/report-builder/fields`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch report builder fields (${response.status})`);
  }

  return response.json();
}

export async function fetchReportBuilderPresets(): Promise<ReportBuilderPreset[]> {
  const response = await fetch(`${baseUrl}/report-builder/presets`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch report builder presets (${response.status})`);
  }

  const payload = await response.json();
  return payload.presets ?? [];
}

export async function createReportBuilderPreset(
  input: ReportBuilderPresetInput & { createdBy?: string | null }
): Promise<ReportBuilderPreset> {
  const response = await fetch(`${baseUrl}/report-builder/presets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to create report builder preset (${response.status})`);
  }

  const payload = await response.json();
  return payload.preset;
}

export async function updateReportBuilderPreset(
  id: string,
  input: Partial<ReportBuilderPresetInput> & { updatedBy?: string | null }
): Promise<ReportBuilderPreset> {
  const response = await fetch(`${baseUrl}/report-builder/presets/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to update report builder preset (${response.status})`);
  }

  const payload = await response.json();
  return payload.preset;
}

export async function deleteReportBuilderPreset(id: string): Promise<void> {
  const response = await fetch(`${baseUrl}/report-builder/presets/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete report builder preset (${response.status})`);
  }
}

export async function queryReportBuilderData(
  request: ReportBuilderQueryRequest
): Promise<ReportBuilderQueryResponse> {
  const response = await fetch(`${baseUrl}/report-builder/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to run report builder query (${response.status})`);
  }

  return response.json();
}

export async function fetchReportSchedules(): Promise<ReportSchedule[]> {
  const response = await fetch(`${baseUrl}/schedules`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch report schedules (${response.status})`);
  }

  const payload = await response.json();
  return payload.schedules ?? [];
}

export async function createReportSchedule(
  payload: ReportSchedulePayload
): Promise<ReportSchedule> {
  const response = await fetch(`${baseUrl}/schedules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create report schedule (${response.status})`);
  }

  const data = await response.json();
  return data.schedule;
}

export async function updateReportSchedule(
  id: string,
  payload: Partial<ReportSchedulePayload>
): Promise<ReportSchedule> {
  const response = await fetch(`${baseUrl}/schedules/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to update report schedule (${response.status})`);
  }

  const data = await response.json();
  return data.schedule;
}

export async function deleteReportSchedule(id: string): Promise<void> {
  const response = await fetch(`${baseUrl}/schedules/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete report schedule (${response.status})`);
  }
}

export interface ReportScheduleTriggerResult {
  schedule: ReportSchedule;
  result: {
    total: number;
    rows: number;
    truncated: boolean;
    generatedAt: string;
  };
}

export async function triggerReportSchedule(id: string): Promise<ReportScheduleTriggerResult> {
  const response = await fetch(`${baseUrl}/schedules/${id}/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to trigger report schedule (${response.status})`);
  }

  return response.json();
}

function formatBuilderCellValue(value: unknown, field?: ReportBuilderField): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (!field) {
    return String(value);
  }

  switch (field.type) {
    case 'currency': {
      const num = Number(value);
      return Number.isFinite(num) ? num.toFixed(2) : String(value);
    }
    case 'number': {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        return String(value);
      }
      return num % 1 === 0 ? num.toString() : num.toFixed(2);
    }
    case 'date': {
      if (typeof value === 'string' && value.length === 0) {
        return '';
      }
      const date = new Date(value as string);
      if (Number.isNaN(date.getTime())) {
        return String(value);
      }
      return date.toISOString();
    }
    default:
      return String(value);
  }
}

export function exportReportBuilderToCsv(
  rows: ReportBuilderRow[],
  columnIds: string[],
  fields: ReportBuilderField[]
): string {
  if (!Array.isArray(rows) || rows.length === 0 || columnIds.length === 0) {
    return '';
  }

  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const headers = columnIds.map((columnId) => fieldMap.get(columnId)?.label ?? columnId);

  const lines: string[] = [];
  lines.push(headers.map((header) => `"${String(header).replace(/"/g, '""')}"`).join(','));

  rows.forEach((row) => {
    const values = columnIds.map((columnId) => {
      const fieldMeta = fieldMap.get(columnId);
      const formatted = formatBuilderCellValue(row[columnId], fieldMeta);
      return `"${formatted.replace(/"/g, '""')}"`;
    });
    lines.push(values.join(','));
  });

  return lines.join('\n');
}

export function exportReportsAnalyticsToCsv(data: ReportsAnalyticsOverview): string {
  const lines: string[][] = [];
  const addEmpty = () => lines.push([]);

  lines.push(['Reports & Analytics Summary']);
  lines.push(['Date Range', `${data.range.start} to ${data.range.end}`]);
  lines.push(['Generated At', data.generatedAt]);
  if (data.metadata?.baselineRange) {
    lines.push([
      'Baseline Range',
      `${data.metadata.baselineRange.start} to ${data.metadata.baselineRange.end}`,
    ]);
  }
  addEmpty();

  lines.push(['Summary Cards']);
  lines.push(['Metric', 'Value', 'Unit', 'Metadata']);
  data.summaryCards.forEach((card) => {
    const meta = card.meta
      ? Object.entries(card.meta)
          .map(([key, value]) => `${key}: ${value}`)
          .join('; ')
      : '';
    lines.push([card.label, String(card.value), card.unit, meta]);
  });
  addEmpty();

  lines.push(['Submission Funnel']);
  lines.push(['Stage', 'Description', 'Count']);
  data.submissionFunnel.forEach((stage) => {
    lines.push([stage.label, stage.description, String(stage.count)]);
  });
  addEmpty();

  lines.push(['Top Cost Centers - Spend']);
  lines.push(['Cost Center', 'Total Amount (USD)', 'Receipts']);
  data.topCostCenters.bySpend.forEach((entry) => {
    lines.push([entry.costCenter, entry.totalAmount.toFixed(2), String(entry.receiptCount)]);
  });
  addEmpty();

  lines.push(['Top Cost Centers - Miles']);
  lines.push(['Cost Center', 'Total Miles', 'Entries']);
  data.topCostCenters.byMiles.forEach((entry) => {
    lines.push([entry.costCenter, entry.totalMiles.toFixed(1), String(entry.entryCount)]);
  });
  addEmpty();

  lines.push(['Reports Needing Attention']);
  lines.push([
    'Employee',
    'Report ID',
    'Status',
    'Stage',
    'Approver',
    'Submitted At',
    'Updated At',
    'Aging (days)',
    'Default Cost Center',
  ]);
  data.attention.records.forEach((record) => {
    lines.push([
      record.employeeName,
      record.reportId,
      record.status,
      record.currentStage || '',
      record.currentApprover || '',
      record.submittedAt || '',
      record.updatedAt || '',
      record.agingDays != null ? String(record.agingDays) : '',
      record.defaultCostCenter,
    ]);
  });

  if (data.attention.categories) {
    addEmpty();
    lines.push(['Exception Categories']);

    if (data.attention.categories.overdueApprovals.length > 0) {
      lines.push(['Overdue Approvals']);
      lines.push(['Employee', 'Report ID', 'Status', 'Submitted', 'Aging (days)']);
      data.attention.categories.overdueApprovals.forEach((item) => {
        lines.push([
          item.employeeName,
          item.reportId,
          item.status,
          item.submittedAt || '',
          item.agingDays != null ? String(item.agingDays) : '',
        ]);
      });
      addEmpty();
    }

    if (data.attention.categories.missingReceipts.length > 0) {
      lines.push(['Missing Receipts']);
      lines.push(['Employee', 'Report ID', 'Period', 'Status', 'Total Expenses']);
      data.attention.categories.missingReceipts.forEach((item) => {
        const period = `${item.month.toString().padStart(2, '0')}/${item.year}`;
        lines.push([
          item.employeeName,
          item.reportId,
          period,
          item.status || '',
          item.totalExpenses.toFixed(2),
        ]);
      });
      addEmpty();
    }

    if (data.attention.categories.overBudget.length > 0) {
      lines.push(['Over-Budget Cost Centers']);
      lines.push(['Cost Center', 'Actual', 'Baseline', 'Variance', 'Variance %']);
      data.attention.categories.overBudget.forEach((item) => {
        lines.push([
          item.costCenter,
          item.actual.toFixed(2),
          item.baseline.toFixed(2),
          item.variance.toFixed(2),
          item.variancePct != null ? `${item.variancePct.toFixed(1)}%` : 'N/A',
        ]);
      });
      addEmpty();
    }
  }

  return lines.map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}


