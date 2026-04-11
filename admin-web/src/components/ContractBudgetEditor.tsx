import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { CostCenter, CostCenterApiService } from '../services/costCenterApiService';
import { debugError } from '../config/debug';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

interface Props {
  contractsUserId: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ContractBudgetEditor: React.FC<Props> = ({ contractsUserId }) => {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [capMiles, setCapMiles] = useState('');
  const [capPerDiem, setCapPerDiem] = useState('');
  const [capReceiptsAmount, setCapReceiptsAmount] = useState('');
  const [capReceiptCount, setCapReceiptCount] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingCc, setLoadingCc] = useState(true);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCc(true);
      try {
        const list = await CostCenterApiService.getAllCostCenters();
        if (cancelled) return;
        setCostCenters(list.filter((c) => c.isActive !== false));
        setSelectedCode((prev) => {
          if (prev) return prev;
          const first = list.find((c) => c.isActive !== false);
          return first?.name || first?.code || '';
        });
      } catch (e) {
        debugError(e);
        if (!cancelled) setCostCenters([]);
      } finally {
        if (!cancelled) setLoadingCc(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadBudget = useCallback(async () => {
    if (!selectedCode) return;
    setLoadingBudget(true);
    setMessage(null);
    try {
      const q = new URLSearchParams({
        year: String(year),
        month: String(month),
        costCenter: selectedCode,
      });
      const res = await fetch(`${API_BASE_URL}/api/contract-budgets?${q}`);
      if (!res.ok) throw new Error('Failed to load caps');
      const json = await res.json();
      const row = Array.isArray(json.budgets) && json.budgets[0] ? json.budgets[0] : null;
      if (row) {
        setCapMiles(row.capMiles != null ? String(row.capMiles) : '');
        setCapPerDiem(row.capPerDiemAmount != null ? String(row.capPerDiemAmount) : '');
        setCapReceiptsAmount(row.capReceiptsAmount != null ? String(row.capReceiptsAmount) : '');
        setCapReceiptCount(row.capReceiptCount != null ? String(row.capReceiptCount) : '');
        setNotes(row.notes || '');
      } else {
        setCapMiles('');
        setCapPerDiem('');
        setCapReceiptsAmount('');
        setCapReceiptCount('');
        setNotes('');
      }
    } catch (e) {
      debugError(e);
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Load failed' });
    } finally {
      setLoadingBudget(false);
    }
  }, [selectedCode, year, month]);

  useEffect(() => {
    void loadBudget();
  }, [loadBudget]);

  const handleSave = async () => {
    if (!selectedCode) return;
    setSaving(true);
    setMessage(null);
    try {
      const rc =
        capReceiptCount === ''
          ? null
          : (() => {
              const n = parseInt(capReceiptCount, 10);
              return Number.isFinite(n) ? n : null;
            })();

      const res = await fetch(`${API_BASE_URL}/api/contract-budgets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedByUserId: contractsUserId,
          costCenter: selectedCode,
          year,
          month,
          capMiles: capMiles === '' ? null : Number(capMiles),
          capPerDiemAmount: capPerDiem === '' ? null : Number(capPerDiem),
          capReceiptsAmount: capReceiptsAmount === '' ? null : Number(capReceiptsAmount),
          capReceiptCount: rc,
          notes: notes.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Save failed');
      setMessage({ type: 'success', text: 'Contract caps saved for this cost center and month.' });
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const yearChoices = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  if (loadingCc) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Monthly contract caps (by cost center)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Set optional limits for a calendar month. Supervisors see utilization for their team only. Leave a field
          empty to clear that cap.
        </Typography>

        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Cost center</InputLabel>
            <Select
              value={selectedCode}
              label="Cost center"
              onChange={(e) => setSelectedCode(String(e.target.value))}
            >
              {costCenters.map((c) => (
                <MenuItem key={c.id} value={c.name}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Year</InputLabel>
            <Select value={year} label="Year" onChange={(e) => setYear(Number(e.target.value))}>
              {yearChoices.map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
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

        {loadingBudget ? (
          <CircularProgress size={32} sx={{ my: 2 }} />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
            <TextField
              label="Cap — miles (team total)"
              type="number"
              size="small"
              value={capMiles}
              onChange={(e) => setCapMiles(e.target.value)}
              inputProps={{ step: '0.1', min: 0 }}
            />
            <TextField
              label="Cap — per diem ($, team total)"
              type="number"
              size="small"
              value={capPerDiem}
              onChange={(e) => setCapPerDiem(e.target.value)}
              inputProps={{ step: '0.01', min: 0 }}
            />
            <TextField
              label="Cap — all receipts ($, team total)"
              type="number"
              size="small"
              value={capReceiptsAmount}
              onChange={(e) => setCapReceiptsAmount(e.target.value)}
              inputProps={{ step: '0.01', min: 0 }}
            />
            <TextField
              label="Cap — receipt count (team total)"
              type="number"
              size="small"
              value={capReceiptCount}
              onChange={(e) => setCapReceiptCount(e.target.value)}
              inputProps={{ step: 1, min: 0 }}
            />
            <TextField
              label="Notes (shown to supervisors)"
              size="small"
              multiline
              minRows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
              onClick={() => void handleSave()}
              disabled={saving || !selectedCode}
            >
              Save caps
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ContractBudgetEditor;
