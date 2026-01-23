import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Backup as BackupIcon,
  Info as InfoIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  Settings as SettingsIcon,
  Storage as DatabaseIcon
} from '@mui/icons-material';
import { debugError } from '../config/debug';

interface SystemSettingsData {
  // Email/SMTP Configuration
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
  };
  // Report Schedule Defaults
  reportSchedule: {
    defaultTime: string;
    defaultTimezone: string;
    defaultRowLimit: number;
    maxRecipients: number;
    checkIntervalMs: number;
  };
  // Approval Workflow Settings
  approval: {
    defaultFrequency: string;
    escalationHours: number;
    autoApproveThreshold: number;
  };
  // System Information (read-only)
  systemInfo: {
    databasePath: string;
    serverVersion: string;
    nodeVersion: string;
    uptime: number;
  };
}

const DEFAULT_SETTINGS: SystemSettingsData = {
  email: {
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: 'Oxford House Expense System'
  },
  reportSchedule: {
    defaultTime: '08:00',
    defaultTimezone: 'America/New_York',
    defaultRowLimit: 250,
    maxRecipients: 20,
    checkIntervalMs: 60000
  },
  approval: {
    defaultFrequency: 'monthly',
    escalationHours: 48,
    autoApproveThreshold: 0
  },
  systemInfo: {
    databasePath: '',
    serverVersion: '1.0.0',
    nodeVersion: '',
    uptime: 0
  }
};

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'America/Honolulu',
  'UTC'
];

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';

export const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/admin/system-settings`);
      if (!response.ok) throw new Error('Failed to load settings');
      const data = await response.json();
      setSettings({ ...DEFAULT_SETTINGS, ...data });
    } catch (err: any) {
      debugError('Error loading settings:', err);
      setError(err.message || 'Failed to load system settings');
      // Use defaults if API fails
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const response = await fetch(`${API_BASE_URL}/api/admin/system-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error('Failed to save settings');
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      debugError('Error saving settings:', err);
      setError(err.message || 'Failed to save system settings');
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    try {
      setBackupLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/system/backup`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to create backup');
      const data = await response.json();
      setSuccess(`Backup created: ${data.filename}`);
      setBackupDialogOpen(false);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      debugError('Error creating backup:', err);
      setError(err.message || 'Failed to create backup');
    } finally {
      setBackupLoading(false);
    }
  };

  const updateSettings = (section: keyof SystemSettingsData, updates: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates }
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        System Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure system-wide settings, email, and database management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Stack spacing={3}>
        {/* Email/SMTP Configuration */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" mb={2}>
            <EmailIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Email/SMTP Configuration</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure SMTP settings for sending scheduled reports and notifications
          </Typography>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
            <TextField
              fullWidth
              label="SMTP Host"
              value={settings.email.smtpHost}
              onChange={(e) => updateSettings('email', { smtpHost: e.target.value })}
              placeholder="smtp.gmail.com"
            />
            <TextField
              fullWidth
              label="SMTP Port"
              type="number"
              value={settings.email.smtpPort}
              onChange={(e) => updateSettings('email', { smtpPort: parseInt(e.target.value) || 587 })}
            />
            <TextField
              fullWidth
              label="SMTP Username"
              value={settings.email.smtpUser}
              onChange={(e) => updateSettings('email', { smtpUser: e.target.value })}
            />
            <TextField
              fullWidth
              label="SMTP Password"
              type="password"
              value={settings.email.smtpPassword}
              onChange={(e) => updateSettings('email', { smtpPassword: e.target.value })}
            />
            <TextField
              fullWidth
              label="From Email"
              type="email"
              value={settings.email.fromEmail}
              onChange={(e) => updateSettings('email', { fromEmail: e.target.value })}
            />
            <TextField
              fullWidth
              label="From Name"
              value={settings.email.fromName}
              onChange={(e) => updateSettings('email', { fromName: e.target.value })}
            />
            <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.email.smtpSecure}
                    onChange={(e) => updateSettings('email', { smtpSecure: e.target.checked })}
                  />
                }
                label="Use TLS/SSL (Secure Connection)"
              />
            </Box>
          </Box>
        </Paper>

        {/* Report Schedule Defaults */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" mb={2}>
            <ScheduleIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Report Schedule Defaults</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Default settings for scheduled report deliveries
          </Typography>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
            <TextField
              fullWidth
              label="Default Time"
              type="time"
              value={settings.reportSchedule.defaultTime}
              onChange={(e) => updateSettings('reportSchedule', { defaultTime: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth>
              <InputLabel>Default Timezone</InputLabel>
              <Select
                value={settings.reportSchedule.defaultTimezone}
                onChange={(e) => updateSettings('reportSchedule', { defaultTimezone: e.target.value })}
                label="Default Timezone"
              >
                {TIMEZONES.map(tz => (
                  <MenuItem key={tz} value={tz}>{tz}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Default Row Limit"
              type="number"
              value={settings.reportSchedule.defaultRowLimit}
              onChange={(e) => updateSettings('reportSchedule', { defaultRowLimit: parseInt(e.target.value) || 250 })}
              helperText="Maximum rows per scheduled report"
            />
            <TextField
              fullWidth
              label="Max Recipients"
              type="number"
              value={settings.reportSchedule.maxRecipients}
              onChange={(e) => updateSettings('reportSchedule', { maxRecipients: parseInt(e.target.value) || 20 })}
              helperText="Maximum email recipients per schedule"
            />
          </Box>
        </Paper>

        {/* Approval Workflow Settings */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" mb={2}>
            <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Approval Workflow Settings</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure default approval workflow behavior
          </Typography>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
            <FormControl fullWidth>
              <InputLabel>Default Report Frequency</InputLabel>
              <Select
                value={settings.approval.defaultFrequency}
                onChange={(e) => updateSettings('approval', { defaultFrequency: e.target.value })}
                label="Default Report Frequency"
              >
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="biweekly">Biweekly</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Escalation Hours"
              type="number"
              value={settings.approval.escalationHours}
              onChange={(e) => updateSettings('approval', { escalationHours: parseInt(e.target.value) || 48 })}
              helperText="Hours before report escalates to next approver"
            />
            <TextField
              fullWidth
              label="Auto-Approve Threshold ($)"
              type="number"
              value={settings.approval.autoApproveThreshold}
              onChange={(e) => updateSettings('approval', { autoApproveThreshold: parseFloat(e.target.value) || 0 })}
              helperText="Reports under this amount auto-approve (0 = disabled)"
            />
          </Box>
        </Paper>

        {/* System Information */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" mb={2}>
            <InfoIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">System Information</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Read-only system information and status
          </Typography>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary">Database Path</Typography>
                <Typography variant="body1" sx={{ wordBreak: 'break-all' }}>
                  {settings.systemInfo.databasePath || 'Not available'}
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary">Server Version</Typography>
                <Typography variant="body1">{settings.systemInfo.serverVersion}</Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary">Node.js Version</Typography>
                <Typography variant="body1">{settings.systemInfo.nodeVersion || 'Not available'}</Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary">Server Uptime</Typography>
                <Typography variant="body1">
                  {settings.systemInfo.uptime > 0
                    ? `${Math.floor(settings.systemInfo.uptime / 3600)}h ${Math.floor((settings.systemInfo.uptime % 3600) / 60)}m`
                    : 'Not available'}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Paper>

        {/* Database Management */}
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" mb={2}>
            <DatabaseIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Database Management</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Database backup and maintenance operations
          </Typography>

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<BackupIcon />}
              onClick={() => setBackupDialogOpen(true)}
            >
              Create Backup
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadSettings}
            >
              Refresh System Info
            </Button>
          </Stack>
        </Paper>

        {/* Action Buttons */}
        <Box display="flex" justifyContent="flex-end" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadSettings}
          >
            Reset
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveSettings}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save All Settings'}
          </Button>
        </Box>
      </Stack>

      {/* Backup Confirmation Dialog */}
      <Dialog open={backupDialogOpen} onClose={() => setBackupDialogOpen(false)}>
        <DialogTitle>Create Database Backup</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will create a timestamped backup of the database. The backup will be saved in the backend directory.
            Continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBackupDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleBackup}
            variant="contained"
            disabled={backupLoading}
            startIcon={backupLoading ? <CircularProgress size={16} /> : <BackupIcon />}
          >
            {backupLoading ? 'Creating...' : 'Create Backup'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

