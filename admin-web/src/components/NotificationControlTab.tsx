import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  NotificationsActive as NotificationsIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { debugError } from '../config/debug';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

export interface NotificationControlTabProps {
  adminId: string;
}

interface NotificationEmailRecipient {
  id: number;
  email: string;
  label?: string;
  isActive: boolean;
}

export const NotificationControlTab: React.FC<NotificationControlTabProps> = ({ adminId }) => {
  const [recipients, setRecipients] = useState<NotificationEmailRecipient[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
  }, []);

  const loadRecipients = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/email-recipients?employeeId=${encodeURIComponent(adminId)}`,
        { headers: { 'x-employee-id': adminId } }
      );
      if (!response.ok) {
        if (response.status === 403) {
          setRecipients([]);
          showMessage('error', 'Admin access is required to manage notification recipients.');
          return;
        }
        throw new Error('Failed to load notification recipients');
      }
      const data = await response.json();
      setRecipients(Array.isArray(data) ? data : []);
    } catch (error) {
      debugError('Error loading notification recipients:', error);
      showMessage('error', 'Failed to load notification email recipients.');
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  }, [adminId, showMessage]);

  useEffect(() => {
    void loadRecipients();
  }, [loadRecipients]);

  const handleAdd = async () => {
    const email = emailInput.trim().toLowerCase();
    const label = labelInput.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMessage('error', 'Please enter a valid email address.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/email-recipients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-employee-id': adminId,
        },
        body: JSON.stringify({ employeeId: adminId, email, label, isActive: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to add notification recipient');
      setEmailInput('');
      setLabelInput('');
      await loadRecipients();
      showMessage('success', 'Notification email recipient added.');
    } catch (error) {
      debugError('Error adding notification recipient:', error);
      showMessage('error', error instanceof Error ? error.message : 'Failed to add notification recipient.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/email-recipients/${id}?employeeId=${encodeURIComponent(adminId)}`,
        { method: 'DELETE', headers: { 'x-employee-id': adminId } }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to delete notification recipient');
      await loadRecipients();
      showMessage('success', 'Notification email recipient removed.');
    } catch (error) {
      debugError('Error deleting notification recipient:', error);
      showMessage('error', error instanceof Error ? error.message : 'Failed to delete notification recipient.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (row: NotificationEmailRecipient, isActive: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/email-recipients/${row.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-employee-id': adminId,
        },
        body: JSON.stringify({ employeeId: adminId, email: row.email, label: row.label || '', isActive }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to update notification recipient');
      await loadRecipients();
    } catch (error) {
      debugError('Error updating notification recipient:', error);
      showMessage('error', error instanceof Error ? error.message : 'Failed to update notification recipient.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={320}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NotificationsIcon color="primary" />
          <Box>
            <Typography variant="h5">Notification Control</Typography>
            <Typography variant="body2" color="text.secondary">
              Active addresses are added as BCC on workflow notification emails (the primary recipient is not
              duplicated). Inactive rows are kept but not used.
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => void loadRecipients()}
          disabled={busy}
        >
          Refresh
        </Button>
      </Box>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
          Global BCC recipients
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <TextField
            size="small"
            label="Email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            sx={{ minWidth: 280 }}
            disabled={busy}
          />
          <TextField
            size="small"
            label="Label (optional)"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            sx={{ minWidth: 220 }}
            disabled={busy}
          />
          <Button variant="contained" onClick={() => void handleAdd()} disabled={busy}>
            Add email
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {recipients.map((row) => (
            <Box
              key={row.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {row.email}
                </Typography>
                {!!row.label && (
                  <Typography variant="caption" color="text.secondary">
                    {row.label}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={row.isActive}
                      onChange={(e) => void handleToggle(row, e.target.checked)}
                      size="small"
                      disabled={busy}
                    />
                  }
                  label={row.isActive ? 'Active' : 'Inactive'}
                />
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => void handleDelete(row.id)}
                  disabled={busy}
                  aria-label={`Remove ${row.email}`}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          ))}
          {recipients.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No notification recipients configured.
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
};
