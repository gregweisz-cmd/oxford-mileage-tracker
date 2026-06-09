import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  // Chip, // Currently unused
  // Alert, // Currently unused
  CircularProgress,
  IconButton,
  // Divider, // Currently unused
  Paper,
  InputAdornment
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  // Add as AddIcon, // Currently unused
  // Edit as EditIcon, // Currently unused
  // Delete as DeleteIcon, // Currently unused
  LocationOn as LocationIcon,
  DirectionsCar as CarIcon,
  Receipt as ReceiptIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  Home as HomeIcon,
  Route as RouteIcon
} from '@mui/icons-material';
import FormDatePicker from './FormDatePicker';
// import { DataSyncService } from '../services/dataSyncService'; // Currently unused
import { Employee } from '../types';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import AddressSelector from './AddressSelector';
import { debugLog, debugError } from '../config/debug';
import { formatAddressFromParts, parseAddressToParts, emptyAddressParts, updateAddressPart } from '../utils/addressFormatter';
import type { AddressParts } from '../utils/addressFormatter';
import GooglePlacesTextField from './GooglePlacesTextField';
import { makeCanonicalLocationSelection } from '../utils/locationSelection';
import { getStaffPortalAuthHeaders } from '../services/staffPortalAuthHeaders';
import { defaultDateForReport } from '../utils/calendarDate';

const DEFAULT_API_BASE_URL = 'https://oxford-mileage-backend.onrender.com';
const getApiBaseUrl = () => {
  const configured = (process.env.REACT_APP_API_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
  try {
    const configuredUrl = new URL(configured);
    if (configuredUrl.hostname.endsWith('.vercel.app')) return DEFAULT_API_BASE_URL;
    if (
      typeof window !== 'undefined' &&
      configuredUrl.hostname === window.location.hostname &&
      configuredUrl.pathname.replace(/\/+$/, '') === ''
    ) {
      return DEFAULT_API_BASE_URL;
    }
  } catch {
    return DEFAULT_API_BASE_URL;
  }
  return configured;
};
const API_BASE_URL = getApiBaseUrl();

// Form interfaces
export interface MileageEntryFormData {
  id?: string;
  employeeId: string;
  date: string;
  startLocation: string;
  endLocation: string;
  startLocationName?: string;
  endLocationName?: string;
  purpose: string;
  miles: number;
  startingOdometer?: number;
  notes?: string;
  hoursWorked: number;
  isGpsTracked: boolean;
  costCenter?: string;
}

interface DistanceRouteOption {
  summary?: string;
  miles: number;
  distanceText?: string;
  durationText?: string;
  durationInTrafficText?: string | null;
  warnings?: string[];
}

export interface ReceiptFormData {
  id?: string;
  employeeId: string;
  date: string;
  amount: number;
  vendor: string;
  description: string;
  category: string;
  imageUri?: string;
  costCenter?: string;
}

export interface TimeTrackingFormData {
  id?: string;
  employeeId: string;
  date: string;
  hours: number;
  type: string;
  description?: string;
  costCenter?: string;
}

// Common form props
interface BaseFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any, options?: { keepOpenAfterSave?: boolean }) => void | Promise<void>;
  employee: Employee;
  loading?: boolean;
}

// Mileage Entry Form Component
export const MileageEntryForm: React.FC<BaseFormProps & {
  initialData?: MileageEntryFormData;
  mode: 'create' | 'edit';
  /** Report month (1–12) for default date and calendar when adding entries from Staff Portal */
  reportMonth?: number;
  reportYear?: number;
}> = ({ open, onClose, onSave, employee, initialData, mode, loading = false, reportMonth, reportYear }) => {
  const defaultEntryDate =
    reportMonth != null && reportYear != null
      ? defaultDateForReport(reportMonth, reportYear)
      : new Date().toISOString().split('T')[0];
  const initialCalendarDate =
    reportMonth != null && reportYear != null
      ? defaultDateForReport(reportMonth, reportYear)
      : undefined;

  const [formData, setFormData] = useState<MileageEntryFormData>({
    employeeId: employee.id,
    date: defaultEntryDate,
    startLocation: '',
    endLocation: '',
    startLocationName: '',
    endLocationName: '',
    purpose: '',
    miles: 0,
    startingOdometer: 0,
    notes: '',
    hoursWorked: 0,
    isGpsTracked: false,
    costCenter: employee.defaultCostCenter || employee.selectedCostCenters?.[0] || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [returnToBA, setReturnToBA] = useState(false);
  const [startAddressParts, setStartAddressParts] = useState<AddressParts>({ ...emptyAddressParts });
  const [endAddressParts, setEndAddressParts] = useState<AddressParts>({ ...emptyAddressParts });
  const [calculatingMiles, setCalculatingMiles] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  const { notifyDataChange } = useRealtimeSync();
  const [addressSelectorOpen, setAddressSelectorOpen] = useState(false);
  const [addressSelectorType, setAddressSelectorType] = useState<'start' | 'end'>('start');
  const [dailyOdometerForDate, setDailyOdometerForDate] = useState<number | null>(null);
  const [dailyOdometerLoading, setDailyOdometerLoading] = useState(false);
  const [suggestedOdometerNote, setSuggestedOdometerNote] = useState('');
  const [odometerPrefillSource, setOdometerPrefillSource] = useState<'today_ending' | 'last_travel_day' | null>(null);
  const lastOdometerSuggestionKeyRef = useRef('');
  const [travelReasons, setTravelReasons] = useState<{ id: string; label: string }[]>([]);
  const [isContinuingTripEntry, setIsContinuingTripEntry] = useState(false);
  const isContinuingTripEntryRef = useRef(false);
  const [continuationPromptData, setContinuationPromptData] = useState<MileageEntryFormData | null>(null);
  const [routeOptions, setRouteOptions] = useState<DistanceRouteOption[]>([]);

  // Fetch travel reasons (purpose dropdown) – same options as mobile app
  useEffect(() => {
    if (!open) return;
    fetch(`${API_BASE_URL}/api/travel-reasons`, { headers: getStaffPortalAuthHeaders() })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: { id?: string; label: string }[]) => {
        const list = Array.isArray(rows) ? rows : [];
        setTravelReasons(list.map((r) => ({ id: r.id || r.label, label: r.label || '' })).filter((r) => r.label));
      })
      .catch(() => setTravelReasons([]));
  }, [open]);

  // Fetch daily odometer for selected date (mandatory once per day; if set, field is greyed out)
  const normalizedFormDate = formData.date ? String(formData.date).split('T')[0] : '';
  useEffect(() => {
    if (!open || !employee?.id || !normalizedFormDate) {
      setDailyOdometerForDate(null);
      return;
    }
    let cancelled = false;
    setDailyOdometerLoading(true);
    fetch(`${API_BASE_URL}/api/daily-odometer-readings?employeeId=${encodeURIComponent(employee.id)}&date=${encodeURIComponent(normalizedFormDate)}`, {
      headers: getStaffPortalAuthHeaders(),
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: { date: string; odometerReading: number }[]) => {
        if (cancelled) return;
        const reading = rows && rows.length > 0 ? Number(rows[0].odometerReading) : null;
        setDailyOdometerForDate(reading != null && !isNaN(reading) ? reading : null);
        if (reading != null && !isNaN(reading) && !isContinuingTripEntryRef.current) {
          setFormData((prev) => ({ ...prev, startingOdometer: reading }));
        }
      })
      .catch(() => {
        if (!cancelled) setDailyOdometerForDate(null);
      })
      .finally(() => {
        if (!cancelled) setDailyOdometerLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, employee?.id, normalizedFormDate]);

  // Suggested starting odometer (last travel day / today's ending) — mirrors mobile app
  useEffect(() => {
    if (!open || !employee?.id || !normalizedFormDate || mode === 'edit' || dailyOdometerLoading) {
      if (!open) {
        setSuggestedOdometerNote('');
        setOdometerPrefillSource(null);
        lastOdometerSuggestionKeyRef.current = '';
      }
      return;
    }
    if (dailyOdometerForDate != null) {
      setSuggestedOdometerNote('');
      setOdometerPrefillSource(null);
      return;
    }

    let cancelled = false;
    const suggestionKey = `${employee.id}:${normalizedFormDate}`;
    fetch(
      `${API_BASE_URL}/api/mileage-entries/suggested-starting-odometer?employeeId=${encodeURIComponent(employee.id)}&date=${encodeURIComponent(normalizedFormDate)}`,
      { headers: getStaffPortalAuthHeaders() }
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: {
        suggestedOdometer?: number | null;
        prefillSource?: 'today_ending' | 'last_travel_day' | null;
        lastTravelDayNote?: string;
      } | null) => {
        if (cancelled || !data) return;
        setSuggestedOdometerNote(data.lastTravelDayNote || '');
        setOdometerPrefillSource(data.prefillSource || null);
        if (
          isContinuingTripEntryRef.current ||
          data.suggestedOdometer == null ||
          Number(data.suggestedOdometer) <= 0 ||
          lastOdometerSuggestionKeyRef.current === suggestionKey
        ) {
          return;
        }
        lastOdometerSuggestionKeyRef.current = suggestionKey;
        setFormData((prev) => ({
          ...prev,
          startingOdometer: Math.round(Number(data.suggestedOdometer)),
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestedOdometerNote('');
          setOdometerPrefillSource(null);
        }
      });
    return () => { cancelled = true; };
  }, [open, employee?.id, normalizedFormDate, mode, dailyOdometerLoading, dailyOdometerForDate]);

  // Initialize form data only when dialog first opens for edit (not on every re-render; parent passes new object each render)
  const hasInitializedFromEditRef = useRef(false);
  useEffect(() => {
    if (!open) {
      hasInitializedFromEditRef.current = false;
      return;
    }
    if (initialData && mode === 'edit' && !hasInitializedFromEditRef.current) {
      hasInitializedFromEditRef.current = true;
      setFormData({
        ...initialData,
        costCenter: initialData.costCenter || employee.defaultCostCenter || employee.selectedCostCenters?.[0] || ''
      });
      setStartAddressParts(parseAddressToParts(initialData.startLocation || ''));
      setEndAddressParts(parseAddressToParts(initialData.endLocation || ''));
      const isReturnToBase =
        (initialData.purpose?.toLowerCase().trim() === 'return to base') ||
        (employee.baseAddress && initialData.endLocation?.trim() === employee.baseAddress.trim()) ||
        (employee.baseAddress2 && initialData.endLocation?.trim() === employee.baseAddress2.trim());
      setReturnToBA(!!isReturnToBase);
    }
  }, [open, initialData, mode, employee.defaultCostCenter, employee.selectedCostCenters, employee.baseAddress, employee.baseAddress2]);

  // Track whether we've reset for this open session - prevents clearing user input when parent re-renders
  const hasResetForOpenRef = useRef(false);

  // Reset form ONLY when dialog first opens for new entry (not when employee/other deps change while open)
  useEffect(() => {
    if (!open) {
      hasResetForOpenRef.current = false;
      return;
    }
    if (!initialData && mode === 'create' && !hasResetForOpenRef.current) {
      hasResetForOpenRef.current = true;
      setFormData({
        employeeId: employee.id,
        date: defaultEntryDate,
        startLocation: '',
        endLocation: '',
        startLocationName: '',
        endLocationName: '',
        purpose: '',
        miles: 0,
        startingOdometer: 0,
        notes: '',
        hoursWorked: 0,
        isGpsTracked: false,
        costCenter: employee.defaultCostCenter || employee.selectedCostCenters?.[0] || ''
      });
      setStartAddressParts({ ...emptyAddressParts });
      setEndAddressParts({ ...emptyAddressParts });
      setReturnToBA(false);
      setErrors({});
      setDistanceError(null);
      setIsContinuingTripEntry(false);
      isContinuingTripEntryRef.current = false;
      setContinuationPromptData(null);
      setRouteOptions([]);
    }
  }, [open, mode, initialData, employee?.id, employee?.defaultCostCenter, employee?.selectedCostCenters, defaultEntryDate]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.startLocation.trim()) {
      newErrors.startLocation = 'Start location is required';
    }
    if (!formData.endLocation.trim()) {
      newErrors.endLocation = 'End location is required';
    }
    if (!returnToBA && !formData.purpose.trim()) {
      newErrors.purpose = 'Purpose is required';
    }
    if (formData.miles <= 0) {
      newErrors.miles = 'Miles must be greater than 0';
    }
    if (!formData.costCenter) {
      newErrors.costCenter = 'Cost center is required';
    }
    // Starting odometer is mandatory once per day; if not already set for this date, user must enter it
    if ((dailyOdometerForDate == null || isContinuingTripEntry) && (formData.startingOdometer == null || Number(formData.startingOdometer) <= 0)) {
      newErrors.startingOdometer = 'Starting odometer is required once per day for this date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const payload = { ...formData };
    if (returnToBA && !payload.purpose.trim()) {
      payload.purpose = 'Return to base';
    }
    const effectiveOdometer = dailyOdometerForDate != null && !isContinuingTripEntry
      ? dailyOdometerForDate
      : (payload.startingOdometer ?? 0);
    payload.startingOdometer = effectiveOdometer;

    try {
      if (dailyOdometerForDate == null && effectiveOdometer > 0) {
        await fetch(`${API_BASE_URL}/api/daily-odometer-readings`, {
          method: 'POST',
          headers: getStaffPortalAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            employeeId: employee.id,
            date: normalizedFormDate,
            odometerReading: effectiveOdometer,
          }),
        });
      }
      const keepOpenForContinuationPrompt = mode === 'create';
      await onSave(payload, { keepOpenAfterSave: keepOpenForContinuationPrompt });
      // Push start/end addresses to Recent list (same key as AddressSelector) so they appear next time
      const key = `recentAddresses_${employee.id}`;
      const max = 15;
      try {
        const stored = localStorage.getItem(key);
        const list: Array<{ address: string; name?: string }> = stored ? JSON.parse(stored) : [];
        const push = (addr: string, name?: string) => {
          if (!addr?.trim()) return;
          const entry = { address: addr.trim(), name: name?.trim() };
          const without = list.filter((r) => r.address.trim() !== entry.address);
          list.length = 0;
          list.push(entry, ...without);
        };
        push(payload.startLocation, payload.startLocationName);
        push(payload.endLocation, payload.endLocationName);
        localStorage.setItem(key, JSON.stringify(list.slice(0, max)));
      } catch {
        // ignore
      }
      notifyDataChange({
        type: 'mileage',
        action: mode === 'edit' ? 'update' : 'create',
        data: payload,
        timestamp: new Date(),
        employeeId: employee.id
      });
      if (mode === 'create') {
        setContinuationPromptData(payload);
        return;
      }
      onClose();
    } catch (error) {
      debugError('Error saving mileage entry:', error);
    }
  };

  const handleDoneAfterSave = () => {
    setContinuationPromptData(null);
    setIsContinuingTripEntry(false);
    isContinuingTripEntryRef.current = false;
    onClose();
  };

  const handleAddAnotherAfterSave = () => {
    if (!continuationPromptData) return;

    const payload = continuationPromptData;
    const nextOdometer = Number(payload.startingOdometer || 0) + Number(payload.miles || 0);
    const nextStartLocation = payload.endLocation || '';
    const nextStartLocationName = payload.endLocationName || '';

    isContinuingTripEntryRef.current = true;
    setIsContinuingTripEntry(true);
    setContinuationPromptData(null);
    setFormData((prev) => ({
      ...prev,
      date: payload.date,
      startLocation: nextStartLocation,
      startLocationName: nextStartLocationName,
      endLocation: '',
      endLocationName: '',
      purpose: '',
      miles: 0,
      startingOdometer: nextOdometer > 0 ? Math.round(nextOdometer) : 0,
      notes: '',
      isGpsTracked: false,
    }));
    setStartAddressParts(parseAddressToParts(nextStartLocation));
    setEndAddressParts({ ...emptyAddressParts });
    setReturnToBA(false);
    setErrors({});
    setDistanceError(null);
  };

  const handleInputChange = (field: keyof MileageEntryFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleOpenAddressSelector = (type: 'start' | 'end') => {
    setAddressSelectorType(type);
    setAddressSelectorOpen(true);
  };

  const handleSelectAddress = (address: string, locationData?: { name?: string }) => {
    debugLog('📍 MileageEntryForm: Address selected:', address, 'Type:', addressSelectorType);
    const selection = makeCanonicalLocationSelection({
      name: locationData?.name,
      address,
      source: (locationData as any)?.source,
      sourceId: (locationData as any)?.sourceId,
      latitude: (locationData as any)?.latitude,
      longitude: (locationData as any)?.longitude,
    });
    const parts = parseAddressToParts(selection.address);
    const name = selection.name;
    if (addressSelectorType === 'start') {
      setFormData(prev => ({ ...prev, startLocation: selection.address, startLocationName: name || prev.startLocationName }));
      setStartAddressParts(parts);
      setErrors(prev => ({ ...prev, startLocation: '' }));
    } else {
      setFormData(prev => ({ ...prev, endLocation: selection.address, endLocationName: name || prev.endLocationName }));
      setEndAddressParts(parts);
      setErrors(prev => ({ ...prev, endLocation: '' }));
    }
    setTimeout(() => setAddressSelectorOpen(false), 100);
  };

  const updateStartAddressPart = (field: keyof AddressParts, value: string) => {
    setStartAddressParts(prev => {
      const next = updateAddressPart(prev, field, value);
      setFormData(f => ({ ...f, startLocation: formatAddressFromParts(next) }));
      return next;
    });
    if (errors.startLocation) setErrors(prev => ({ ...prev, startLocation: '' }));
  };

  const updateEndAddressPart = (field: keyof AddressParts, value: string) => {
    setEndAddressParts(prev => {
      const next = updateAddressPart(prev, field, value);
      setFormData(f => ({ ...f, endLocation: formatAddressFromParts(next) }));
      return next;
    });
    if (errors.endLocation) setErrors(prev => ({ ...prev, endLocation: '' }));
  };

  const handleCalculateMiles = async () => {
    const from = formData.startLocation?.trim() || formatAddressFromParts(startAddressParts);
    const to = formData.endLocation?.trim() || formatAddressFromParts(endAddressParts);
    if (!from || !to) {
      setDistanceError('Please enter both start and end addresses.');
      return;
    }
    setDistanceError(null);
    setRouteOptions([]);
    setCalculatingMiles(true);
    try {
      const routesRes = await fetch(`${API_BASE_URL}/api/distance/routes?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
        headers: getStaffPortalAuthHeaders(),
      });
      const routesContentType = routesRes.headers.get('content-type') || '';
      const routesData = routesContentType.includes('application/json') ? await routesRes.json() : null;
      if (routesRes.ok && Array.isArray(routesData?.routes) && routesData.routes.length > 0) {
        const routes = routesData.routes.filter((route: DistanceRouteOption) => typeof route.miles === 'number' && route.miles > 0);
        if (routes.length > 1) {
          setRouteOptions(routes);
          return;
        }
        if (routes.length === 1) {
          setFormData(prev => ({ ...prev, miles: routes[0].miles }));
          setErrors(prev => ({ ...prev, miles: '' }));
          return;
        }
      }

      // Backwards-compatible fallback when Directions alternatives are unavailable.
      const res = await fetch(`${API_BASE_URL}/api/distance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
        headers: getStaffPortalAuthHeaders(),
      });
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : null;
      if (!res.ok) {
        throw new Error(data?.error || `Failed to calculate distance (${res.status})`);
      }
      if (!data || typeof data.miles !== 'number') {
        throw new Error('Distance service returned an unexpected response.');
      }
      setFormData(prev => ({ ...prev, miles: data.miles ?? 0 }));
      setErrors(prev => ({ ...prev, miles: '' }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to calculate distance.';
      setDistanceError(msg);
      debugError('Calculate miles failed:', err);
    } finally {
      setCalculatingMiles(false);
    }
  };

  const handleSelectRouteOption = (route: DistanceRouteOption) => {
    setFormData(prev => ({ ...prev, miles: route.miles }));
    setErrors(prev => ({ ...prev, miles: '' }));
    setDistanceError(null);
    setRouteOptions([]);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
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
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <CarIcon sx={{ mr: 1 }} />
            <Typography variant="h6">
              {mode === 'create' ? 'Add Mileage Entry' : 'Edit Mileage Entry'}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormDatePicker
              label="Date"
              value={formData.date}
              initialCalendarDate={initialCalendarDate}
              onChange={(date) => handleInputChange('date', date)}
              error={!!errors.date}
              helperText={errors.date}
            />

            {/* Cost Center */}
            <Box sx={{ width: '100%' }}>
              <FormControl fullWidth error={!!errors.costCenter}>
                <InputLabel>Cost Center</InputLabel>
                <Select
                  value={formData.costCenter}
                  onChange={(e) => handleInputChange('costCenter', e.target.value)}
                  label="Cost Center"
                >
                  {employee.selectedCostCenters?.map((center) => (
                    <MenuItem key={center} value={center}>
                      {center}
                    </MenuItem>
                  ))}
                </Select>
                {errors.costCenter && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {errors.costCenter}
                  </Typography>
                )}
              </FormControl>
            </Box>

            {/* Start Location - Street, City, State, Zip */}
            <Box sx={{ width: '100%' }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LocationIcon fontSize="small" /> Start Location
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
                <GooglePlacesTextField
                  label="Street Address"
                  value={startAddressParts.street}
                  onChange={(value) => updateStartAddressPart('street', value)}
                  onPlaceSelected={(address) => {
                    const parsed = parseAddressToParts(address);
                    setStartAddressParts(parsed);
                    setFormData((prev) => ({ ...prev, startLocation: formatAddressFromParts(parsed) }));
                    if (errors.startLocation) setErrors((prev) => ({ ...prev, startLocation: '' }));
                  }}
                  error={!!errors.startLocation}
                  helperText={errors.startLocation}
                  size="small"
                  sx={{ flex: '1 1 200px', minWidth: 180 }}
                />
                <TextField
                  label="City"
                  value={startAddressParts.city}
                  onChange={(e) => updateStartAddressPart('city', e.target.value)}
                  size="small"
                  sx={{ flex: '0 1 140px', minWidth: 100 }}
                />
                <TextField
                  label="State"
                  value={startAddressParts.state}
                  onChange={(e) => updateStartAddressPart('state', e.target.value.toUpperCase().slice(0, 2))}
                  size="small"
                  placeholder="NC"
                  inputProps={{ maxLength: 2 }}
                  sx={{ width: 80 }}
                />
                <TextField
                  label="ZIP Code"
                  value={startAddressParts.zip}
                  onChange={(e) => updateStartAddressPart('zip', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  size="small"
                  placeholder="27601"
                  sx={{ width: 100 }}
                />
                <Button size="small" variant="outlined" onClick={() => handleOpenAddressSelector('start')} sx={{ alignSelf: 'center' }}>
                  Search Address
                </Button>
              </Box>
              <TextField
                label="Start location name (optional)"
                value={formData.startLocationName ?? ''}
                onChange={(e) => handleInputChange('startLocationName', e.target.value)}
                placeholder="e.g. BA, Office"
                size="small"
                sx={{ mt: 1, maxWidth: 280 }}
              />
            </Box>

            {/* End Location - Street, City, State, Zip */}
            <Box sx={{ width: '100%' }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LocationIcon fontSize="small" /> End Location
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
                <GooglePlacesTextField
                  label="Street Address"
                  value={endAddressParts.street}
                  onChange={(value) => updateEndAddressPart('street', value)}
                  onPlaceSelected={(address) => {
                    const parsed = parseAddressToParts(address);
                    setEndAddressParts(parsed);
                    setFormData((prev) => ({ ...prev, endLocation: formatAddressFromParts(parsed) }));
                    if (errors.endLocation) setErrors((prev) => ({ ...prev, endLocation: '' }));
                  }}
                  error={!!errors.endLocation}
                  helperText={errors.endLocation}
                  size="small"
                  sx={{ flex: '1 1 200px', minWidth: 180 }}
                  disabled={returnToBA}
                />
                <TextField
                  label="City"
                  value={endAddressParts.city}
                  onChange={(e) => updateEndAddressPart('city', e.target.value)}
                  size="small"
                  sx={{ flex: '0 1 140px', minWidth: 100 }}
                  disabled={returnToBA}
                />
                <TextField
                  label="State"
                  value={endAddressParts.state}
                  onChange={(e) => updateEndAddressPart('state', e.target.value.toUpperCase().slice(0, 2))}
                  size="small"
                  placeholder="NC"
                  inputProps={{ maxLength: 2 }}
                  sx={{ width: 80 }}
                  disabled={returnToBA}
                />
                <TextField
                  label="ZIP Code"
                  value={endAddressParts.zip}
                  onChange={(e) => updateEndAddressPart('zip', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  size="small"
                  placeholder="27601"
                  sx={{ width: 100 }}
                  disabled={returnToBA}
                />
                {!returnToBA && (
                  <Button size="small" variant="outlined" onClick={() => handleOpenAddressSelector('end')} sx={{ alignSelf: 'center' }}>
                    Search Address
                  </Button>
                )}
              </Box>
              <TextField
                label="End location name (optional)"
                value={formData.endLocationName ?? ''}
                onChange={(e) => handleInputChange('endLocationName', e.target.value)}
                placeholder="e.g. BA, Client"
                size="small"
                sx={{ mt: 1, maxWidth: 280 }}
                disabled={returnToBA}
              />
            </Box>

            {/* Return to BA - purpose not required when checked */}
            {employee.baseAddress && (
              <Box sx={{ width: '100%' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={returnToBA}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setReturnToBA(checked);
                        if (checked) {
                          const baseAddr = employee.baseAddress || '';
                          setFormData(prev => ({ ...prev, endLocation: baseAddr, purpose: 'Return to base' }));
                          setEndAddressParts(parseAddressToParts(baseAddr));
                          setErrors(prev => ({ ...prev, purpose: '', endLocation: '' }));
                        } else {
                          setFormData(prev => ({ ...prev, purpose: prev.purpose === 'Return to base' ? '' : prev.purpose }));
                        }
                      }}
                      color="primary"
                    />
                  }
                  label={
                    <Box component="span" display="flex" alignItems="center" gap={0.5}>
                      <HomeIcon fontSize="small" /> Return to BA
                    </Box>
                  }
                />
                {returnToBA && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: -0.5, ml: 4 }}>
                    Purpose is not required for return-to-base entries.
                  </Typography>
                )}
              </Box>
            )}

            {/* Purpose – dropdown matching mobile app (travel reasons) */}
            <Box sx={{ width: '100%' }}>
              <FormControl fullWidth error={!!errors.purpose} disabled={returnToBA}>
                <InputLabel id="purpose-label">Purpose</InputLabel>
                <Select
                  labelId="purpose-label"
                  value={formData.purpose}
                  onChange={(e) => handleInputChange('purpose', e.target.value)}
                  label="Purpose"
                  displayEmpty
                  renderValue={(v) => v || ''}
                >
                  <MenuItem value="">
                    <em>{returnToBA ? 'Return to base' : 'Select purpose...'}</em>
                  </MenuItem>
                  {travelReasons.map((r) => (
                    <MenuItem key={r.id} value={r.label}>
                      {r.label}
                    </MenuItem>
                  ))}
                  {formData.purpose && !travelReasons.some((r) => r.label === formData.purpose) && (
                    <MenuItem value={formData.purpose}>
                      {formData.purpose}
                    </MenuItem>
                  )}
                </Select>
                {errors.purpose && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    {errors.purpose}
                  </Typography>
                )}
              </FormControl>
            </Box>

            {/* Starting odometer: mandatory once per day; greyed out if already set for this date */}
            <Box sx={{ width: '100%' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ flex: '0 1 140px', minWidth: 100 }}>
                  <TextField
                    label="Starting odometer"
                    type="number"
                    value={dailyOdometerLoading ? '…' : (formData.startingOdometer ?? '')}
                    onChange={(e) => handleInputChange('startingOdometer', parseInt(e.target.value, 10) || 0)}
                    error={!!errors.startingOdometer}
                    helperText={
                      errors.startingOdometer ||
                      (dailyOdometerForDate != null && !isContinuingTripEntry
                        ? 'Set once per day (already entered for this date)'
                        : odometerPrefillSource === 'today_ending'
                          ? 'Prefilled from where you left off today'
                          : 'Required once per day for this date')
                    }
                    inputProps={{ min: 0, step: 1 }}
                    disabled={dailyOdometerLoading || (dailyOdometerForDate != null && !isContinuingTripEntry)}
                    fullWidth
                  />
                  {suggestedOdometerNote && dailyOdometerForDate == null && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {suggestedOdometerNote}
                    </Typography>
                  )}
                </Box>
                <TextField
                  label="Miles"
                  type="number"
                  value={formData.miles}
                  onChange={(e) => { handleInputChange('miles', parseFloat(e.target.value) || 0); setDistanceError(null); }}
                  error={!!errors.miles || !!distanceError}
                  helperText={errors.miles || distanceError || 'Enter manually or use Calculate miles (Google Maps)'}
                  inputProps={{ min: 0, step: 0.1 }}
                  sx={{ flex: '0 1 140px', minWidth: 100 }}
                />
                <Button
                  variant="outlined"
                  size="medium"
                  onClick={handleCalculateMiles}
                  disabled={calculatingMiles}
                  startIcon={calculatingMiles ? <CircularProgress size={18} /> : <RouteIcon />}
                  sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                >
                  {calculatingMiles ? 'Calculating...' : 'Calculate miles'}
                </Button>
              </Box>
            </Box>

            {/* Notes */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                multiline
                rows={3}
                placeholder="Additional notes or comments..."
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
          disabled={loading}
        >
          {mode === 'create' ? 'Add Entry' : 'Save Changes'}
        </Button>
      </DialogActions>

      {/* Address Selector */}
      <AddressSelector
        open={addressSelectorOpen}
        onClose={() => setAddressSelectorOpen(false)}
        onSelectAddress={handleSelectAddress}
        employeeId={employee.id}
        title={`Search ${addressSelectorType === 'start' ? 'Start' : 'End'} Location`}
      />
      <Dialog
        open={routeOptions.length > 0}
        onClose={() => setRouteOptions([])}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Choose the route you traveled</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Google found multiple driving routes. Pick the one that best matches how you traveled.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {routeOptions.map((route, index) => {
              const durationText = route.durationInTrafficText || route.durationText;
              const routeLabel = route.summary ? `via ${route.summary}` : `Route ${index + 1}`;
              return (
                <Button
                  key={`${route.summary || 'route'}-${route.miles}-${index}`}
                  variant="outlined"
                  onClick={() => handleSelectRouteOption(route)}
                  sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 1.5 }}
                >
                  <Box>
                    <Typography variant="subtitle2">
                      {route.miles} miles{durationText ? ` · ${durationText}` : ''} · {routeLabel}
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
                  </Box>
                </Button>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRouteOptions([])}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!continuationPromptData}
        onClose={handleDoneAfterSave}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Mileage entry saved</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Your mileage entry was saved. Are you done adding entries, or do you want to add another leg to this trip?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDoneAfterSave}>
            Done
          </Button>
          <Button variant="contained" onClick={handleAddAnotherAfterSave}>
            Add Another
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

// Receipt Form Component
export const ReceiptForm: React.FC<BaseFormProps & {
  initialData?: ReceiptFormData;
  mode: 'create' | 'edit';
}> = ({ open, onClose, onSave, employee, initialData, mode, loading = false }) => {
  const [formData, setFormData] = useState<ReceiptFormData>({
    employeeId: employee.id,
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    vendor: '',
    description: '',
    category: '',
    imageUri: '',
    costCenter: employee.defaultCostCenter || employee.selectedCostCenters?.[0] || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const { notifyDataChange } = useRealtimeSync();

  const receiptCategories = [
    'Airfare/Bus/Train',
    'Communication',
    'EES',
    'Equipment',
    'Ground Transportation',
    'Hotels/AirBnB',
    'Meals',
    'Office Supplies',
    'Other',
    'Parking/Tolls',
    'Per Diem',
    'Phone/Internet/Fax',
    'Postage/Shipping',
    'Printing',
    'Rental Car',
    'Rental Car Fuel',
    'Training',
    'Travel'
  ];

  // Initialize form data
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        employeeId: employee.id,
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        vendor: '',
        description: '',
        category: '',
        imageUri: '',
        costCenter: employee.defaultCostCenter || employee.selectedCostCenters?.[0] || ''
      });
    }
    setErrors({});
  }, [initialData, employee, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.vendor.trim()) {
      newErrors.vendor = 'Vendor is required';
    }
    // Description is always required, but especially for "Other" category
    if (!formData.description.trim()) {
      if (formData.category === 'Other') {
        newErrors.description = 'Description is required for Other Expenses so Finance knows what the money was spent on';
      } else {
        newErrors.description = 'Description is required';
      }
    }
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }
    if (formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!formData.costCenter) {
      newErrors.costCenter = 'Cost center is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      await onSave(formData);
      
      // Notify real-time sync
      notifyDataChange({
        type: 'receipt',
        action: mode === 'edit' ? 'update' : 'create',
        data: formData,
        timestamp: new Date(),
        employeeId: employee.id
      });
      
      onClose();
    } catch (error) {
      debugError('Error saving receipt:', error);
    }
  };

  const handleInputChange = (field: keyof ReceiptFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
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
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <ReceiptIcon sx={{ mr: 1 }} />
            <Typography variant="h6">
              {mode === 'create' ? 'Add Receipt' : 'Edit Receipt'}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormDatePicker
              label="Date"
              value={formData.date}
              onChange={(date) => handleInputChange('date', date)}
              error={!!errors.date}
              helperText={errors.date}
            />

            {/* Cost Center */}
            <Box sx={{ width: '100%' }}>
              <FormControl fullWidth error={!!errors.costCenter}>
                <InputLabel>Cost Center</InputLabel>
                <Select
                  value={formData.costCenter}
                  onChange={(e) => handleInputChange('costCenter', e.target.value)}
                  label="Cost Center"
                >
                  {employee.selectedCostCenters?.map((center) => (
                    <MenuItem key={center} value={center}>
                      {center}
                    </MenuItem>
                  ))}
                </Select>
                {errors.costCenter && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {errors.costCenter}
                  </Typography>
                )}
              </FormControl>
            </Box>

            {/* Vendor */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Vendor"
                value={formData.vendor}
                onChange={(e) => handleInputChange('vendor', e.target.value)}
                error={!!errors.vendor}
                helperText={errors.vendor}
              />
            </Box>

            {/* Amount */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
                error={!!errors.amount}
                helperText={errors.amount}
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MoneyIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Category */}
            <Box sx={{ width: '100%' }}>
              <FormControl fullWidth error={!!errors.category}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  label="Category"
                >
                  {receiptCategories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
                {errors.category && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {errors.category}
                  </Typography>
                )}
              </FormControl>
            </Box>

            {/* Description */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                error={!!errors.description}
                helperText={errors.description}
                multiline
                rows={3}
                placeholder="Describe the expense..."
              />
            </Box>

            {/* Image Upload Placeholder */}
            <Box sx={{ width: '100%' }}>
              <Paper sx={{ p: 2, border: '2px dashed #ccc', textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  📷 Receipt Image Upload
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  (Image upload functionality will be added in future enhancement)
                </Typography>
              </Paper>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
          disabled={loading}
        >
          {mode === 'create' ? 'Add Receipt' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Time Tracking Form Component
export const TimeTrackingForm: React.FC<BaseFormProps & {
  initialData?: TimeTrackingFormData;
  mode: 'create' | 'edit';
}> = ({ open, onClose, onSave, employee, initialData, mode, loading = false }) => {
  const [formData, setFormData] = useState<TimeTrackingFormData>({
    employeeId: employee.id,
    date: new Date().toISOString().split('T')[0],
    hours: 0,
    type: '',
    description: '',
    costCenter: employee.defaultCostCenter || employee.selectedCostCenters?.[0] || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const { notifyDataChange } = useRealtimeSync();

  const timeTypes = [
    'Working Hours',
    'G&A',
    'Holiday',
    'PTO',
    'STD/LTD',
    'PFL/PFML',
    'Training',
    'Travel',
    'Other'
  ];

  // Initialize form data
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        employeeId: employee.id,
        date: new Date().toISOString().split('T')[0],
        hours: 0,
        type: '',
        description: '',
        costCenter: employee.defaultCostCenter || employee.selectedCostCenters?.[0] || ''
      });
    }
    setErrors({});
  }, [initialData, employee, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.type) {
      newErrors.type = 'Time type is required';
    }
    if (formData.hours <= 0) {
      newErrors.hours = 'Hours must be greater than 0';
    }
    if (!formData.costCenter) {
      newErrors.costCenter = 'Cost center is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      await onSave(formData);
      
      // Notify real-time sync
      notifyDataChange({
        type: 'time_tracking',
        action: mode === 'edit' ? 'update' : 'create',
        data: formData,
        timestamp: new Date(),
        employeeId: employee.id
      });
      
      onClose();
    } catch (error) {
      console.error('Error saving time tracking:', error);
    }
  };

  const handleInputChange = (field: keyof TimeTrackingFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
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
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <ScheduleIcon sx={{ mr: 1 }} />
            <Typography variant="h6">
              {mode === 'create' ? 'Add Time Entry' : 'Edit Time Entry'}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormDatePicker
              label="Date"
              value={formData.date}
              onChange={(date) => handleInputChange('date', date)}
            />

            {/* Cost Center */}
            <Box sx={{ width: '100%' }}>
              <FormControl fullWidth error={!!errors.costCenter}>
                <InputLabel>Cost Center</InputLabel>
                <Select
                  value={formData.costCenter}
                  onChange={(e) => handleInputChange('costCenter', e.target.value)}
                  label="Cost Center"
                >
                  {employee.selectedCostCenters?.map((center) => (
                    <MenuItem key={center} value={center}>
                      {center}
                    </MenuItem>
                  ))}
                </Select>
                {errors.costCenter && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {errors.costCenter}
                  </Typography>
                )}
              </FormControl>
            </Box>

            {/* Time Type */}
            <Box sx={{ width: '100%' }}>
              <FormControl fullWidth error={!!errors.type}>
                <InputLabel>Time Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  label="Time Type"
                >
                  {timeTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
                {errors.type && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {errors.type}
                  </Typography>
                )}
              </FormControl>
            </Box>

            {/* Hours */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Hours"
                type="number"
                value={formData.hours}
                onChange={(e) => handleInputChange('hours', parseFloat(e.target.value) || 0)}
                error={!!errors.hours}
                helperText={errors.hours}
                inputProps={{ min: 0, step: 0.25, max: 24 }}
              />
            </Box>

            {/* Description */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                multiline
                rows={3}
                placeholder="Describe the work performed..."
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
          disabled={loading}
        >
          {mode === 'create' ? 'Add Entry' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
