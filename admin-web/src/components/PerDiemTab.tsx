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
  IconButton,
} from '@mui/material';
import { ChevronLeft, ChevronRight, Today as TodayIcon } from '@mui/icons-material';
import { PerDiemRulesService } from '../services/perDiemRulesService';
import { apiGet, apiPost, apiPut, apiDelete } from '../services/rateLimitedApi';

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
}) => {
  const [currentMonth, setCurrentMonth] = useState(month);
  const [currentYear, setCurrentYear] = useState(year);

  // Sync to props when they change (e.g. user switched report month in portal)
  useEffect(() => {
    setCurrentMonth(month);
    setCurrentYear(year);
  }, [month, year]);
  const [entries, setEntries] = useState<Map<string, PerDiemEntry>>(new Map());
  const [dailyMaxAmount, setDailyMaxAmount] = useState(DEFAULT_DAILY_AMOUNT);
  const [monthlyLimit, setMonthlyLimit] = useState(DEFAULT_MONTHLY_LIMIT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<'success' | null>(null);

  const costCenter = costCenters?.[0] || 'Program Services';
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [perDiemRule, monthlyRules, receipts] = await Promise.all([
        PerDiemRulesService.getPerDiemRule(costCenter),
        apiGet<{ costCenter: string; maxAmount: number }[]>('/api/per-diem-monthly-rules'),
        apiGet<any[]>(`/api/receipts?employeeId=${encodeURIComponent(employeeId)}&month=${currentMonth}&year=${currentYear}`),
      ]);

      setDailyMaxAmount(perDiemRule?.maxAmount ?? DEFAULT_DAILY_AMOUNT);
      const monthlyRule = (monthlyRules || []).find((r: any) => r.costCenter === costCenter);
      setMonthlyLimit(monthlyRule?.maxAmount ?? DEFAULT_MONTHLY_LIMIT);

      const perDiemReceipts = (receipts || []).filter((r: any) => r.category === 'Per Diem');
      const entriesMap = new Map<string, PerDiemEntry>();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth - 1, day);
        const dateKey = toDateKey(date);
        const existing = perDiemReceipts.find((r: any) => {
          const d = new Date(r.date);
          return d.getUTCDate() === day && d.getUTCMonth() === currentMonth - 1 && d.getUTCFullYear() === currentYear;
        });
        if (existing) {
          entriesMap.set(dateKey, {
            date,
            dateKey,
            amount: existing.amount ?? dailyMaxAmount,
            isEligible: true,
            receiptId: existing.id,
          });
        } else {
          entriesMap.set(dateKey, {
            date,
            dateKey,
            amount: perDiemRule?.maxAmount ?? DEFAULT_DAILY_AMOUNT,
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
  }, [employeeId, costCenter, currentMonth, currentYear, daysInMonth]);

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
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save per diem.');
    } finally {
      setSaving(false);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(now.getMonth() + 1);
    setCurrentYear(now.getFullYear());
  };

  const isViewingCurrentMonth = currentMonth === new Date().getMonth() + 1 && currentYear === new Date().getFullYear();

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

      {/* Month navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton
          size="small"
          onClick={() => {
            if (currentMonth <= 1) {
              setCurrentYear((y) => y - 1);
              setCurrentMonth(12);
            } else {
              setCurrentMonth((m) => m - 1);
            }
          }}
        >
          <ChevronLeft />
        </IconButton>
        <Typography variant="subtitle1" sx={{ minWidth: 160, textAlign: 'center' }}>
          {new Date(currentYear, currentMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Typography>
        <IconButton
          size="small"
          onClick={() => {
            if (currentMonth >= 12) {
              setCurrentYear((y) => y + 1);
              setCurrentMonth(1);
            } else {
              setCurrentMonth((m) => m + 1);
            }
          }}
        >
          <ChevronRight />
        </IconButton>
        <Button size="small" startIcon={<TodayIcon />} onClick={goToToday} sx={{ ml: 1 }}>
          Go to today
        </Button>
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
          const date = new Date(currentYear, currentMonth - 1, day);
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
