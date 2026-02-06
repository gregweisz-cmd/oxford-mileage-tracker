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
import { PerDiemRulesService } from '../services/perDiemRulesService';
import { apiGet, rateLimitedApi } from '../services/rateLimitedApi';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';
const DEFAULT_DAILY_AMOUNT = 35;
const DEFAULT_MONTHLY_LIMIT = 350;

export interface PerDiemEntry {
  date: Date;
  dateKey: string;
  amount: number;
  isEligible: boolean;
  receiptId?: string;
}

export interface PerDiemTabProps {
  employeeId: string;
  employeeName?: string;
  costCenters: string[];
  month: number;
  year: number;
  onDataChange?: () => void;
  /** When user clicks "Go to today", parent should set its month/year to current month/year */
  onGoToToday?: () => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export const PerDiemTab: React.FC<PerDiemTabProps> = ({
  employeeId,
  employeeName,
  costCenters,
  month,
  year,
  onDataChange,
  onGoToToday,
}) => {
  const [entries, setEntries] = useState<Map<string, PerDiemEntry>>(new Map());
  const [dailyMaxAmount, setDailyMaxAmount] = useState(DEFAULT_DAILY_AMOUNT);
  const [monthlyLimit, setMonthlyLimit] = useState(DEFAULT_MONTHLY_LIMIT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<'success' | null>(null);
  /** Per-day rule eligibility: 8+ hours AND (100+ mi OR stayed overnight). Same rule as app. */
  const [eligibilityByDay, setEligibilityByDay] = useState<Map<string, { isEligible: boolean; reason: string }>>(new Map());

  const costCenter = costCenters?.[0] || 'Program Services';
  const daysInMonth = getDaysInMonth(year, month);

  const MIN_HOURS = 8;
  const MIN_MILES = 100;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [perDiemRule, monthlyRules, receipts, timeTracking, mileageEntries, dailyDescriptions] = await Promise.all([
        PerDiemRulesService.getPerDiemRule(costCenter),
        apiGet<{ costCenter: string; maxAmount: number }[]>('/api/per-diem-monthly-rules'),
        apiGet<any[]>(`/api/receipts?employeeId=${encodeURIComponent(employeeId)}&month=${month}&year=${year}`),
        apiGet<any[]>(`/api/time-tracking?employeeId=${encodeURIComponent(employeeId)}&month=${month}&year=${year}`),
        apiGet<any[]>(`/api/mileage-entries?employeeId=${encodeURIComponent(employeeId)}&month=${month}&year=${year}`),
        apiGet<any[]>(`/api/daily-descriptions?employeeId=${encodeURIComponent(employeeId)}&month=${month}&year=${year}`),
      ]);

      setDailyMaxAmount(perDiemRule?.maxAmount ?? DEFAULT_DAILY_AMOUNT);
      const monthlyRule = (monthlyRules || []).find((r: any) => r.costCenter === costCenter);
      setMonthlyLimit(monthlyRule?.maxAmount ?? DEFAULT_MONTHLY_LIMIT);

      const perDiemReceipts = (receipts || []).filter((r: any) => r.category === 'Per Diem');
      const entriesMap = new Map<string, PerDiemEntry>();

      // Normalize date to YYYY-MM-DD for reliable matching (avoids timezone "shift back a day")
      const toDateKey = (r: any): string => {
        if (!r?.date) return '';
        const s = typeof r.date === 'string' ? r.date : new Date(r.date).toISOString();
        const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
      };

      // Build per-day eligibility: 8+ hours AND (100+ miles OR stayed overnight) — same rule as app
      const eligibilityMap = new Map<string, { isEligible: boolean; reason: string }>();
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
        const meetsHours = hoursWorked >= MIN_HOURS;
        const meetsMiles = milesDriven >= MIN_MILES;
        const isEligible = meetsHours && (meetsMiles || stayedOvernight);
        let reason = '';
        if (!meetsHours) reason = `Under ${MIN_HOURS} hours`;
        else if (meetsMiles) reason = `${hoursWorked.toFixed(1)}h, ${milesDriven} mi`;
        else if (stayedOvernight) reason = `${hoursWorked.toFixed(1)}h, stayed overnight`;
        else reason = `Need ${MIN_HOURS}+ hours and (${MIN_MILES}+ mi or overnight)`;
        eligibilityMap.set(dateKey, { isEligible, reason });
      }
      setEligibilityByDay(eligibilityMap);

      const receiptDateKey = toDateKey;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const date = new Date(year, month - 1, day);
        const existing = perDiemReceipts.find((r: any) => receiptDateKey(r) === dateKey);
        const dailyMax = perDiemRule?.maxAmount ?? DEFAULT_DAILY_AMOUNT;
        if (existing) {
          entriesMap.set(dateKey, {
            date,
            dateKey,
            amount: existing.amount ?? dailyMax,
            isEligible: true,
            receiptId: existing.id,
          });
        } else {
          entriesMap.set(dateKey, {
            date,
            dateKey,
            amount: dailyMax,
            isEligible: false,
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
    if (!entry) return;
    if (!entry.isEligible) {
      const otherTotal = Array.from(entries.values())
        .filter((e) => e.isEligible && e.dateKey !== dateKey)
        .reduce((sum, e) => sum + e.amount, 0);
      if (otherTotal + entry.amount > monthlyLimit) {
        setError(`Adding this day would exceed your monthly limit of $${monthlyLimit}. Remaining: $${(monthlyLimit - otherTotal).toFixed(2)}`);
        setTimeout(() => setError(null), 5000);
        return;
      }
    }
    const next = new Map(entries);
    next.set(dateKey, { ...entry, isEligible: !entry.isEligible });
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
      // Do not call onDataChange() here: it triggers parent refreshTrigger and refetch,
      // which can overwrite our state with backend data and cause date-shift bugs.
      setTimeout(() => setSaveMessage(null), 3000);
      // Clear caches so next load (e.g. change month or refresh) gets fresh data. Do NOT refetch
      // here—keeping current UI state so the user's selections stay visible instead of being
      // overwritten by a possibly empty or delayed GET response.
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

  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">Loading per diem...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 720, mx: 'auto', pb: hasUnsavedChanges ? 14 : 2 }}>
      {/* Top bar: title, month, summary (no sticky - scrolls with content) */}
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
          ${dailyMaxAmount} max per day · ${monthlyLimit} max per month. Eligible = 8+ hours and (100+ mi or stayed overnight). Check the days you are claiming; receipt is optional.
        </Typography>
      </Box>

      {/* Days list - use calendar dateKey (YYYY-MM-DD) only; show Eligible / Not eligible like app */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const date = new Date(year, month - 1, day);
          const entry = entries.get(dateKey);
          const dayEligibility = eligibilityByDay.get(dateKey);
          const isEligibleByRule = dayEligibility?.isEligible ?? false;
          if (!entry) return null;
          return (
            <Paper key={dateKey} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Checkbox
                checked={entry.isEligible}
                onChange={() => handleToggleEligible(dateKey)}
                color="primary"
              />
              <Box sx={{ minWidth: 140 }}>
                <Typography>
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: isEligibleByRule ? 'success.main' : 'text.secondary',
                    fontWeight: isEligibleByRule ? 600 : 400,
                  }}
                  title={dayEligibility?.reason}
                >
                  {isEligibleByRule ? 'Eligible' : 'Not eligible'}
                </Typography>
              </Box>
              {entry.isEligible && (
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

      {/* Fixed Save bar at bottom of viewport so it stays visible when user scrolls */}
      {hasUnsavedChanges && (
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
