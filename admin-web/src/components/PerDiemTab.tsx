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
import { apiGet, apiPost, apiPut, apiDelete, rateLimitedApi } from '../services/rateLimitedApi';

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

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
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

  const costCenter = costCenters?.[0] || 'Program Services';
  const daysInMonth = getDaysInMonth(year, month);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [perDiemRule, monthlyRules, receipts] = await Promise.all([
        PerDiemRulesService.getPerDiemRule(costCenter),
        apiGet<{ costCenter: string; maxAmount: number }[]>('/api/per-diem-monthly-rules'),
        apiGet<any[]>(`/api/receipts?employeeId=${encodeURIComponent(employeeId)}&month=${month}&year=${year}`),
      ]);

      setDailyMaxAmount(perDiemRule?.maxAmount ?? DEFAULT_DAILY_AMOUNT);
      const monthlyRule = (monthlyRules || []).find((r: any) => r.costCenter === costCenter);
      setMonthlyLimit(monthlyRule?.maxAmount ?? DEFAULT_MONTHLY_LIMIT);

      const perDiemReceipts = (receipts || []).filter((r: any) => r.category === 'Per Diem');
      const entriesMap = new Map<string, PerDiemEntry>();

      // Normalize receipt date to YYYY-MM-DD for reliable matching (avoids timezone "shift back a day")
      const receiptDateKey = (r: any): string => {
        if (!r?.date) return '';
        const s = typeof r.date === 'string' ? r.date : new Date(r.date).toISOString();
        const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
      };

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateKey = toDateKey(date);
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
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const toSave = Array.from(entries.values()).filter((e) => e.isEligible);
      const toDelete = Array.from(entries.values()).filter((e) => !e.isEligible && e.receiptId);

      for (const entry of toDelete) {
        if (entry.receiptId) {
          await apiDelete(`/api/receipts/${entry.receiptId}`);
        }
      }

      for (const entry of toSave) {
        const body = {
          employeeId,
          date: toDateKey(entry.date),
          amount: entry.amount,
          vendor: 'Per Diem',
          description: 'Per Diem',
          category: 'Per Diem',
          imageUri: '',
          fileType: 'image',
        };
        if (entry.receiptId) {
          await apiPut(`/api/receipts/${entry.receiptId}`, { ...body, id: entry.receiptId });
        } else {
          const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
          await apiPost('/api/receipts', { ...body, id });
        }
      }

      setHasUnsavedChanges(false);
      setSaveMessage('success');
      onDataChange?.();
      setTimeout(() => setSaveMessage(null), 3000);
      // Clear all caches so refetch uses fresh data (receipts + per diem rules for dailyMax/eligibility)
      rateLimitedApi.clearCache();
      PerDiemRulesService.clearCache();
      // Brief delay so backend commit is visible to the next GET
      await new Promise((r) => setTimeout(r, 150));
      await loadData();
    } catch (err: any) {
      const msg = err?.message || (typeof err?.error === 'string' ? err.error : 'Failed to save per diem.');
      setError(msg);
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
    <Box sx={{ p: 2, maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Per Diem
        {employeeName && (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            — {employeeName}
          </Typography>
        )}
      </Typography>

      {/* Month follows global header dropdown; optional "Go to today" jumps to current month */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ minWidth: 160 }}>
          {new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Typography>
        {onGoToToday && (
          <Button size="small" startIcon={<TodayIcon />} onClick={onGoToToday} sx={{ ml: 1 }}>
            Go to today
          </Button>
        )}
      </Box>

      {/* Summary */}
      <Paper sx={{ p: 2, mb: 2 }}>
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
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {saveMessage === 'success' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Per diem saved successfully.
        </Alert>
      )}

      {/* Rules note */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        ${dailyMaxAmount} max per day · ${monthlyLimit} max per month. Check the days you are claiming; receipt is optional for per diem.
      </Typography>

      {/* Days list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const date = new Date(year, month - 1, day);
          const dateKey = toDateKey(date);
          const entry = entries.get(dateKey);
          if (!entry) return null;
          return (
            <Paper key={dateKey} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Checkbox
                checked={entry.isEligible}
                onChange={() => handleToggleEligible(dateKey)}
                color="primary"
              />
              <Typography sx={{ minWidth: 100 }}>
                {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Typography>
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

      {hasUnsavedChanges && (
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save per diem'}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default PerDiemTab;
