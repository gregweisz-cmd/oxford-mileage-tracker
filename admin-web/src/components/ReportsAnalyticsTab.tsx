import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Replay as ResetIcon,
} from '@mui/icons-material';
import { CostCenterApiService, CostCenter } from '../services/costCenterApiService';
import {
  AttentionRecord,
  ReportsAnalyticsOverview,
  ReportingTrends,
  ReportingMapData,
  ReportingMapSegment,
  ReportingMapCluster,
  fetchReportsAnalyticsOverview,
  fetchReportsAnalyticsTrends,
  fetchReportsAnalyticsMap,
  exportReportsAnalyticsToCsv,
} from '../services/reportingAnalyticsService';
import ReportBuilderPanel from './ReportBuilderPanel';

const formatNumber = (value: number, fractionDigits = 0) =>
  Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits }) : '0';

const formatCurrency = (value: number) =>
  Number.isFinite(value) ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';

const formatUnitValue = (value: number, unit: string) => {
  switch (unit) {
    case 'usd':
      return formatCurrency(value);
    case 'mi':
      return `${formatNumber(value, 1)} mi`;
    case 'hrs':
      return `${formatNumber(value, 1)} hrs`;
    case 'people':
      return formatNumber(value);
    default:
      return `${formatNumber(value, 1)} ${unit}`;
  }
};

const formatMonthYear = (month: number, year: number) =>
  new Date(year, month - 1, 1).toLocaleString('default', { month: 'short', year: 'numeric' });

const Sparkline: React.FC<{ values: number[]; color?: string; height?: number }> = ({
  values,
  color = '#1976d2',
  height = 60,
}) => {
  if (!values.length) {
    return null;
  }

  const width = 160;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const coordinates = values.map((value, index) => {
    const x =
      values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });

  const points = coordinates.map((coord) => `${coord.x},${coord.y}`).join(' ');

  return (
    <Box component="svg" viewBox={`0 0 ${width} ${height}`} sx={{ width: '100%', height }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {coordinates.map((coord, index) => (
        <circle key={index} cx={coord.x} cy={coord.y} r={3} fill={color} />
      ))}
    </Box>
  );
};

const defaultThresholdDays = 5;

const getDefaultDateRange = () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const toInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    start: toInputValue(startOfMonth),
    end: toInputValue(today),
  };
};

const funnelStageColors: Record<string, string> = {
  draft: '#9e9e9e',
  submitted: '#1976d2',
  pending_supervisor: '#ff9800',
  pending_finance: '#8e24aa',
  under_review: '#6d4c41',
  needs_revision: '#f44336',
  approved: '#2e7d32',
  rejected: '#b71c1c',
};

const usaBounds = {
  minLat: 24,
  maxLat: 50,
  minLng: -125,
  maxLng: -66,
};

export const ReportsAnalyticsTab: React.FC = () => {
  const defaultRange = useMemo(getDefaultDateRange, []);
  const [startDate, setStartDate] = useState<string>(defaultRange.start);
  const [endDate, setEndDate] = useState<string>(defaultRange.end);
  const [thresholdDays, setThresholdDays] = useState<number>(defaultThresholdDays);
  const [selectedCostCenters, setSelectedCostCenters] = useState<string[]>([]);

  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [overview, setOverview] = useState<ReportsAnalyticsOverview | null>(null);
  const [trends, setTrends] = useState<ReportingTrends | null>(null);
  const [mapData, setMapData] = useState<ReportingMapData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [trendsLoading, setTrendsLoading] = useState<boolean>(false);
  const [mapLoading, setMapLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  const loadCostCenters = useCallback(async () => {
    try {
      const data = await CostCenterApiService.getAllCostCenters();
      setCostCenters(data);
    } catch (err) {
      console.error('Failed to load cost centers', err);
      // Continue silently; the user can still type cost centers manually if needed
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReportsAnalyticsOverview({
        startDate,
        endDate,
        costCenters: selectedCostCenters,
        thresholdDays,
      });
      setOverview(data);
    } catch (err) {
      console.error('Failed to fetch reporting overview', err);
      setError(err instanceof Error ? err.message : 'Failed to load reporting data');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedCostCenters, thresholdDays]);

  const fetchTrends = useCallback(async () => {
    setTrendsLoading(true);
    setTrendsError(null);
    try {
      const data = await fetchReportsAnalyticsTrends({
        startDate,
        endDate,
        costCenters: selectedCostCenters,
      });
      setTrends(data);
    } catch (err) {
      console.error('Failed to fetch reporting trends', err);
      setTrendsError(err instanceof Error ? err.message : 'Failed to load trend data');
    } finally {
      setTrendsLoading(false);
    }
  }, [startDate, endDate, selectedCostCenters]);

  const fetchMapData = useCallback(async () => {
    setMapLoading(true);
    setMapError(null);
    try {
      const data = await fetchReportsAnalyticsMap({
        startDate,
        endDate,
        costCenters: selectedCostCenters,
      });
      setMapData(data);
    } catch (err) {
      console.error('Failed to fetch reporting map data', err);
      setMapError(err instanceof Error ? err.message : 'Failed to load map data');
    } finally {
      setMapLoading(false);
    }
  }, [startDate, endDate, selectedCostCenters]);

  useEffect(() => {
    loadCostCenters();
  }, [loadCostCenters]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  const handleResetFilters = () => {
    setSelectedCostCenters([]);
    setThresholdDays(defaultThresholdDays);
    setStartDate(defaultRange.start);
    setEndDate(defaultRange.end);
  };

  const handleExportCsv = async () => {
    if (!overview) return;
    try {
      setExporting(true);
      const csvContent = exportReportsAnalyticsToCsv(overview);
      const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reports-analytics-${overview.range.start}-to-${overview.range.end}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV', err);
      setError('Failed to export CSV. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const costCenterOptions = useMemo(() => {
    const options = costCenters
      .map((cc) => cc.code || cc.name)
      .filter((value, index, array) => value && array.indexOf(value) === index)
      .sort((a, b) => a.localeCompare(b));
    if (!options.includes('Unassigned')) {
      options.unshift('Unassigned');
    }
    return options;
  }, [costCenters]);

  const maxFunnelCount = overview
    ? Math.max(...overview.submissionFunnel.map((stage) => stage.count), 1)
    : 1;

  const renderAttentionStage = (stage: AttentionRecord) => {
    const statusLabel = stage.status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    const agingDisplay = stage.agingDays != null ? `${stage.agingDays} day${stage.agingDays === 1 ? '' : 's'}` : 'N/A';

    return (
      <TableRow key={stage.reportId} hover>
        <TableCell>
          <Stack direction="column">
            <Typography variant="body1" fontWeight={600}>
              {stage.employeeName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stage.defaultCostCenter || 'Unassigned'}
            </Typography>
          </Stack>
        </TableCell>
        <TableCell>{stage.reportId}</TableCell>
        <TableCell>{statusLabel}</TableCell>
        <TableCell>{stage.currentStage ? stage.currentStage.replace(/_/g, ' ') : '—'}</TableCell>
        <TableCell>{stage.currentApprover || '—'}</TableCell>
        <TableCell>{stage.submittedAt ? new Date(stage.submittedAt).toLocaleDateString() : '—'}</TableCell>
        <TableCell>{stage.updatedAt ? new Date(stage.updatedAt).toLocaleDateString() : '—'}</TableCell>
        <TableCell>{agingDisplay}</TableCell>
      </TableRow>
    );
  };

  const expenseSeries = useMemo(
    () => (trends ? trends.monthlyTotals.map((entry) => entry.totalExpenses) : []),
    [trends]
  );

  const trendLabels = useMemo(
    () => (trends ? trends.monthlyTotals.map((entry) => entry.label) : []),
    [trends]
  );

  const attentionCategories = overview?.attention.categories;
  const mapSegments = mapData?.segments ?? [];
  const mapClusters = mapData?.clusters ?? { start: [], end: [] };
  const mapTotals = mapData?.totals;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flex={1}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Attention Threshold (days)"
              type="number"
              inputProps={{ min: 1, max: 60 }}
              value={thresholdDays}
              onChange={(event) => setThresholdDays(Math.max(1, Number(event.target.value) || defaultThresholdDays))}
              fullWidth
            />
          </Stack>
          <Autocomplete
            multiple
            options={costCenterOptions}
            value={selectedCostCenters}
            onChange={(_, value) => setSelectedCostCenters(value)}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip variant="outlined" label={option} {...getTagProps({ index })} key={option} />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Cost Centers"
                placeholder="Select cost centers"
              />
            )}
            sx={{ minWidth: { xs: '100%', md: 320 } }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                fetchOverview();
                fetchTrends();
                fetchMapData();
              }}
              startIcon={<RefreshIcon />}
              disabled={loading || trendsLoading || mapLoading}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              onClick={handleResetFilters}
              startIcon={<ResetIcon />}
              disabled={loading}
            >
              Reset
            </Button>
            <Tooltip title="Download CSV export of the current view">
              <span>
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={exporting ? <CircularProgress size={20} /> : <DownloadIcon />}
                  onClick={handleExportCsv}
                  disabled={!overview || exporting}
                >
                  Export CSV
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {trendsError && <Alert severity="warning">{trendsError}</Alert>}
      {mapError && <Alert severity="warning">{mapError}</Alert>}

      {loading && (
        <Paper elevation={0} sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
          <Stack alignItems="center" spacing={1}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading reporting overview…
            </Typography>
          </Stack>
        </Paper>
      )}

      {!loading && overview && (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)',
              },
            }}
          >
            {overview.summaryCards.map((card) => (
              <Paper
                key={card.id}
                elevation={0}
                sx={{ p: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}
              >
                <Typography variant="caption" color="text.secondary" textTransform="uppercase">
                  {card.label}
                </Typography>
                <Typography variant="h5" sx={{ mt: 1, fontWeight: 700 }}>
                  {formatUnitValue(card.value, card.unit)}
                </Typography>
                {card.meta && (
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    {Object.entries(card.meta).map(([key, value]) => (
                      <Typography key={key} variant="caption" color="text.secondary">
                        {`${key}: ${value}`}
                      </Typography>
                    ))}
                  </Stack>
                )}
              </Paper>
            ))}
          </Box>

          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6">Mileage Activity Map</Typography>
                <Typography variant="body2" color="text.secondary">
                  Aggregated GPS-tracked mileage routes and hotspots
                </Typography>
              </Box>
              {mapLoading && <CircularProgress size={20} />}
            </Stack>
            {mapLoading ? null : mapData && mapSegments.length > 0 ? (
              <Stack spacing={2}>
                <MileageRoutesMap segments={mapSegments} clusters={mapClusters} totals={mapTotals} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    Segments: {mapTotals?.totalSegments ?? mapSegments.length} • Miles tracked: {mapTotals ? formatNumber(mapTotals.totalMiles, 1) : formatNumber(mapSegments.reduce((sum, seg) => sum + seg.miles, 0), 1)}
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'rgba(33,150,243,0.8)' }} />
                      <Typography variant="caption" color="text.secondary">Route start clusters</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'rgba(244,67,54,0.7)' }} />
                      <Typography variant="caption" color="text.secondary">Route end clusters</Typography>
                    </Stack>
                  </Stack>
                </Stack>
              </Stack>
            ) : (
              <Alert severity="info">No GPS-tracked mileage data found for the selected range.</Alert>
            )}
          </Paper>

          <ReportBuilderPanel costCenterOptions={costCenterOptions} defaultDateRange={defaultRange} />

          {(trendsLoading || (trends && trends.monthlyTotals.length > 0)) && (
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
              }}
            >
              <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h6">Expense Trend</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Multi-month view of submitted and approved expenses
                    </Typography>
                  </Box>
                  {trendsLoading && <CircularProgress size={20} />}
                </Stack>
                {trends && expenseSeries.length > 0 ? (
                  <Stack spacing={2}>
                    <Sparkline values={expenseSeries} color="#1976d2" />
                    <Typography variant="body2" color="text.secondary">
                      {trendLabels.map((label, index) => {
                        const amount = expenseSeries[index];
                        return `${label}: ${formatCurrency(amount)}`;
                      }).join(' • ')}
                    </Typography>
                  </Stack>
                ) : !trendsLoading ? (
                  <Alert severity="info">No trend data available for the selected filters.</Alert>
                ) : null}
              </Paper>
              <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Forecast & Benchmarks
                </Typography>
                {trends ? (
                  <Stack spacing={1}>
                    <Typography variant="body2">
                      <strong>Next Month Projection:</strong> {formatCurrency(trends.forecast.expectedSpend)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Based on the trailing average spend of {formatCurrency(trends.forecast.averageSpend)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Forecasting {trends.forecast.nextMonthLabel}
                    </Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Forecast will appear once trend data is available.
                  </Typography>
                )}
              </Paper>
            </Box>
          )}

          {trends && trends.costCenterVariance.items.length > 0 && (
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" gutterBottom>
                Cost Center Variance
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Comparison against baseline period ({trends.costCenterVariance.baselineRange.start} → {trends.costCenterVariance.baselineRange.end})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Cost Center</TableCell>
                      <TableCell align="right">Actual</TableCell>
                      <TableCell align="right">Baseline</TableCell>
                      <TableCell align="right">Variance</TableCell>
                      <TableCell align="right">Variance %</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {trends.costCenterVariance.items.slice(0, 8).map((item) => (
                      <TableRow key={item.costCenter} hover>
                        <TableCell>{item.costCenter}</TableCell>
                        <TableCell align="right">{formatCurrency(item.actual)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.baseline)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.variance)}</TableCell>
                        <TableCell align="right">
                          {item.variancePct != null ? `${item.variancePct.toFixed(1)}%` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            }}
          >
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Submission Funnel
              </Typography>
              <Stack spacing={2}>
                {overview.submissionFunnel.map((stage) => {
                  const percentage = Math.round((stage.count / maxFunnelCount) * 100);
                  return (
                    <Box key={stage.id}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2">{stage.label}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {stage.count}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={percentage}
                        sx={{
                          mt: 1,
                          height: 10,
                          borderRadius: 999,
                          backgroundColor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: funnelStageColors[stage.id] || 'primary.main',
                          },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {stage.description}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            </Paper>
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Reports Needing Attention
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Showing top {overview.attention.records.length} of {overview.attention.total} reports pending for{' '}
                {overview.attention.thresholdDays} days or more.
              </Typography>
              {overview.attention.records.length === 0 ? (
                <Alert severity="success">No reports are currently exceeding the attention threshold.</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Employee</TableCell>
                        <TableCell>Report ID</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Stage</TableCell>
                        <TableCell>Approver</TableCell>
                        <TableCell>Submitted</TableCell>
                        <TableCell>Updated</TableCell>
                        <TableCell align="right">Aging</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>{overview.attention.records.map(renderAttentionStage)}</TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Box>

          {attentionCategories && (
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              }}
            >
              <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" gutterBottom>
                  Overdue Approvals
                </Typography>
                {attentionCategories.overdueApprovals.length === 0 ? (
                  <Alert severity="success">No approvals are currently overdue.</Alert>
                ) : (
                  <Stack spacing={1}>
                    {attentionCategories.overdueApprovals.map((item) => (
                      <Box key={item.reportId} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {item.employeeName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatMonthYear(item.month, item.year)} • {item.status.replace(/_/g, ' ')} •{' '}
                          {item.agingDays != null ? `${item.agingDays} days` : 'N/A'}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Paper>
              <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" gutterBottom>
                  Missing Receipts
                </Typography>
                {attentionCategories.missingReceipts.length === 0 ? (
                  <Alert severity="success">Every report has receipts attached.</Alert>
                ) : (
                  <Stack spacing={1}>
                    {attentionCategories.missingReceipts.map((item) => (
                      <Box key={item.reportId} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {item.employeeName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatMonthYear(item.month, item.year)} • {item.status || 'pending'} • Missing receipts on ${item.totalExpenses.toFixed(2)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Paper>
              <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" gutterBottom>
                  Over-Budget Cost Centers
                </Typography>
                {attentionCategories.overBudget.length === 0 ? (
                  <Alert severity="success">No cost centers exceeded their baseline.</Alert>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Cost Center</TableCell>
                          <TableCell align="right">Actual</TableCell>
                          <TableCell align="right">Baseline</TableCell>
                          <TableCell align="right">Variance %</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {attentionCategories.overBudget.map((item) => (
                          <TableRow key={item.costCenter} hover>
                            <TableCell>{item.costCenter}</TableCell>
                            <TableCell align="right">{formatCurrency(item.actual)}</TableCell>
                            <TableCell align="right">{formatCurrency(item.baseline)}</TableCell>
                            <TableCell align="right">
                              {item.variancePct != null ? `${item.variancePct.toFixed(1)}%` : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            </Box>
          )}

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            }}
          >
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Top Cost Centers by Spend
              </Typography>
              {overview.topCostCenters.bySpend.length === 0 ? (
                <Alert severity="info">No receipt activity for the selected range.</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Cost Center</TableCell>
                        <TableCell align="right">Total Spend</TableCell>
                        <TableCell align="right">Receipts</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {overview.topCostCenters.bySpend.map((row) => (
                        <TableRow key={row.costCenter} hover>
                          <TableCell>{row.costCenter}</TableCell>
                          <TableCell align="right">{formatCurrency(row.totalAmount)}</TableCell>
                          <TableCell align="right">{row.receiptCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Top Cost Centers by Miles
              </Typography>
              {overview.topCostCenters.byMiles.length === 0 ? (
                <Alert severity="info">No mileage activity for the selected range.</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Cost Center</TableCell>
                        <TableCell align="right">Miles</TableCell>
                        <TableCell align="right">Entries</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {overview.topCostCenters.byMiles.map((row) => (
                        <TableRow key={row.costCenter} hover>
                          <TableCell>{row.costCenter}</TableCell>
                          <TableCell align="right">{formatNumber(row.totalMiles, 1)}</TableCell>
                          <TableCell align="right">{row.entryCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Box>

          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="h6">Filters Applied</Typography>
                <Typography variant="body2" color="text.secondary">
                  {overview.filters.costCenters.length > 0
                    ? `Cost Centers: ${overview.filters.costCenters.join(', ')}`
                    : 'Cost Centers: All'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Date Range: {overview.range.start} → {overview.range.end}
                </Typography>
              </Box>
              <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Generated at {new Date(overview.generatedAt).toLocaleString()}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </>
      )}
    </Box>
  );
};

interface MileageRoutesMapProps {
  segments: ReportingMapSegment[];
  clusters: {
    start: ReportingMapCluster[];
    end: ReportingMapCluster[];
  };
  totals?: ReportingMapData['totals'];
}

const MileageRoutesMap: React.FC<MileageRoutesMapProps> = ({ segments, clusters, totals }) => {
  const width = 720;
  const height = 360;

  const project = (lat: number, lng: number) => {
    const clampedLat = Math.max(usaBounds.minLat, Math.min(usaBounds.maxLat, lat));
    const clampedLng = Math.max(usaBounds.minLng, Math.min(usaBounds.maxLng, lng));
    const x =
      ((clampedLng - usaBounds.minLng) / (usaBounds.maxLng - usaBounds.minLng)) * width;
    const y =
      height -
      ((clampedLat - usaBounds.minLat) / (usaBounds.maxLat - usaBounds.minLat)) * height;
    return { x, y };
  };

  const maxMiles =
    totals?.maxSegmentMiles ||
    (segments.length > 0 ? Math.max(...segments.map((segment) => segment.miles)) : 1);
  const maxCount =
    totals?.maxSegmentCount ||
    (segments.length > 0 ? Math.max(...segments.map((segment) => segment.count)) : 1);

  const clusterCounts = [...clusters.start, ...clusters.end];
  const maxClusterCount =
    clusterCounts.length > 0 ? Math.max(...clusterCounts.map((cluster) => cluster.count)) : 1;

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${width} ${height}`}
      sx={{ width: '100%', height, background: 'linear-gradient(180deg, #eef2f7 0%, #ffffff 100%)', borderRadius: 2 }}
    >
      <rect x={0} y={0} width={width} height={height} fill="transparent" />
      {segments.map((segment, index) => {
        const from = project(segment.startLat, segment.startLng);
        const to = project(segment.endLat, segment.endLng);
        const strokeWidth = 0.5 + (segment.miles / maxMiles) * 2.5;
        const strokeOpacity = Math.min(0.85, 0.2 + (segment.count / maxCount) * 0.5);
        return (
          <line
            key={`${segment.startLat}-${segment.startLng}-${segment.endLat}-${segment.endLng}-${index}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="#1976d2"
            strokeWidth={strokeWidth}
            strokeOpacity={strokeOpacity}
            strokeLinecap="round"
          />
        );
      })}
      {clusters.start.map((cluster, index) => {
        const point = project(cluster.lat, cluster.lng);
        const radius = 2 + (cluster.count / maxClusterCount) * 4;
        return (
          <circle
            key={`start-${cluster.lat}-${cluster.lng}-${index}`}
            cx={point.x}
            cy={point.y}
            r={radius}
            fill="rgba(33, 150, 243, 0.8)"
            stroke="#ffffff"
            strokeWidth={0.5}
          />
        );
      })}
      {clusters.end.map((cluster, index) => {
        const point = project(cluster.lat, cluster.lng);
        const radius = 2 + (cluster.count / maxClusterCount) * 4;
        return (
          <circle
            key={`end-${cluster.lat}-${cluster.lng}-${index}`}
            cx={point.x}
            cy={point.y}
            r={radius}
            fill="rgba(244, 67, 54, 0.7)"
            stroke="#ffffff"
            strokeWidth={0.5}
          />
        );
      })}
    </Box>
  );
};

export default ReportsAnalyticsTab;


