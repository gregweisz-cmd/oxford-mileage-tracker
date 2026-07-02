import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  fetchGpsTripGoogleMapsRoutes,
  googleMapsCoordUrl,
  GpsTripInvestigationRow,
  GpsTripRouteOption,
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

const hasPickedTripCoords = (trip: GpsTripInvestigationRow) => {
  const coords = [
    trip.startLocationLat,
    trip.startLocationLng,
    trip.endLocationLat,
    trip.endLocationLng,
  ];
  return coords.every((value) => value != null && Number.isFinite(value) && Math.abs(value) > 0.0001);
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
  const [googleMapsRoutesByTripId, setGoogleMapsRoutesByTripId] = useState<Record<string, GpsTripRouteOption[]>>({});
  const [googleMapsLoadingByTripId, setGoogleMapsLoadingByTripId] = useState<Record<string, boolean>>({});
  const [googleMapsErrorByTripId, setGoogleMapsErrorByTripId] = useState<Record<string, string>>({});
  const [routeCompareTrip, setRouteCompareTrip] = useState<GpsTripInvestigationRow | null>(null);

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
    setGoogleMapsRoutesByTripId({});
    setGoogleMapsLoadingByTripId({});
    setGoogleMapsErrorByTripId({});
    setRouteCompareTrip(null);
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

  const handleCalculateGoogleMapsMiles = useCallback(async (trip: GpsTripInvestigationRow) => {
    const tripId = trip.id;
    setGoogleMapsLoadingByTripId((prev) => ({ ...prev, [tripId]: true }));
    setGoogleMapsErrorByTripId((prev) => {
      const next = { ...prev };
      delete next[tripId];
      return next;
    });
    try {
      const { routes } = await fetchGpsTripGoogleMapsRoutes(tripId);
      setGoogleMapsRoutesByTripId((prev) => ({ ...prev, [tripId]: routes }));
      setRouteCompareTrip(trip);
    } catch (err) {
      debugError('Failed to calculate Google Maps miles', err);
      setGoogleMapsErrorByTripId((prev) => ({
        ...prev,
        [tripId]: err instanceof Error ? err.message : 'Failed to calculate distance',
      }));
    } finally {
      setGoogleMapsLoadingByTripId((prev) => ({ ...prev, [tripId]: false }));
    }
  }, []);

  const formatRouteSummary = (routes: GpsTripRouteOption[]) =>
    routes.map((route) => route.miles).join(' / ');

  const renderRouteOption = (route: GpsTripRouteOption, index: number, trackedMiles?: number) => {
    const durationText = route.durationInTrafficText || route.durationText;
    const routeLabel = route.summary ? `via ${route.summary}` : `Route ${index + 1}`;
    const matchesTracked = trackedMiles != null && route.miles === trackedMiles;
    return (
      <Box
        key={`${route.summary || 'route'}-${route.miles}-${index}`}
        sx={{
          border: 1,
          borderColor: matchesTracked ? 'success.main' : 'divider',
          borderRadius: 1,
          p: 1.5,
          bgcolor: matchesTracked ? 'success.light' : 'background.paper',
        }}
      >
        <Typography variant="subtitle2">
          {route.miles} mi{durationText ? ` · ${durationText}` : ''} · {routeLabel}
        </Typography>
        {route.distanceText && (
          <Typography variant="caption" color="text.secondary" display="block">
            Google distance: {route.distanceText}
          </Typography>
        )}
        {route.warnings && route.warnings.length > 0 && (
          <Typography variant="caption" color="warning.main" display="block">
            {route.warnings.join(' ')}
          </Typography>
        )}
        {matchesTracked && (
          <Typography variant="caption" color="success.dark" display="block">
            Matches miles tracked
          </Typography>
        )}
      </Box>
    );
  };

  const renderGoogleMapsCell = (trip: GpsTripInvestigationRow) => {
    const routes = googleMapsRoutesByTripId[trip.id];
    const isLoading = !!googleMapsLoadingByTripId[trip.id];
    const rowError = googleMapsErrorByTripId[trip.id];
    const canCalculate = hasPickedTripCoords(trip);

    if (routes?.length) {
      return (
        <Stack spacing={0.5}>
          <Typography variant="body2" fontWeight={600}>
            {formatRouteSummary(routes)} mi
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="text" onClick={() => setRouteCompareTrip(trip)}>
              View routes
            </Button>
            <Button
              size="small"
              variant="text"
              disabled={isLoading}
              onClick={() => void handleCalculateGoogleMapsMiles(trip)}
            >
              Recalc
            </Button>
          </Stack>
        </Stack>
      );
    }

    return (
      <Stack spacing={0.5}>
        <Button
          size="small"
          variant="outlined"
          disabled={!canCalculate || isLoading}
          onClick={() => void handleCalculateGoogleMapsMiles(trip)}
        >
          {isLoading ? 'Calculating…' : 'Calculate'}
        </Button>
        {!canCalculate && (
          <Typography variant="caption" color="text.secondary">
            Missing picked coords
          </Typography>
        )}
        {rowError && (
          <Typography variant="caption" color="error">
            {rowError}
          </Typography>
        )}
      </Stack>
    );
  };

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
        trip&apos;s picked start/end locations. <strong>Miles tracked</strong> is what the phone logged.
        Use <strong>Calculate</strong> on a row to fetch up to three Google Maps driving routes between the picked start and end
        (not saved — shown only for that review). Compare them against <strong>Miles tracked</strong> to spot late starts, early stops, or route differences.
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
                <TableCell>Miles tracked</TableCell>
                <TableCell>
                  <Tooltip title="On-demand driving routes between picked start and end (Google Directions, up to 3 alternatives)">
                    <span>Google Maps mi</span>
                  </Tooltip>
                </TableCell>
                <TableCell>Picked start → device at Start</TableCell>
                <TableCell>Picked end → device at Stop</TableCell>
                <TableCell>BA on file</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
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
                    <TableCell>{trip.trackedMiles ?? trip.miles}</TableCell>
                    <TableCell>{renderGoogleMapsCell(trip)}</TableCell>
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

      <Dialog
        open={!!routeCompareTrip}
        onClose={() => setRouteCompareTrip(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Google Maps route options</DialogTitle>
        <DialogContent>
          {routeCompareTrip && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {routeCompareTrip.employeeName || routeCompareTrip.employeeId} ·{' '}
                {routeCompareTrip.date?.slice(0, 10)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Miles tracked: <strong>{routeCompareTrip.trackedMiles ?? routeCompareTrip.miles ?? '—'}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Google found {googleMapsRoutesByTripId[routeCompareTrip.id]?.length || 0} driving route
                {(googleMapsRoutesByTripId[routeCompareTrip.id]?.length || 0) === 1 ? '' : 's'} between the picked start and end.
              </Typography>
              <Stack spacing={1.5}>
                {(googleMapsRoutesByTripId[routeCompareTrip.id] || []).map((route, index) =>
                  renderRouteOption(route, index, routeCompareTrip.trackedMiles ?? routeCompareTrip.miles)
                )}
              </Stack>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRouteCompareTrip(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
