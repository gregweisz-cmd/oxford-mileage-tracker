import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Checkbox,
  TextField,
  LinearProgress,
  Paper,
  Alert,
} from '@mui/material';
import { Today as TodayIcon } from '@mui/icons-material';
import { PerDiemRulesService, PerDiemRule } from '../services/perDiemRulesService';
import { getMaxDailyAmount } from '../utils/perDiemTierEvaluator';
import { apiGet, rateLimitedApi } from '../services/rateLimitedApi';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';
const DEFAULT_DAILY_AMOUNT = 35;
const DEFAULT_MONTHLY_LIMIT = 350;
const normalizeCostCenter = (value: string): string =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export interface PerDiemEntry {
  date: Date;
  dateKey: string;
  amount: number;
  isEligible: boolean;
  receiptId?: string;
  suggestedAmount?: number;
}

export interface PerDiemTabProps {
  employeeId: string;
  employeeName?: string;
  costCenters: string[];
  month: number;
  year: number;
  onDataChange?: () => void;
  onGoToToday?: () => void;
  supervisorMode?: boolean;
  selectedRevisionItems?: Set<string>;
  onSelectedRevisionItemsChange?: (items: Set<string>) => void;
  revisionHighlightItems?: Set<string>;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

async function fetchDistanceMiles(from: string, to: string): Promise<number> {
  const fromEnc = encodeURIComponent(from);
  const toEnc = encodeURIComponent(to);
  const res = await fetch(`${API_BASE_URL}/api/distance?from=${fromEnc}&to=${toEnc}`, {
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.miles !== 'number') return 0;
  return data.miles;
}

async function computeMaxDistanceFromBase(
  baseAddress: string,
  mileageEntries: any[],
  cache: Map<string, number>
): Promise<number> {
  if (!baseAddress.trim() || !mileageEntries.length) return 0;

  let maxDistance = 0;
  const locations = new Set<string>();

  for (const entry of mileageEntries) {
    for (const loc of [
      entry.startLocation,
      entry.endLocation,
      entry.startLocationAddress,
      entry.endLocationAddress,
    ]) {
      const trimmed = String(loc || '').trim();
      if (trimmed) locations.add(trimmed);
    }
  }

  for (const location of locations) {
    const cacheKey = `${baseAddress}|${location}`;
    let distance = cache.get(cacheKey);
    if (distance == null) {
      distance = await fetchDistanceMiles(baseAddress, location);
      cache.set(cacheKey, distance);
    }
    maxDistance = Math.max(maxDistance, distance);
  }

  return maxDistance;
}

function needsDistanceFromBase(rule: PerDiemRule | null): boolean {
  if (!rule) return false;
  if (rule.ruleType === 'tiered') {
    return (rule.tiers || []).some((tier) => tier.minDistanceFromBase > 0);
  }
  return (rule.minDistanceFromBase ?? 0) > 0;
}

export const PerDiemTab: React.FC<PerDiemTabProps> = ({
  employeeId,
  employeeName,
  costCenters,
  month,
  year,
  onDataChange,
  onGoToToday,
  supervisorMode = false,
  selectedRevisionItems,
  onSelectedRevisionItemsChange,
  revisionHighlightItems,
}) => {
  const [entries, setEntries] = useState<Map<string, PerDiemEntry>>(new Map());
  const [perDiemRule, setPerDiemRule] = useState<PerDiemRule | null>(null);
  const [dailyMaxAmount, setDailyMaxAmount] = useState(DEFAULT_DAILY_AMOUNT);
  const [monthlyLimit, setMonthlyLimit] = useState(DEFAULT_MONTHLY_LIMIT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<'success' | null>(null);
  const [eligibilityByDay, setEligibilityByDay] = useState<
    Map<string, { isEligible: boolean; reason: string; suggestedAmount: number }>
  >(new Map());

  const costCenter = costCenters?.[0] || 'Program Services';
  const daysInMonth = getDaysInMonth(year, month);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rule, monthlyRules, receipts, timeTracking, mileageEntries, dailyDescriptions, employee] =
        await Promise.all([
          PerDiemRulesService.getPerDiemRule(costCenter),
          apiGet<{ costCenter: string; maxAmount: number }[]>('/api/per-diem-monthly-rules'),
          apiGet<any[]>(`/api/receipts?employeeId=${encodeURIComponent(employeeId)}&month=${month}&year=${year}`),
          apiGet<any[]>(`/api/time-tracking?employeeId=${encodeURIComponent(employeeId)}&month=${month}&year=${year}`),
          apiGet<any[]>(`/api/mileage-entries?employeeId=${encodeURIComponent(employeeId)}&month=${month}&year=${year}`),
          apiGet<any[]>(`/api/daily-descriptions?employeeId=${encodeURIComponent(employeeId)}&month=${month}&year=${year}`),
          apiGet<any>(`/api/employees/${encodeURIComponent(employeeId)}`),
        ]);

      setPerDiemRule(rule);
      setDailyMaxAmount(getMaxDailyAmount(
        rule
          ? {
              costCenter: rule.costCenter,
              maxAmount: rule.maxAmount,
              minHours: rule.minHours,
              minMiles: rule.minMiles,
              minDistanceFromBase: rule.minDistanceFromBase,
              ruleType: rule.ruleType,
              tiers: rule.tiers,
            }
          : {
              costCenter,
              maxAmount: DEFAULT_DAILY_AMOUNT,
              minHours: 8,
              minMiles: 100,
              minDistanceFromBase: 0,
            }
      ));

      const normalizedCostCenter = normalizeCostCenter(costCenter);
      const monthlyRule = (monthlyRules || []).find(
        (r: any) => normalizeCostCenter(r.costCenter) === normalizedCostCenter
      );
      setMonthlyLimit(monthlyRule?.maxAmount ?? DEFAULT_MONTHLY_LIMIT);

      const baseAddress = String(employee?.baseAddress || '').trim();
      const computeDistance = needsDistanceFromBase(rule);
      const distanceCache = new Map<string, number>();

      const toDateKey = (r: any): string => {
        if (!r?.date) return '';
        const s = typeof r.date === 'string' ? r.date : new Date(r.date).toISOString();
        const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
      };

      const eligibilityMap = new Map<
        string,
        { isEligible: boolean; reason: string; suggestedAmount: number }
      >();
      const descByDate = new Map<string, { stayedOvernight: boolean }>();
      (dailyDescriptions || []).forEach((d: any) => {
        const key = toDateKey(d);
        if (key) descByDate.set(key, { stayedOvernight: !!(d.stayedOvernight) });
      });

      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayTime = (timeTracking || []).filter((e: any) => toDateKey(e) === dateKey);
        const dayMileage = (mileageEntries || []).filter((e: any) => toDateKey(e) === dateKey);
        const hoursWorked = dayTime
          .filter((e: any) => {
            const cat = (e.category || '').trim();
            return cat === '' || cat === 'Working Hours' || cat === 'Regular Hours';
          })
          .reduce((s: number, e: any) => s + (e.hours || 0), 0);
        const milesDriven = dayMileage.reduce((s: number, e: any) => s + (e.miles || 0), 0);
        const { stayedOvernight } = descByDate.get(dateKey) || { stayedOvernight: false };

        let distanceFromBase = 0;
        if (computeDistance && baseAddress && dayMileage.length > 0) {
          distanceFromBase = await computeMaxDistanceFromBase(baseAddress, dayMileage, distanceCache);
        }

        const evaluation = PerDiemRulesService.evaluateDay(rule, costCenter, {
          hoursWorked,
          milesTraveled: milesDriven,
          distanceFromBase,
          stayedOvernight,
        });

        eligibilityMap.set(dateKey, {
          isEligible: evaluation.isEligible,
          reason: evaluation.reason,
          suggestedAmount: evaluation.amount,
        });
      }
      setEligibilityByDay(eligibilityMap);

      const perDiemReceipts = (receipts || []).filter((r: any) => r.category === 'Per Diem');
      const entriesMap = new Map<string, PerDiemEntry>();
      const receiptDateKey = toDateKey;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const date = new Date(year, month - 1, day);
        const existing = perDiemReceipts.find((r: any) => receiptDateKey(r) === dateKey);
        const dayEval = eligibilityMap.get(dateKey);
        const suggested = dayEval?.suggestedAmount ?? dailyMaxAmount;

        if (existing) {
          entriesMap.set(dateKey, {
            date,
            dateKey,
            amount: existing.amount ?? suggested,
            isEligible: true,
            receiptId: existing.id,
            suggestedAmount: suggested,
          });
        } else {
          entriesMap.set(dateKey, {
            date,
            dateKey,
            amount: suggested,
            isEligible: false,
            suggestedAmount: suggested,
          });
        }
      }
      setEntries(entriesMap);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to load per diem data.');
    } finally {
      setLoading(false);
    }
  }, [employeeId, costCenter, month, year, daysInMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const monthlyTotal = Array.from(entries.values())
    .filter((e) => e.isEligible)
    .reduce((sum, e) => sum + e.amount, 0);

  const handleToggleEligible = (dateKey: string) => {
    const entry = entries.get(dateKey);
    const dayEligibility = eligibilityByDay.get(dateKey);
    if (!entry) return;

    if (!entry.isEligible && !dayEligibility?.isEligible) {
      setError(dayEligibility?.reason || 'This day is not eligible for per diem.');
      setTimeout(() => setError(null), 5000);
      return;
    }

    if (!entry.isEligible) {
      const otherTotal = Array.from(entries.values())
        .filter((e) => e.isEligible && e.dateKey !== dateKey)
        .reduce((sum, e) => sum + e.amount, 0);
      const amountToAdd = dayEligibility?.suggestedAmount ?? entry.amount;
      if (otherTotal + amountToAdd > monthlyLimit) {
        setError(`Adding this day would exceed your monthly limit of $${monthlyLimit}. Remaining: $${(monthlyLimit - otherTotal).toFixed(2)}`);
        setTimeout(() => setError(null), 5000);
        return;
      }
    }

    const next = new Map(entries);
    next.set(dateKey, {
      ...entry,
      isEligible: !entry.isEligible,
      amount: !entry.isEligible ? (dayEligibility?.suggestedAmount ?? entry.amount) : entry.amount,
    });
    setEntries(next);
    setHasUnsavedChanges(true);
    setError(null);
  };

  const handleAmountChange = (dateKey: string, value: string) => {
    const entry = entries.get(dateKey);
    if (!entry || !entry.isEligible) return;
    const num = parseFloat(value) || 0;
    const capped = Math.min(Math.max(0, num), dailyMaxAmount);
    const otherTotal = Array.from(entries.values())
      .filter((e) => e.isEligible && e.dateKey !== dateKey)
      .reduce((sum, e) => sum + e.amount, 0);
    if (otherTotal + capped > monthlyLimit) {
      setError(`Amount would exceed monthly limit. Max for this day: $${(monthlyLimit - otherTotal).toFixed(2)}`);
      setTimeout(() => setError(null), 5000);
      return;
    }
    const next = new Map(entries);
    next.set(dateKey, { ...entry, amount: capped });
    setEntries(next);
    setHasUnsavedChanges(true);
    setError(null);
  };

  const handleSelectAllEligibleDays = () => {
    const next = new Map(entries);
    let changed = false;

    eligibilityByDay.forEach((eligibility, dateKey) => {
      if (!eligibility.isEligible) return;
      const entry = next.get(dateKey);
      if (!entry || entry.isEligible) return;
      next.set(dateKey, {
        ...entry,
        isEligible: true,
        amount: eligibility.suggestedAmount ?? entry.amount,
      });
      changed = true;
    });

    if (!changed) {
      setError('All eligible days are already selected.');
      setTimeout(() => setError(null), 4000);
      return;
    }

    setEntries(next);
    setHasUnsavedChanges(true);
    setError(null);
  };

  const handleSave = async () => {
    if (!hasUnsavedChanges) return;
    if (!employeeId?.trim()) {
      setError('Cannot save: employee not loaded. Refresh the page and try again.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const toSave = Array.from(entries.values()).filter((e) => e.isEligible);
      const toDelete = Array.from(entries.values()).filter((e) => !e.isEligible && e.receiptId);

      for (const entry of toDelete) {
        if (entry.receiptId) {
          const res = await fetch(`${API_BASE_URL}/api/receipts/${entry.receiptId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            throw new Error(`Delete failed: ${res.status} ${errText}`);
          }
        }
      }

      const nextEntries = new Map(entries);
      for (const entry of toSave) {
        const body = {
          employeeId,
          date: entry.dateKey,
          amount: entry.amount,
          vendor: 'Per Diem',
          description: 'Per Diem',
          category: 'Per Diem',
          costCenter,
          imageUri: '',
          fileType: 'image',
        };
        if (entry.receiptId) {
          const res = await fetch(`${API_BASE_URL}/api/receipts/${entry.receiptId}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, id: entry.receiptId }),
          });
          if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            throw new Error(`Update failed: ${res.status} ${errText}`);
          }
        } else {
          const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
          const res = await fetch(`${API_BASE_URL}/api/receipts`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, id }),
          });
          if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            throw new Error(`Save failed: ${res.status} ${errText}`);
          }
          nextEntries.set(entry.dateKey, { ...entry, receiptId: id });
        }
      }

      setEntries(nextEntries);
      setHasUnsavedChanges(false);
      setSaveMessage('success');
      onDataChange?.();
      setTimeout(() => setSaveMessage(null), 3000);
      rateLimitedApi.clearCache();
      PerDiemRulesService.clearCache();
    } catch (err: any) {
      const msg = err?.message || (typeof err?.error === 'string' ? err.error : 'Failed to save per diem.');
      setError(msg);
      console.error('[PerDiemTab] Save failed:', msg, err);
    } finally {
      setSaving(false);
    }
  };

  const ruleSummary =
    perDiemRule?.ruleType === 'tiered'
      ? `Tiered per diem (${(perDiemRule.tiers || []).length} tiers, up to $${dailyMaxAmount}/day)`
      : `$${dailyMaxAmount} max per day · eligible days must meet cost center rules`;

  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">Loading per diem...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 720, mx: 'auto', pb: hasUnsavedChanges ? 14 : 2 }}>
      <Box sx={{ pb: 2, mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Per Diem
          {employeeName && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              — {employeeName}
            </Typography>
          )}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ minWidth: 160 }}>
            {new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Typography>
          {!supervisorMode && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleSelectAllEligibleDays}
              disabled={saving || loading}
            >
              Select all eligible days
            </Button>
          )}
          {onGoToToday && (
            <Button size="small" startIcon={<TodayIcon />} onClick={onGoToToday}>
              Go to today
            </Button>
          )}
        </Box>

        <Paper sx={{ p: 2, mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Monthly total
            </Typography>
            <Typography variant="body1" fontWeight={600} color={monthlyTotal >= monthlyLimit ? 'error.main' : 'text.primary'}>
              ${monthlyTotal.toFixed(2)} / ${monthlyLimit.toFixed(2)}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, (monthlyTotal / monthlyLimit) * 100)}
            color={monthlyTotal >= monthlyLimit ? 'error' : monthlyTotal >= monthlyLimit * 0.85 ? 'warning' : 'primary'}
            sx={{ height: 8, borderRadius: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}>
            Remaining: ${Math.max(0, monthlyLimit - monthlyTotal).toFixed(2)}
          </Typography>
        </Paper>

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        {saveMessage === 'success' && (
          <Alert severity="success" sx={{ mb: 1 }}>
            Per diem saved successfully.
          </Alert>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {ruleSummary}. ${monthlyLimit} max per month. Only eligible days can be selected; suggested amounts apply when you check a day.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const date = new Date(year, month - 1, day);
          const entry = entries.get(dateKey);
          const dayEligibility = eligibilityByDay.get(dateKey);
          const isEligibleByRule = dayEligibility?.isEligible ?? false;
          const revisionItemId = `perdiem-${dateKey}`;
          const needsRevision = !!revisionHighlightItems?.has(revisionItemId);
          if (!entry) return null;

          const checkboxDisabled = !supervisorMode && !isEligibleByRule && !entry.isEligible;

          return (
            <Paper
              key={dateKey}
              variant="outlined"
              sx={{
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                opacity: checkboxDisabled ? 0.55 : 1,
                ...(needsRevision ? { bgcolor: '#ffcccc' } : {}),
              }}
            >
              <Checkbox
                checked={supervisorMode ? !!selectedRevisionItems?.has(revisionItemId) : entry.isEligible}
                onChange={() => {
                  if (!supervisorMode) {
                    handleToggleEligible(dateKey);
                    return;
                  }
                  const next = new Set(selectedRevisionItems || []);
                  if (next.has(revisionItemId)) next.delete(revisionItemId);
                  else next.add(revisionItemId);
                  onSelectedRevisionItemsChange?.(next);
                }}
                color="primary"
                disabled={checkboxDisabled}
              />
              <Box sx={{ minWidth: 140, flex: 1 }}>
                <Typography>
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Typography>
                {needsRevision && (
                  <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>
                    Revision requested
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  sx={{
                    color: isEligibleByRule ? 'success.main' : 'text.secondary',
                    fontWeight: isEligibleByRule ? 600 : 400,
                    display: 'block',
                  }}
                  title={dayEligibility?.reason}
                >
                  {isEligibleByRule
                    ? `Eligible${dayEligibility?.suggestedAmount ? ` · suggest $${dayEligibility.suggestedAmount.toFixed(2)}` : ''}`
                    : dayEligibility?.reason || 'Not eligible'}
                </Typography>
              </Box>
              {entry.isEligible && !supervisorMode && (
                <TextField
                  type="number"
                  size="small"
                  label="Amount ($)"
                  value={entry.amount}
                  onChange={(e) => handleAmountChange(dateKey, e.target.value)}
                  inputProps={{ min: 0, max: dailyMaxAmount, step: 0.01 }}
                  sx={{ width: 120 }}
                />
              )}
            </Paper>
          );
        })}
      </Box>

      {!supervisorMode && hasUnsavedChanges && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1300,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            py: 1.5,
            bgcolor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <Button variant="contained" onClick={handleSave} disabled={saving} size="large">
            {saving ? 'Saving...' : 'Save per diem'}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default PerDiemTab;
