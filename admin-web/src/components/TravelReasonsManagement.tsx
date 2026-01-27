import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Add, Edit, Delete, DragIndicator } from '@mui/icons-material';
import { debugError } from '../config/debug';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

export interface TravelReason {
  id: string;
  label: string;
  category: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const TravelReasonsManagement: React.FC = () => {
  const [reasons, setReasons] = useState<TravelReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TravelReason | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const dragImageRef = useRef<HTMLElement | null>(null);

  const loadReasons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/travel-reasons`);
      if (!res.ok) throw new Error('Failed to load travel reasons');
      const data = await res.json();
      setReasons(Array.isArray(data) ? data : []);
    } catch (e: any) {
      debugError('Error loading travel reasons:', e);
      setError(e.message || 'Failed to load travel reasons');
      setReasons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReasons();
  }, [loadReasons]);

  const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const handleAdd = () => {
    setEditing(null);
    setFormLabel('');
    setDialogOpen(true);
    setError(null);
  };

  const handleEdit = (r: TravelReason) => {
    setEditing(r);
    setFormLabel(r.label);
    setDialogOpen(true);
    setError(null);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    const row = e.currentTarget as HTMLTableRowElement;
    const table = document.createElement('table');
    table.setAttribute('role', 'presentation');
    table.style.cssText =
      'position:absolute;top:-9999px;left:0;border-collapse:collapse;width:' +
      row.offsetWidth +
      'px;background:#fff;opacity:1;box-shadow:0 6px 16px rgba(0,0,0,0.65);border-radius:4px;border:1px solid #555;table-layout:fixed';
    const tr = row.cloneNode(true) as HTMLTableRowElement;
    tr.style.cursor = 'grabbing';
    table.appendChild(tr);
    document.body.appendChild(table);
    e.dataTransfer.setDragImage(table, 0, 0);
    dragImageRef.current = table;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDraggedId(null);
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;
    const fromIdx = reasons.findIndex((r) => r.id === sourceId);
    const toIdx = reasons.findIndex((r) => r.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...reasons];
    const [removed] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, removed);
    setReasons(next);
    setSavingOrder(true);
    setError(null);
    try {
      await Promise.all(
        next.map((r, i) =>
          fetch(`${API_BASE_URL}/api/admin/travel-reasons/${r.id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ label: r.label, category: r.category ?? '', sortOrder: i }),
          })
        )
      );
      setSuccess('Order updated');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save order');
      await loadReasons();
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    if (dragImageRef.current?.parentNode) {
      dragImageRef.current.parentNode.removeChild(dragImageRef.current);
      dragImageRef.current = null;
    }
  };

  const handleSave = async () => {
    const label = formLabel.trim();
    if (!label) {
      setError('Label is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const res = await fetch(`${API_BASE_URL}/api/admin/travel-reasons/${editing.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ label, category: editing.category ?? '', sortOrder: editing.sortOrder }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || res.statusText);
        }
        setSuccess('Travel reason updated');
      } else {
        const res = await fetch(`${API_BASE_URL}/api/admin/travel-reasons`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ label, category: '', sortOrder: reasons.length }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || res.statusText);
        }
        setSuccess('Travel reason added');
      }
      setDialogOpen(false);
      await loadReasons();
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this travel reason? Existing mileage entries will keep their stored purpose text.')) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/travel-reasons/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      setSuccess('Travel reason removed');
      await loadReasons();
    } catch (e: any) {
      setError(e.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Travel Reasons (Trip Purpose)</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={handleAdd}>
              Add reason
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These options appear in the Purpose dropdown on GPS Tracking and Manual Mileage Entry. Users can still enter
            custom text when they choose &quot;Other.&quot;
          </Typography>

          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={40} sx={{ pr: 0 }} />
                    <TableCell>Label</TableCell>
                    <TableCell align="right" width={120}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reasons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                        No travel reasons yet. Add one or refresh to load defaults.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reasons.map((r) => (
                      <TableRow
                        key={r.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, r.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, r.id)}
                        onDragEnd={handleDragEnd}
                        sx={{
                          opacity: draggedId === r.id ? 0.5 : 1,
                          cursor: savingOrder ? 'default' : 'grab',
                          '&:active': { cursor: savingOrder ? 'default' : 'grabbing' },
                        }}
                      >
                        <TableCell width={40} sx={{ pr: 0, verticalAlign: 'middle' }}>
                          <DragIndicator fontSize="small" sx={{ color: 'action.disabled', cursor: 'grab' }} />
                        </TableCell>
                        <TableCell>{r.label}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleEdit(r)} aria-label="Edit">
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(r.id)}
                            disabled={deletingId === r.id}
                            aria-label="Delete"
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit travel reason' : 'Add travel reason'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Label"
            fullWidth
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            placeholder="e.g., House Stabilization"
          />
          {!editing && (
            <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
              New items are added at the bottom. Drag rows in the list to reorder.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !formLabel.trim()}>
            {saving ? 'Saving…' : editing ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
