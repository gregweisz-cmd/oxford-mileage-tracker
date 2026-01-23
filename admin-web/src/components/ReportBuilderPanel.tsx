import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  FormControlLabel,
  MenuItem,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  PlaylistAdd as PlaylistAddIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
  ReportBuilderFilters,
  ReportBuilderField,
  ReportBuilderPreset,
  ReportBuilderRow,
  fetchReportBuilderFields,
  fetchReportBuilderPresets,
  createReportBuilderPreset,
  updateReportBuilderPreset,
  deleteReportBuilderPreset,
  queryReportBuilderData,
  exportReportBuilderToCsv,
  ReportSchedule,
  ReportSchedulePayload,
  fetchReportSchedules,
  createReportSchedule,
  updateReportSchedule,
  deleteReportSchedule,
  triggerReportSchedule,
} from '../services/reportingAnalyticsService';
import { debugError } from '../config/debug';

interface ReportBuilderPanelProps {
  costCenterOptions: string[];
  defaultDateRange: { start: string; end: string };
}

type PresetDialogMode = 'create' | 'update';

interface ScheduleFormState {
  name: string;
  description: string;
  recipients: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek: number;
  dayOfMonth: number;
  timeOfDay: string;
  timezone: string;
  includeCsv: boolean;
  includePdf: boolean;
  rowLimit: number;
}

const DAY_OF_WEEK_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

function formatCellForDisplay(value: unknown, field?: ReportBuilderField): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (!field) {
    return String(value);
  }

  switch (field.type) {
    case 'currency': {
      const num = Number(value);
      return Number.isFinite(num) ? currencyFormatter.format(num) : String(value);
    }
    case 'number': {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        return String(value);
      }
      return numberFormatter.format(num);
    }
    case 'date': {
      if (typeof value === 'string' && value.length === 0) {
        return '';
      }
      const date = new Date(value as string);
      if (Number.isNaN(date.getTime())) {
        return String(value);
      }
      return date.toLocaleString();
    }
    default:
      return String(value);
  }
}

export const ReportBuilderPanel: React.FC<ReportBuilderPanelProps> = ({
  costCenterOptions,
  defaultDateRange,
}) => {
  const [fields, setFields] = useState<ReportBuilderField[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [defaultColumns, setDefaultColumns] = useState<string[]>([]);
  const [builderFilters, setBuilderFilters] = useState<ReportBuilderFilters>({
    startDate: defaultDateRange.start,
    endDate: defaultDateRange.end,
    statuses: [],
    costCenters: [],
  });
  const [rowLimit, setRowLimit] = useState<number>(250);

  const [rows, setRows] = useState<ReportBuilderRow[]>([]);
  const [queryTotal, setQueryTotal] = useState<number>(0);
  const [queryTruncated, setQueryTruncated] = useState<boolean>(false);
  const [queryGeneratedAt, setQueryGeneratedAt] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [metadataLoading, setMetadataLoading] = useState<boolean>(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [presets, setPresets] = useState<ReportBuilderPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presetDialogOpen, setPresetDialogOpen] = useState<boolean>(false);
  const [presetDialogMode, setPresetDialogMode] = useState<PresetDialogMode>('create');
  const [presetForm, setPresetForm] = useState<{ name: string; description: string }>({
    name: '',
    description: '',
  });
  const [presetSubmitting, setPresetSubmitting] = useState<boolean>(false);

  const scheduleTimezoneDefault = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    } catch {
      return 'America/New_York';
    }
  }, []);

  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [schedulesLoading, setSchedulesLoading] = useState<boolean>(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState<boolean>(false);
  const [scheduleDialogMode, setScheduleDialogMode] = useState<PresetDialogMode>('create');
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    name: '',
    description: '',
    recipients: '',
    frequency: 'weekly',
    dayOfWeek: 1,
    dayOfMonth: 1,
    timeOfDay: '08:00',
    timezone: scheduleTimezoneDefault,
    includeCsv: true,
    includePdf: false,
    rowLimit,
  });
  const [scheduleSubmitting, setScheduleSubmitting] = useState<boolean>(false);

  const fieldMap = useMemo(
    () => new Map(fields.map((field) => [field.id, field])),
    [fields]
  );

  useEffect(() => {
    setScheduleForm((prev) => ({ ...prev, rowLimit }));
  }, [rowLimit]);

  const frequencyOptions = useMemo(
    () => [
      { value: 'daily' as const, label: 'Daily' },
      { value: 'weekly' as const, label: 'Weekly' },
      { value: 'monthly' as const, label: 'Monthly' },
    ],
    []
  );

  const dayOfWeekOptions = useMemo(
    () => DAY_OF_WEEK_LABELS.map((label, index) => ({ value: index, label })),
    []
  );

  const formatScheduleFrequency = useCallback((schedule: ReportSchedule) => {
    switch (schedule.frequency) {
      case 'daily':
        return 'Daily';
      case 'weekly':
        return `Weekly (${DAY_OF_WEEK_LABELS[schedule.dayOfWeek ?? 0]})`;
      case 'monthly':
        return `Monthly (${schedule.dayOfMonth ?? 1})`;
      default:
        return schedule.frequency;
    }
  }, []);

  const formatDateTime = useCallback(
    (value: string | null) => (value ? new Date(value).toLocaleString() : '—'),
    []
  );

  const selectedFieldObjects = useMemo(
    () => fields.filter((field) => selectedColumns.includes(field.id)),
    [fields, selectedColumns]
  );

  const gridColumns: GridColDef[] = useMemo(() => {
    if (selectedColumns.length === 0) {
      return [];
    }

    return selectedColumns.map((fieldId) => {
      const meta = fieldMap.get(fieldId);
      const align =
        meta && (meta.type === 'currency' || meta.type === 'number') ? 'right' : 'left';

      return {
        field: fieldId,
        headerName: meta?.label ?? fieldId,
        flex: meta?.type === 'currency' ? 0.9 : 1,
        minWidth: meta?.type === 'currency' ? 140 : 160,
        headerAlign: align,
        align,
        valueFormatter: (params: any) =>
          formatCellForDisplay(params?.value, meta),
      } as GridColDef;
    });
  }, [fieldMap, selectedColumns]);

  const loadSchedules = useCallback(async () => {
    setSchedulesLoading(true);
    setScheduleError(null);
    try {
      const data = await fetchReportSchedules();
      setSchedules(data);
      setActiveScheduleId((prev) => {
        if (prev && data.some((item) => item.id === prev)) {
          return prev;
        }
        return data.length > 0 ? data[0].id : null;
      });
    } catch (err) {
      debugError('Failed to load report schedules', err);
      setScheduleError(
        err instanceof Error ? err.message : 'Failed to load scheduled deliveries'
      );
    } finally {
      setSchedulesLoading(false);
    }
  }, []);

  const loadMetadata = useCallback(async () => {
    setMetadataLoading(true);
    setMetadataError(null);
    try {
      const [metadata, presetList] = await Promise.all([
        fetchReportBuilderFields(),
        fetchReportBuilderPresets(),
      ]);
      setFields(metadata.fields);
      setStatusOptions(metadata.statusOptions ?? []);
      const fallbackColumns =
        metadata.defaultColumns && metadata.defaultColumns.length > 0
          ? metadata.defaultColumns
          : metadata.fields.slice(0, Math.min(metadata.fields.length, 8)).map((field) => field.id);
      setDefaultColumns(fallbackColumns);
      setSelectedColumns((prev) => (prev.length > 0 ? prev : fallbackColumns));
      setRowLimit((prev) =>
        prev > 0 ? prev : Math.min(metadata.limits?.maxRows ?? 500, 500)
      );
      setPresets(presetList);
      await loadSchedules();
    } catch (err) {
      debugError('Failed to load report builder metadata', err);
      setMetadataError(
        err instanceof Error ? err.message : 'Failed to load report builder metadata'
      );
    } finally {
      setMetadataLoading(false);
    }
  }, [loadSchedules]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  const handleRunReport = useCallback(async () => {
    if (selectedColumns.length === 0) {
      setError('Select at least one column before running the report.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await queryReportBuilderData({
        selectedColumns,
        filters: builderFilters,
        limit: rowLimit,
      });
      setRows(response.rows);
      setQueryTotal(response.total);
      setQueryTruncated(response.truncated);
      setQueryGeneratedAt(response.generatedAt);
    } catch (err) {
      debugError('Failed to run report builder query', err);
      setError(err instanceof Error ? err.message : 'Failed to run report');
    } finally {
      setLoading(false);
    }
  }, [builderFilters, rowLimit, selectedColumns]);

  useEffect(() => {
    if (!metadataLoading && fields.length > 0 && selectedColumns.length > 0 && rows.length === 0) {
      void handleRunReport();
    }
  }, [metadataLoading, fields.length, selectedColumns.length, handleRunReport, rows.length]);

  const handlePresetApply = useCallback(
    (presetId: string | null) => {
      setActivePresetId(presetId);
      if (!presetId) {
        return;
      }
      const preset = presets.find((item) => item.id === presetId);
      if (!preset) {
        return;
      }
      if (preset.columns && preset.columns.length > 0) {
        setSelectedColumns(preset.columns);
      }
      setBuilderFilters((prev) => ({
        ...prev,
        ...preset.filters,
        statuses: preset.filters.statuses ?? [],
        costCenters: preset.filters.costCenters ?? [],
      }));
      void handleRunReport();
    },
    [handleRunReport, presets]
  );

  const handleOpenPresetDialog = useCallback(
    (mode: PresetDialogMode) => {
      setPresetDialogMode(mode);
      if (mode === 'update' && activePresetId) {
        const preset = presets.find((item) => item.id === activePresetId);
        if (preset) {
          setPresetForm({
            name: preset.name,
            description: preset.description,
          });
        }
      } else {
        setPresetForm({ name: '', description: '' });
      }
      setPresetDialogOpen(true);
    },
    [activePresetId, presets]
  );

  const handleClosePresetDialog = () => {
    if (!presetSubmitting) {
      setPresetDialogOpen(false);
    }
  };

  const handlePresetSave = async () => {
    if (presetForm.name.trim().length === 0) {
      setError('Preset name is required.');
      return;
    }
    setPresetSubmitting(true);
    try {
      if (presetDialogMode === 'create') {
        const created = await createReportBuilderPreset({
          name: presetForm.name.trim(),
          description: presetForm.description.trim(),
          columns: selectedColumns,
          filters: builderFilters,
        });
        setPresets((prev) => [created, ...prev]);
        setActivePresetId(created.id);
      } else if (presetDialogMode === 'update' && activePresetId) {
        const updated = await updateReportBuilderPreset(activePresetId, {
          name: presetForm.name.trim(),
          description: presetForm.description.trim(),
          columns: selectedColumns,
          filters: builderFilters,
        });
        setPresets((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
        setActivePresetId(updated.id);
      }
      setPresetDialogOpen(false);
    } catch (err) {
      debugError('Failed to save preset', err);
      setError(err instanceof Error ? err.message : 'Failed to save preset');
    } finally {
      setPresetSubmitting(false);
    }
  };

  const handlePresetDelete = async () => {
    if (!activePresetId) {
      setError('Select a preset to delete.');
      return;
    }
    const confirmed = window.confirm('Delete the selected preset?');
    if (!confirmed) {
      return;
    }
    try {
      await deleteReportBuilderPreset(activePresetId);
      setPresets((prev) => prev.filter((item) => item.id !== activePresetId));
      setActivePresetId(null);
    } catch (err) {
      debugError('Failed to delete preset', err);
      setError(err instanceof Error ? err.message : 'Failed to delete preset');
    }
  };

  const handleOpenScheduleDialog = useCallback(
    (mode: PresetDialogMode) => {
      setScheduleError(null);
      setScheduleDialogMode(mode);
      if (mode === 'update' && activeScheduleId) {
        const schedule = schedules.find((item) => item.id === activeScheduleId);
        if (schedule) {
          setScheduleForm({
            name: schedule.name,
            description: schedule.description || '',
            recipients: schedule.recipients.join(', '),
            frequency: schedule.frequency,
            dayOfWeek: schedule.dayOfWeek ?? 1,
            dayOfMonth: schedule.dayOfMonth ?? 1,
            timeOfDay: schedule.timeOfDay,
            timezone: schedule.timezone,
            includeCsv: schedule.includeCsv,
            includePdf: schedule.includePdf,
            rowLimit: schedule.rowLimit ?? rowLimit,
          });
        }
      } else {
        setScheduleForm({
          name: '',
          description: '',
          recipients: '',
          frequency: 'weekly',
          dayOfWeek: 1,
          dayOfMonth: 1,
          timeOfDay: '08:00',
          timezone: scheduleTimezoneDefault,
          includeCsv: true,
          includePdf: false,
          rowLimit,
        });
      }
      setScheduleDialogOpen(true);
    },
    [activeScheduleId, schedules, scheduleTimezoneDefault, rowLimit]
  );

  const handleCloseScheduleDialog = () => {
    if (!scheduleSubmitting) {
      setScheduleDialogOpen(false);
    }
  };

  const handleScheduleSave = async () => {
    if (scheduleForm.name.trim().length === 0) {
      setScheduleError('Schedule name is required.');
      return;
    }
    const recipients = scheduleForm.recipients
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      setScheduleError('Enter at least one recipient email.');
      return;
    }
    if (!scheduleForm.includeCsv && !scheduleForm.includePdf) {
      setScheduleError('Choose at least one attachment format (CSV or PDF).');
      return;
    }
    setScheduleError(null);
    setScheduleSubmitting(true);
    try {
      const payload: ReportSchedulePayload = {
        name: scheduleForm.name.trim(),
        description: scheduleForm.description.trim(),
        recipients,
        frequency: scheduleForm.frequency,
        dayOfWeek: scheduleForm.frequency === 'weekly' ? scheduleForm.dayOfWeek : undefined,
        dayOfMonth: scheduleForm.frequency === 'monthly' ? scheduleForm.dayOfMonth : undefined,
        timeOfDay: scheduleForm.timeOfDay,
        timezone: scheduleForm.timezone,
        includeCsv: scheduleForm.includeCsv,
        includePdf: scheduleForm.includePdf,
        columns: selectedColumns,
        filters: builderFilters,
        rowLimit: scheduleForm.rowLimit,
        active: true,
      };
      if (scheduleDialogMode === 'create') {
        await createReportSchedule(payload);
      } else if (activeScheduleId) {
        await updateReportSchedule(activeScheduleId, payload);
      }
      setScheduleDialogOpen(false);
      await loadSchedules();
    } catch (err) {
      debugError('Failed to save schedule', err);
      setScheduleError(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const handleScheduleDelete = async () => {
    if (!activeScheduleId) {
      setScheduleError('Select a schedule to delete.');
      return;
    }
    const confirmed = window.confirm('Delete the selected schedule?');
    if (!confirmed) {
      return;
    }
    setScheduleError(null);
    setScheduleSubmitting(true);
    try {
      await deleteReportSchedule(activeScheduleId);
      await loadSchedules();
    } catch (err) {
      debugError('Failed to delete schedule', err);
      setScheduleError(err instanceof Error ? err.message : 'Failed to delete schedule');
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const handleScheduleTrigger = async (scheduleId: string) => {
    setScheduleError(null);
    setScheduleSubmitting(true);
    try {
      await triggerReportSchedule(scheduleId);
      await loadSchedules();
    } catch (err) {
      debugError('Failed to trigger schedule', err);
      setScheduleError(err instanceof Error ? err.message : 'Failed to trigger schedule');
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const handleFilterChange = <Key extends keyof ReportBuilderFilters>(
    key: Key,
    value: ReportBuilderFilters[Key]
  ) => {
    setBuilderFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleExportCsv = () => {
    if (rows.length === 0 || selectedColumns.length === 0) {
      setError('Run the report before exporting.');
      return;
    }
    const csvContent = exportReportBuilderToCsv(rows, selectedColumns, fields);
    if (!csvContent) {
      setError('Nothing to export.');
      return;
    }
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `reports-builder-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleResetFilters = () => {
    setBuilderFilters({
      startDate: defaultDateRange.start,
      endDate: defaultDateRange.end,
      statuses: [],
      costCenters: [],
    });
    setSelectedColumns(
      defaultColumns.length > 0
        ? defaultColumns
        : fields.slice(0, Math.min(8, fields.length)).map((f) => f.id)
    );
    setActivePresetId(null);
  };

  return (
    <Paper
      elevation={0}
      sx={{ p: 3, border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 3 }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h6">Report Builder</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure custom analytics cuts, save presets, and export detailed CSVs.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Tooltip title="Run the report with the selected filters and columns">
            <span>
              <Button
                variant="contained"
                color="primary"
                startIcon={<RefreshIcon />}
                onClick={handleRunReport}
                disabled={loading || metadataLoading || selectedColumns.length === 0}
              >
                Run Report
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Export current results to CSV">
            <span>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExportCsv}
                disabled={loading || rows.length === 0 || selectedColumns.length === 0}
              >
                Export CSV
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <Typography variant="subtitle2" color="text.secondary">
          Filters
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Start Date"
            type="date"
            value={builderFilters.startDate ?? ''}
            onChange={(event) => handleFilterChange('startDate', event.target.value || undefined)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="End Date"
            type="date"
            value={builderFilters.endDate ?? ''}
            onChange={(event) => handleFilterChange('endDate', event.target.value || undefined)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Row Limit"
            type="number"
            value={rowLimit}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next) && next > 0) {
                setRowLimit(Math.floor(next));
              } else {
                setRowLimit(100);
              }
            }}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Autocomplete
            multiple
            options={statusOptions}
            value={builderFilters.statuses ?? []}
            onChange={(_, value) => handleFilterChange('statuses', value)}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip variant="outlined" label={option} {...getTagProps({ index })} key={option} />
              ))
            }
            renderInput={(params) => <TextField {...params} label="Statuses" placeholder="Select statuses" />}
            sx={{ minWidth: { xs: '100%', md: 220 } }}
          />
          <Autocomplete
            multiple
            freeSolo
            options={costCenterOptions}
            value={builderFilters.costCenters ?? []}
            onChange={(_, value) => handleFilterChange('costCenters', value)}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip variant="outlined" label={option} {...getTagProps({ index })} key={`${option}-${index}`} />
              ))
            }
            renderInput={(params) => (
              <TextField {...params} label="Cost Centers" placeholder="Filter by cost center" />
            )}
            sx={{ minWidth: { xs: '100%', md: 260 } }}
          />
          <TextField
            label="Search"
            placeholder="Employee, report ID, email..."
            value={builderFilters.search ?? ''}
            onChange={(event) => handleFilterChange('search', event.target.value || undefined)}
            fullWidth
          />
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Min Total ($)"
            type="number"
            value={builderFilters.minTotalExpenses ?? ''}
            onChange={(event) =>
              handleFilterChange(
                'minTotalExpenses',
                event.target.value === '' ? undefined : Number(event.target.value)
              )
            }
            fullWidth
          />
          <TextField
            label="Max Total ($)"
            type="number"
            value={builderFilters.maxTotalExpenses ?? ''}
            onChange={(event) =>
              handleFilterChange(
                'maxTotalExpenses',
                event.target.value === '' ? undefined : Number(event.target.value)
              )
            }
            fullWidth
          />
          <Button variant="text" color="secondary" onClick={handleResetFilters}>
            Reset Filters
          </Button>
        </Stack>
      </Stack>

      <Divider />

      <Stack spacing={2}>
        <Typography variant="subtitle2" color="text.secondary">
          Columns & Presets
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={fields}
            value={selectedFieldObjects}
            onChange={(_, value) => setSelectedColumns(value.map((item) => item.id))}
            getOptionLabel={(option) => option.label}
            renderOption={(props, option, { selected }) => (
              <li {...props} key={option.id}>
                <Checkbox checked={selected} sx={{ mr: 1 }} />
                {option.label}
              </li>
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip variant="outlined" label={option.label} {...getTagProps({ index })} key={option.id} />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Columns"
                placeholder="Select columns"
              />
            )}
            sx={{ flex: 1, minWidth: 260 }}
            loading={metadataLoading}
            loadingText="Loading fields..."
            noOptionsText="No fields available"
          />
          <Autocomplete
            options={presets}
            value={presets.find((preset) => preset.id === activePresetId) ?? null}
            onChange={(_, preset) => handlePresetApply(preset ? preset.id : null)}
            getOptionLabel={(option) => option.name}
            renderInput={(params) => <TextField {...params} label="Saved Presets" placeholder="Select a preset" />}
            sx={{ width: { xs: '100%', md: 260 } }}
          />
          <Stack direction="row" spacing={1}>
            <Tooltip title="Save current configuration as a new preset">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<PlaylistAddIcon />}
                  onClick={() => handleOpenPresetDialog('create')}
                  disabled={metadataLoading}
                >
                  Save New
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Update the selected preset with current configuration">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => handleOpenPresetDialog('update')}
                  disabled={!activePresetId}
                >
                  Update
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Delete the selected preset">
              <span>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handlePresetDelete}
                  disabled={!activePresetId}
                >
                  Delete
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ md: 'center' }}
        >
          <Box>
            <Typography variant="subtitle1">Scheduled Deliveries</Typography>
            <Typography variant="body2" color="text.secondary">
              Automatically email this report on a cadence using the columns and filters above.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Create a new schedule">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<PlaylistAddIcon />}
                  onClick={() => handleOpenScheduleDialog('create')}
                  disabled={metadataLoading || scheduleSubmitting}
                >
                  Add Schedule
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Edit the selected schedule">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => handleOpenScheduleDialog('update')}
                  disabled={!activeScheduleId || scheduleSubmitting}
                >
                  Edit
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Delete the selected schedule">
              <span>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleScheduleDelete}
                  disabled={!activeScheduleId || scheduleSubmitting}
                >
                  Delete
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {scheduleError && <Alert severity="warning">{scheduleError}</Alert>}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Frequency</TableCell>
                <TableCell>Recipients</TableCell>
                <TableCell>Next Run</TableCell>
                <TableCell>Last Run</TableCell>
                <TableCell>Formats</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedulesLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">
                        Loading schedules…
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : schedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary">
                      No scheduled deliveries yet. Create one to automate report emails.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                schedules.map((schedule) => (
                  <TableRow
                    key={schedule.id}
                    hover
                    selected={schedule.id === activeScheduleId}
                    onClick={() => setActiveScheduleId(schedule.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{schedule.name}</TableCell>
                    <TableCell>{formatScheduleFrequency(schedule)}</TableCell>
                    <TableCell>{schedule.recipients.join(', ')}</TableCell>
                    <TableCell>{formatDateTime(schedule.nextRunAt)}</TableCell>
                    <TableCell>{formatDateTime(schedule.lastRunAt)}</TableCell>
                    <TableCell>
                      {schedule.includeCsv ? 'CSV' : ''}
                      {schedule.includeCsv && schedule.includePdf ? ' & ' : ''}
                      {schedule.includePdf ? 'PDF' : ''}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        startIcon={<PlayArrowIcon fontSize="small" />}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleScheduleTrigger(schedule.id);
                        }}
                        disabled={scheduleSubmitting}
                      >
                        Run Now
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {metadataError && <Alert severity="error">{metadataError}</Alert>}
      {error && <Alert severity="warning">{error}</Alert>}

      {(loading || metadataLoading) && (
        <Stack direction="row" alignItems="center" spacing={1}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            {metadataLoading ? 'Loading report builder metadata…' : 'Running report…'}
          </Typography>
        </Stack>
      )}

      <Box sx={{ width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={gridColumns}
          autoHeight
          getRowId={(row) => row.id}
          loading={loading || metadataLoading}
          disableRowSelectionOnClick
          density="compact"
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
          }}
          pageSizeOptions={[25, 50, 100]}
          sx={{
            '& .MuiDataGrid-cell': { py: 1 },
            minHeight: rows.length === 0 ? 200 : undefined,
          }}
          localeText={{
            noRowsLabel: loading
              ? 'Loading…'
              : selectedColumns.length === 0
              ? 'Select columns to preview results'
              : 'No rows match the current filters',
          }}
        />
      </Box>

      {queryTotal > 0 && (
        <Typography variant="body2" color="text.secondary">
          Showing {rows.length} of {queryTotal} rows
          {queryTruncated ? ' (truncated by limit)' : ''}. Generated{' '}
          {queryGeneratedAt ? new Date(queryGeneratedAt).toLocaleString() : 'just now'}.
        </Typography>
      )}

      <Dialog 
        open={scheduleDialogOpen} 
        onClose={handleCloseScheduleDialog} 
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: 'auto',
            height: 'auto',
          }
        }}
      >
        <DialogTitle>
          {scheduleDialogMode === 'create' ? 'Schedule Delivery' : 'Edit Schedule'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Schedule Name"
              value={scheduleForm.name}
              onChange={(event) =>
                setScheduleForm((prev) => ({ ...prev, name: event.target.value }))
              }
              fullWidth
              autoFocus
            />
            <TextField
              label="Recipients"
              helperText="Separate multiple email addresses with commas or spaces"
              value={scheduleForm.recipients}
              onChange={(event) =>
                setScheduleForm((prev) => ({ ...prev, recipients: event.target.value }))
              }
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Description"
              value={scheduleForm.description}
              onChange={(event) =>
                setScheduleForm((prev) => ({ ...prev, description: event.target.value }))
              }
              fullWidth
              multiline
              minRows={2}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Frequency"
                value={scheduleForm.frequency}
                onChange={(event) =>
                  setScheduleForm((prev) => ({
                    ...prev,
                    frequency: event.target.value as ScheduleFormState['frequency'],
                  }))
                }
                fullWidth
              >
                {frequencyOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              {scheduleForm.frequency === 'weekly' && (
                <TextField
                  select
                  label="Day of Week"
                  value={scheduleForm.dayOfWeek}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      dayOfWeek: Number(event.target.value) || 1,
                    }))
                  }
                  fullWidth
                >
                  {dayOfWeekOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {scheduleForm.frequency === 'monthly' && (
                <TextField
                  label="Day of Month"
                  type="number"
                  value={scheduleForm.dayOfMonth}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      dayOfMonth: Math.min(
                        Math.max(Number(event.target.value) || 1, 1),
                        28
                      ),
                    }))
                  }
                  inputProps={{ min: 1, max: 28 }}
                  fullWidth
                />
              )}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Send At"
                type="time"
                value={scheduleForm.timeOfDay}
                onChange={(event) =>
                  setScheduleForm((prev) => ({ ...prev, timeOfDay: event.target.value }))
                }
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Timezone"
                value={scheduleForm.timezone}
                onChange={(event) =>
                  setScheduleForm((prev) => ({ ...prev, timezone: event.target.value }))
                }
                helperText="IANA timezone, e.g. America/New_York"
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={scheduleForm.includeCsv}
                    onChange={(event) =>
                      setScheduleForm((prev) => ({
                        ...prev,
                        includeCsv: event.target.checked,
                      }))
                    }
                  />
                }
                label="Attach CSV"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={scheduleForm.includePdf}
                    onChange={(event) =>
                      setScheduleForm((prev) => ({
                        ...prev,
                        includePdf: event.target.checked,
                      }))
                    }
                  />
                }
                label="Attach PDF"
              />
            </Stack>
            <TextField
              label="Row Limit"
              type="number"
              value={scheduleForm.rowLimit}
              onChange={(event) =>
                setScheduleForm((prev) => ({
                  ...prev,
                  rowLimit: Math.max(Number(event.target.value) || 1, 1),
                }))
              }
              helperText="Maximum rows to include in each scheduled delivery"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseScheduleDialog} disabled={scheduleSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleScheduleSave}
            startIcon={<SaveIcon />}
            disabled={scheduleSubmitting}
          >
            {scheduleDialogMode === 'create' ? 'Save Schedule' : 'Update Schedule'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={presetDialogOpen} 
        onClose={handleClosePresetDialog} 
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: 'auto',
            height: 'auto',
          }
        }}
      >
        <DialogTitle>
          {presetDialogMode === 'create' ? 'Save New Preset' : 'Update Preset'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Preset Name"
              value={presetForm.name}
              onChange={(event) => setPresetForm((prev) => ({ ...prev, name: event.target.value }))}
              fullWidth
              autoFocus
            />
            <TextField
              label="Description"
              value={presetForm.description}
              onChange={(event) =>
                setPresetForm((prev) => ({ ...prev, description: event.target.value }))
              }
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePresetDialog} disabled={presetSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handlePresetSave}
            startIcon={presetDialogMode === 'create' ? <SaveIcon /> : <EditIcon />}
            disabled={presetSubmitting}
          >
            {presetDialogMode === 'create' ? 'Save Preset' : 'Update Preset'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ReportBuilderPanel;

