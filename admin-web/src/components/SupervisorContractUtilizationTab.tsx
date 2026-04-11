import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { PieChart as PieChartIcon } from '@mui/icons-material';
import { debugError } from '../config/debug';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

export interface UtilizationResponse {
  costCenter: string;
  year: number;
  month: number;
  dateRange: { start: string; end: string };
  teamMemberCount: number;
  totalMiles: number;
  mileageTripCount: number;
  perDiemReceiptTotal: number;
  perDiemReceiptCount: number;
  otherReceiptsTotal: number;
  otherReceiptCount: number;
  totalReceiptsTotal: number;
  totalReceiptCount: number;
  budget: {
    capMiles: number | null;
    capPerDiemAmount: number | null;
    capReceiptsAmount: number | null;
    capReceiptCount: number | null;
    notes?: string;
  } | null;
}

function pct(used: number, cap: number | null | undefined): number | null {
  if (cap == null || cap <= 0) return null;
  return Math.min(100, (used / cap) * 100);
}

function barColor(p: number | null): 'inherit' | 'primary' | 'secondary' | 'error' | 'warning' {
  if (p == null) return 'primary';
  if (p >= 100) return 'error';
  if (p >= 85) return 'warning';
  return 'primary';
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Props {
  supervisorId: string;
}

const SupervisorContractUtilizationTab: React.FC<Props> = ({ supervisorId }) => {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [costCenters, setCostCenters] = useState<string[]>([]);
  const [selectedCc, setSelectedCc] = useState<string | null>(null);
  const [data, setData] = useState<UtilizationResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCostCenters = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/supervisors/${encodeURIComponent(supervisorId)}/team-cost-centers`
      );
      if (!res.ok) throw new Error('Failed to load team cost centers');
      const json = await res.json();
      const list: string[] = Array.isArray(json.costCenters) ? json.costCenters : [];
      setCostCenters(list);
      setSelectedCc((prev) => (prev && list.includes(prev) ? prev : list[0] || null));
    } catch (e) {
      debugError(e);
      setCostCenters([]);
      setError(e instanceof Error ? e.message : 'Could not load cost centers');
    } finally {
      setLoadingList(false);
    }
  }, [supervisorId]);

  const loadUtilization = useCallback(async () => {
    if (!selectedCc) {
      setData(null);
      return;
    }
    setLoadingDetail(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        costCenter: selectedCc,
        year: String(year),
        month: String(month),
      });
      const res = await fetch(
        `${API_BASE_URL}/api/supervisors/${encodeURIComponent(supervisorId)}/cost-center-utilization?${q}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const json = (await res.json()) as UtilizationResponse;
      setData(json);
    } catch (e) {
      debugError(e);
      setData(null);
      setError(e instanceof Error ? e.message : 'Could not load utilization');
    } finally {
      setLoadingDetail(false);
    }
  }, [supervisorId, selectedCc, year, month]);

  useEffect(() => {
    void loadCostCenters();
  }, [loadCostCenters]);

  useEffect(() => {
    void loadUtilization();
  }, [loadUtilization]);

  const yearChoices = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  if (loadingList) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PieChartIcon color="primary" />
        Contract utilization (your team)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Totals include only direct reports and only entries tagged with each cost center. Caps are set by
        Contracts in the Contracts Portal.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Year</InputLabel>
          <Select value={year} label="Year" onChange={(e) => setYear(Number(e.target.value))}>
            {yearChoices.map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Month</InputLabel>
          <Select value={month} label="Month" onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((name, i) => (
              <MenuItem key={name} value={i + 1}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {costCenters.length === 0 ? (
        <Alert severity="info">
          No cost centers found on your direct reports. Assign cost centers in Admin → Employee Management.
        </Alert>
      ) : (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Cost centers
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 1.5,
              mb: 3,
            }}
          >
            {costCenters.map((cc) => (
              <Card
                key={cc}
                variant="outlined"
                sx={{
                  borderColor: selectedCc === cc ? 'primary.main' : 'divider',
                  borderWidth: selectedCc === cc ? 2 : 1,
                }}
              >
                <CardActionArea onClick={() => setSelectedCc(cc)}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="subtitle2" noWrap title={cc}>
                      {cc}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>

          {selectedCc && (
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">{selectedCc}</Typography>
                  {loadingDetail && <CircularProgress size={24} />}
                </Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                  {data?.dateRange?.start} through {data?.dateRange?.end} · {data?.teamMemberCount ?? '—'} team
                  member(s)
                </Typography>

                {!data && !loadingDetail ? (
                  <Alert severity="warning">No data loaded.</Alert>
                ) : data ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Miles driven: <strong>{data.totalMiles.toFixed(1)}</strong> ({data.mileageTripCount}{' '}
                        trips)
                      </Typography>
                      {(() => {
                        const p = pct(data.totalMiles, data.budget?.capMiles ?? null);
                        return p != null ? (
                          <LinearProgress
                            variant="determinate"
                            value={p}
                            color={barColor(p)}
                            sx={{ height: 8, borderRadius: 1 }}
                          />
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No mileage cap set for this month.
                          </Typography>
                        );
                      })()}
                      {data.budget?.capMiles != null && (
                        <Typography variant="caption" color="text.secondary">
                          Cap: {data.budget.capMiles.toFixed(1)} mi
                        </Typography>
                      )}
                    </Box>

                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Per diem (receipts):{' '}
                        <strong>${data.perDiemReceiptTotal.toFixed(2)}</strong> ({data.perDiemReceiptCount}{' '}
                        receipts)
                      </Typography>
                      {(() => {
                        const p = pct(data.perDiemReceiptTotal, data.budget?.capPerDiemAmount ?? null);
                        return p != null ? (
                          <LinearProgress
                            variant="determinate"
                            value={p}
                            color={barColor(p)}
                            sx={{ height: 8, borderRadius: 1 }}
                          />
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No per diem cap set for this month.
                          </Typography>
                        );
                      })()}
                      {data.budget?.capPerDiemAmount != null && (
                        <Typography variant="caption" color="text.secondary">
                          Cap: ${data.budget.capPerDiemAmount.toFixed(2)}
                        </Typography>
                      )}
                    </Box>

                    <Box>
                      <Typography variant="body2" gutterBottom>
                        Other receipts: <strong>${data.otherReceiptsTotal.toFixed(2)}</strong> (
                        {data.otherReceiptCount})
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="body2" gutterBottom>
                        All receipts: <strong>${data.totalReceiptsTotal.toFixed(2)}</strong> (
                        {data.totalReceiptCount} items)
                      </Typography>
                      {(() => {
                        const pAmt = pct(data.totalReceiptsTotal, data.budget?.capReceiptsAmount ?? null);
                        const pCnt = pct(data.totalReceiptCount, data.budget?.capReceiptCount ?? null);
                        return (
                          <>
                            {pAmt != null && (
                              <>
                                <Typography variant="caption" display="block">
                                  vs receipt $ cap
                                </Typography>
                                <LinearProgress
                                  variant="determinate"
                                  value={pAmt}
                                  color={barColor(pAmt)}
                                  sx={{ height: 8, borderRadius: 1, mb: 1 }}
                                />
                              </>
                            )}
                            {pCnt != null && (
                              <>
                                <Typography variant="caption" display="block">
                                  vs receipt count cap
                                </Typography>
                                <LinearProgress
                                  variant="determinate"
                                  value={pCnt}
                                  color={barColor(pCnt)}
                                  sx={{ height: 8, borderRadius: 1 }}
                                />
                              </>
                            )}
                            {pAmt == null && pCnt == null && (
                              <Typography variant="caption" color="text.secondary">
                                No receipt caps set for this month.
                              </Typography>
                            )}
                          </>
                        );
                      })()}
                      {data.budget?.capReceiptsAmount != null && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          $ cap: ${data.budget.capReceiptsAmount.toFixed(2)}
                        </Typography>
                      )}
                      {data.budget?.capReceiptCount != null && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Count cap: {data.budget.capReceiptCount}
                        </Typography>
                      )}
                    </Box>

                    {data.budget?.notes ? (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        <strong>Contract notes:</strong> {data.budget.notes}
                      </Alert>
                    ) : null}
                  </Box>
                ) : null}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
};

export default SupervisorContractUtilizationTab;
