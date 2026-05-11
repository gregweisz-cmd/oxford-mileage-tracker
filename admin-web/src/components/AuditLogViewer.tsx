import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { debugError } from '../config/debug';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

export interface AuditLogViewerProps {
  adminId: string;
}

export interface AuditLogRow {
  id: number;
  action: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown> | string | null;
  createdAt: string;
}

function formatDetails(details: AuditLogRow['details']): string {
  if (details == null || details === '') return '—';
  if (typeof details === 'string') return details.length > 500 ? `${details.slice(0, 500)}…` : details;
  try {
    const s = JSON.stringify(details);
    return s.length > 500 ? `${s.slice(0, 500)}…` : s;
  } catch {
    return String(details);
  }
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ adminId }) => {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Draft filter inputs (applied only on Refresh). */
  const [draftTargetType, setDraftTargetType] = useState('');
  const [draftTargetId, setDraftTargetId] = useState('');
  /** Query sent to the API */
  const [appliedTargetType, setAppliedTargetType] = useState('');
  const [appliedTargetId, setAppliedTargetId] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [limit, setLimit] = useState(200);

  const adminHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      'x-employee-id': adminId,
      Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`,
    }),
    [adminId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      const tt = appliedTargetType.trim();
      const tid = appliedTargetId.trim();
      if (tt) params.set('targetType', tt);
      if (tid) params.set('targetId', tid);

      const res = await fetch(`${API_BASE_URL}/api/admin/audit-logs?${params.toString()}`, {
        headers: adminHeaders(),
      });

      if (res.status === 403) {
        setError('You need admin role to view audit logs.');
        setRows([]);
        return;
      }
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      debugError('Audit log load failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to load audit logs');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [adminHeaders, limit, appliedTargetType, appliedTargetId, refreshNonce]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleLimitChange = (e: SelectChangeEvent<number>) => {
    setLimit(Number(e.target.value));
  };

  const handleRefresh = () => {
    setAppliedTargetType(draftTargetType.trim());
    setAppliedTargetId(draftTargetId.trim());
    setRefreshNonce((n) => n + 1);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Audit Log
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Read-only history of sensitive admin and report actions (who did what, and when). Set optional filters, then
        click Refresh to query.
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Entries are retained in the server database. For incidents, note the time range and actor here before
        contacting hosting support.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="Target type (optional)"
          value={draftTargetType}
          onChange={(e) => setDraftTargetType(e.target.value)}
          placeholder="e.g. expense_report"
          sx={{ minWidth: 200 }}
        />
        <TextField
          size="small"
          label="Target id (optional)"
          value={draftTargetId}
          onChange={(e) => setDraftTargetId(e.target.value)}
          placeholder="e.g. report id"
          sx={{ minWidth: 220 }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="audit-limit-label">Rows</InputLabel>
          <Select
            labelId="audit-limit-label"
            label="Rows"
            value={limit}
            onChange={handleLimitChange}
          >
            <MenuItem value={100}>100</MenuItem>
            <MenuItem value={200}>200</MenuItem>
            <MenuItem value={500}>500</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<RefreshIcon />} onClick={handleRefresh} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      <TableContainer component={Paper} sx={{ maxHeight: 560 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell width={160}>Time (UTC)</TableCell>
              <TableCell width={140}>Action</TableCell>
              <TableCell width={180}>Actor</TableCell>
              <TableCell width={120}>Role</TableCell>
              <TableCell width={140}>Target type</TableCell>
              <TableCell width={160}>Target id</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No audit entries match the current filters.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                    {row.createdAt ? new Date(row.createdAt).toISOString().replace('T', ' ').slice(0, 19) : '—'}
                  </TableCell>
                  <TableCell>{row.action}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {[row.actorName, row.actorId].filter(Boolean).join(' · ') || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.actorRole || '—'}</TableCell>
                  <TableCell>{row.targetType}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                    {row.targetId || '—'}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: 11,
                      maxWidth: 420,
                      verticalAlign: 'top',
                      wordBreak: 'break-word',
                    }}
                    title={formatDetails(row.details)}
                  >
                    {formatDetails(row.details)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
