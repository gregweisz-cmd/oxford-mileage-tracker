import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import FormDatePicker from './FormDatePicker';
import { Employee } from '../types';
import {
  fetchGpsTripInvestigation,
  googleMapsCoordUrl,
  GpsTripInvestigationRow,
} from '../services/gpsTripInvestigationService';
import { debugError } from '../config/debug';

const getDefaultDateRange = () => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const toInput = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { start: toInput(startOfMonth), end: toInput(today) };
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
};

const formatCoords = (lat?: number, lng?: number) => {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return '—';
  }
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
    return '—';
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

const CoordLink: React.FC<{ lat?: number; lng?: number; label?: string }> = ({ lat, lng, label }) => {
  const url = googleMapsCoordUrl(lat, lng);
  const text = label || formatCoords(lat, lng);
  if (!url) {
    return <Typography variant="body2" component="span">{text}</Typography>;
  }
  return (
    <Link href={url} target="_blank" rel="noopener noreferrer" variant="body2">
      {text}
    </Link>
  );
};

interface GpsTripInvestigationTabProps {
  employees: Employee[];
}

export const GpsTripInvestigationTab: React.FC<GpsTripInvestigationTabProps> = ({ employees }) => {
  const defaultRange = useMemo(getDefaultDateRange, []);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [trips, setTrips] = useState<GpsTripInvestigationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeEmployees = useMemo(
    () =>
      [...employees]
        .filter((e) => !(e as Employee & { archived?: number }).archived)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [employees]
  );

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGpsTripInvestigation({
        startDate,
        endDate,
        employeeId: selectedEmployee?.id,
      });
      setTrips(data.trips);
    } catch (err) {
      debugError('Failed to load GPS trips', err);
      setError(err instanceof Error ? err.message : 'Failed to load GPS trips');
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedEmployee?.id]);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  const renderGapChip = (gapMiles: number | null | undefined, late?: boolean) => {
    if (gapMiles == null) {
      return <Typography variant="caption" color="text.secondary">No GPS audit</Typography>;
    }
    if (late) {
      return <Chip size="small" color="warning" label={`${gapMiles} mi apart`} />;
    }
    return <Chip size="small" variant="outlined" label={`${gapMiles} mi apart`} />;
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        GPS trip investigation
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 900 }}>
        Compare where the phone was when tracking <strong>started / stopped</strong> (device GPS) vs the
        trip&apos;s picked start/end locations. A large gap often means tracking was started late or ended early.
        New trips include audit data after testers sync on an updated mobile build.
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ md: 'flex-end' }}>
        <FormDatePicker label="From" value={startDate} onChange={setStartDate} />
        <FormDatePicker label="To" value={endDate} onChange={setEndDate} />
        <Autocomplete
          sx={{ minWidth: 280 }}
          options={activeEmployees}
          value={selectedEmployee}
          onChange={(_, value) => setSelectedEmployee(value)}
          getOptionLabel={(option) => option.name || option.email || option.id}
          renderInput={(params) => <TextField {...params} label="Employee (optional)" />}
          isOptionEqualToValue={(a, b) => a.id === b.id}
        />
        <Button variant="contained" startIcon={<RefreshIcon />} onClick={() => void loadTrips()} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Tracker started</TableCell>
                <TableCell>Tracker stopped</TableCell>
                <TableCell>Miles</TableCell>
                <TableCell>Picked start → device at Start</TableCell>
                <TableCell>Picked end → device at Stop</TableCell>
                <TableCell>BA on file</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    No GPS-tracked trips in this range.
                  </TableCell>
                </TableRow>
              ) : (
                trips.map((trip) => (
                  <TableRow
                    key={trip.id}
                    hover
                    sx={
                      trip.flagLateStart || trip.flagLateEnd
                        ? { bgcolor: 'warning.light', '&:hover': { bgcolor: 'warning.light' } }
                        : undefined
                    }
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {trip.employeeName || trip.employeeId}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {trip.date?.slice(0, 10)} · {trip.purpose || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDateTime(trip.gpsTrackStartedAt)}</Typography>
                      <CoordLink lat={trip.gpsStartLat} lng={trip.gpsStartLng} />
                      {trip.tripDurationMinutes != null && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {trip.tripDurationMinutes} min tracked
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDateTime(trip.gpsTrackEndedAt)}</Typography>
                      <CoordLink lat={trip.gpsEndLat} lng={trip.gpsEndLng} />
                    </TableCell>
                    <TableCell>{trip.miles}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {trip.startLocationName || trip.startLocation || '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {trip.startLocationAddress || '—'}
                      </Typography>
                      <Typography variant="caption" display="block" component="div">
                        Picked: <CoordLink lat={trip.startLocationLat} lng={trip.startLocationLng} />
                      </Typography>
                      {renderGapChip(trip.startGapMiles, trip.flagLateStart)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{trip.endLocationName || trip.endLocation || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {trip.endLocationAddress || '—'}
                      </Typography>
                      <Typography variant="caption" display="block" component="div">
                        Picked: <CoordLink lat={trip.endLocationLat} lng={trip.endLocationLng} />
                      </Typography>
                      {renderGapChip(trip.endGapMiles, trip.flagLateEnd)}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={trip.baseAddress2 ? `BA2: ${trip.baseAddress2}` : ''}>
                        <Typography variant="caption">{trip.baseAddress || '—'}</Typography>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};
