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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Chip,
  Divider,
} from '@mui/material';
import {
  NotificationsActive as NotificationsIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { debugError } from '../config/debug';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

export interface NotificationControlTabProps {
  adminId: string;
}

interface NotificationEventRow {
  eventKey: string;
  displayName: string;
  description: string;
  notificationType: string;
  placeholders: string[];
  inAppEnabled: boolean;
  emailEnabled: boolean;
  titleTemplate: string | null;
  messageTemplate: string | null;
  updatedAt: string | null;
}

interface NotificationEmailRecipient {
  id: number;
  email: string;
  label?: string;
  isActive: boolean;
}

export const NotificationControlTab: React.FC<NotificationControlTabProps> = ({ adminId }) => {
  const [events, setEvents] = useState<NotificationEventRow[]>([]);
  const [recipients, setRecipients] = useState<NotificationEmailRecipient[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  /** Local template edits before Save (per eventKey) */
  const [drafts, setDrafts] = useState<Record<string, { titleTemplate: string; messageTemplate: string }>>({});

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
  }, []);

  const adminHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      'x-employee-id': adminId,
    }),
    [adminId]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const q = `employeeId=${encodeURIComponent(adminId)}`;
      const [evRes, rcRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/notification-events?${q}`, { headers: { 'x-employee-id': adminId } }),
        fetch(`${API_BASE_URL}/api/notifications/email-recipients?${q}`, { headers: { 'x-employee-id': adminId } }),
      ]);

      if (!evRes.ok) {
        if (evRes.status === 403) {
          showMessage('error', 'Admin access is required.');
          setEvents([]);
        } else {
          throw new Error('Failed to load notification events');
        }
      } else {
        const evData = await evRes.json();
        setEvents(Array.isArray(evData) ? evData : []);
        const nextDrafts: Record<string, { titleTemplate: string; messageTemplate: string }> = {};
        (Array.isArray(evData) ? evData : []).forEach((row: NotificationEventRow) => {
          nextDrafts[row.eventKey] = {
            titleTemplate: row.titleTemplate ?? '',
            messageTemplate: row.messageTemplate ?? '',
          };
        });
        setDrafts(nextDrafts);
      }

      if (!rcRes.ok) {
        if (rcRes.status !== 403) {
          debugError('BCC recipients load failed', rcRes.status);
        }
        setRecipients([]);
      } else {
        const rcData = await rcRes.json();
        setRecipients(Array.isArray(rcData) ? rcData : []);
      }
    } catch (error) {
      debugError('Error loading notifications admin data:', error);
      showMessage('error', 'Failed to load notification settings.');
      setEvents([]);
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  }, [adminId, showMessage]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const patchEvent = async (eventKey: string, body: Record<string, unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/notification-events/${encodeURIComponent(eventKey)}?employeeId=${encodeURIComponent(adminId)}`,
        { method: 'PUT', headers: adminHeaders(), body: JSON.stringify({ employeeId: adminId, ...body }) }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to update');
      setEvents((prev) => prev.map((e) => (e.eventKey === eventKey ? { ...e, ...data } : e)));
      setDrafts((d) => ({
        ...d,
        [eventKey]: {
          titleTemplate: data.titleTemplate ?? '',
          messageTemplate: data.messageTemplate ?? '',
        },
      }));
    } catch (error) {
      debugError('patchEvent', error);
      showMessage('error', error instanceof Error ? error.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  const saveTemplates = async (eventKey: string) => {
    const d = drafts[eventKey];
    if (!d) return;
    await patchEvent(eventKey, {
      titleTemplate: d.titleTemplate.trim() === '' ? null : d.titleTemplate,
      messageTemplate: d.messageTemplate.trim() === '' ? null : d.messageTemplate,
    });
    showMessage('success', 'Templates saved.');
  };

  const resetTemplates = async (eventKey: string) => {
    await patchEvent(eventKey, { titleTemplate: null, messageTemplate: null });
    showMessage('success', 'Templates reset to system defaults.');
  };

  const handleAddRecipient = async () => {
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
        headers: adminHeaders(),
        body: JSON.stringify({ employeeId: adminId, email, label, isActive: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to add recipient');
      setEmailInput('');
      setLabelInput('');
      await loadAll();
      showMessage('success', 'BCC recipient added.');
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to add.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRecipient = async (id: number) => {
    setBusy(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/email-recipients/${id}?employeeId=${encodeURIComponent(adminId)}`,
        { method: 'DELETE', headers: { 'x-employee-id': adminId } }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to delete');
      await loadAll();
      showMessage('success', 'BCC recipient removed.');
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to delete.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleRecipient = async (row: NotificationEmailRecipient, isActive: boolean) => {
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/email-recipients/${row.id}`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({ employeeId: adminId, email: row.email, label: row.label || '', isActive }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to update');
      await loadAll();
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to update.');
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
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NotificationsIcon color="primary" />
          <Box>
            <Typography variant="h5">Notifications</Typography>
            <Typography variant="body2" color="text.secondary">
              Turn workflow alerts on or off for the portal bell and for email, and optionally override wording with
              templates. Brand-new notification types still require a code change; this screen controls the events the
              system already sends.
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          color="primary"
          size="medium"
          startIcon={<RefreshIcon />}
          onClick={() => void loadAll()}
          disabled={busy}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            px: 2.5,
            py: 1,
            borderRadius: 1,
            boxShadow: 2,
            flexShrink: 0,
            alignSelf: 'flex-start',
            mt: { xs: 0, sm: 0.5 },
          }}
        >
          Refresh
        </Button>
      </Box>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
        Workflow notification events
      </Typography>
      <Stack spacing={1} sx={{ mb: 3 }}>
        {events.map((ev) => (
          <Accordion key={ev.eventKey} disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {ev.displayName}
                </Typography>
                <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                  <Chip size="small" label={ev.inAppEnabled ? 'In-app on' : 'In-app off'} color={ev.inAppEnabled ? 'primary' : 'default'} variant="outlined" />
                  <Chip size="small" label={ev.emailEnabled ? 'Email on' : 'Email off'} color={ev.emailEnabled ? 'primary' : 'default'} variant="outlined" />
                </Stack>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {ev.description}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                Stored type: <code>{ev.notificationType}</code>
              </Typography>
              {ev.placeholders.length > 0 && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                  Template placeholders:{' '}
                  {ev.placeholders.map((p) => (
                    <Chip key={p} label={`{${p}}`} size="small" sx={{ mr: 0.5, mt: 0.5 }} />
                  ))}
                </Typography>
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={ev.inAppEnabled}
                      onChange={(e) => void patchEvent(ev.eventKey, { inAppEnabled: e.target.checked })}
                      disabled={busy}
                    />
                  }
                  label="Show in portal (bell / list)"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={ev.emailEnabled}
                      onChange={(e) => void patchEvent(ev.eventKey, { emailEnabled: e.target.checked })}
                      disabled={busy}
                    />
                  }
                  label="Send email"
                />
              </Stack>
              <TextField
                fullWidth
                size="small"
                label="Title template (optional — empty uses default)"
                multiline
                minRows={2}
                value={drafts[ev.eventKey]?.titleTemplate ?? ''}
                onChange={(e) =>
                  setDrafts((d) => ({
                    ...d,
                    [ev.eventKey]: { ...d[ev.eventKey], titleTemplate: e.target.value, messageTemplate: d[ev.eventKey]?.messageTemplate ?? '' },
                  }))
                }
                sx={{ mb: 2 }}
                disabled={busy}
              />
              <TextField
                fullWidth
                size="small"
                label="Message template (optional — empty uses default)"
                multiline
                minRows={4}
                value={drafts[ev.eventKey]?.messageTemplate ?? ''}
                onChange={(e) =>
                  setDrafts((d) => ({
                    ...d,
                    [ev.eventKey]: { titleTemplate: d[ev.eventKey]?.titleTemplate ?? '', messageTemplate: e.target.value },
                  }))
                }
                sx={{ mb: 2 }}
                disabled={busy}
              />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" size="small" onClick={() => void saveTemplates(ev.eventKey)} disabled={busy}>
                  Save templates
                </Button>
                <Button variant="outlined" size="small" onClick={() => void resetTemplates(ev.eventKey)} disabled={busy}>
                  Reset to defaults
                </Button>
              </Stack>
              {ev.updatedAt && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Last updated: {new Date(ev.updatedAt).toLocaleString()}
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
        Optional: global BCC on workflow emails
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        These addresses are copied on notification emails only (not a substitute for turning events on above). The
        primary recipient is not duplicated.
      </Typography>

      <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
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
          <Button variant="contained" onClick={() => void handleAddRecipient()} disabled={busy}>
            Add BCC email
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
                      onChange={(e) => void handleToggleRecipient(row, e.target.checked)}
                      size="small"
                      disabled={busy}
                    />
                  }
                  label={row.isActive ? 'Active' : 'Inactive'}
                />
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => void handleDeleteRecipient(row.id)}
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
              No BCC addresses configured.
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
};
