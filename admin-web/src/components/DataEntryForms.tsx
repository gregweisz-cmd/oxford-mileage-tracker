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
  CalendarToday as CalendarIcon,
  LocationOn as LocationIcon,
  DirectionsCar as CarIcon,
  Receipt as ReceiptIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  Home as HomeIcon,
  Route as RouteIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
// import { DataSyncService } from '../services/dataSyncService'; // Currently unused
import { Employee } from '../types';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import AddressSelector from './AddressSelector';
import { debugLog, debugError } from '../config/debug';
import { formatAddressFromParts, parseAddressToParts, emptyAddressParts } from '../utils/addressFormatter';
import type { AddressParts } from '../utils/addressFormatter';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

// Form interfaces
export interface MileageEntryFormData {
  id?: string;
  employeeId: string;
  date: string;
  startLocation: string;
  endLocation: string;
  purpose: string;
  miles: number;
  startingOdometer?: number;
  notes?: string;
  hoursWorked: number;
  isGpsTracked: boolean;
  costCenter?: string;
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
  onSave: (data: any) => void;
  employee: Employee;
  loading?: boolean;
}

// Mileage Entry Form Component
export const MileageEntryForm: React.FC<BaseFormProps & {
  initialData?: MileageEntryFormData;
  mode: 'create' | 'edit';
}> = ({ open, onClose, onSave, employee, initialData, mode, loading = false }) => {
  const [formData, setFormData] = useState<MileageEntryFormData>({
    employeeId: employee.id,
    date: new Date().toISOString().split('T')[0],
    startLocation: '',
    endLocation: '',
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
        date: new Date().toISOString().split('T')[0],
        startLocation: '',
        endLocation: '',
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
    }
  }, [open, mode, initialData, employee?.id, employee?.defaultCostCenter, employee?.selectedCostCenters]);

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const payload = { ...formData };
    if (returnToBA && !payload.purpose.trim()) {
      payload.purpose = 'Return to base';
    }

    try {
      await onSave(payload);
      
      // Notify real-time sync
      notifyDataChange({
        type: 'mileage',
        action: mode === 'edit' ? 'update' : 'create',
        data: payload,
        timestamp: new Date(),
        employeeId: employee.id
      });
      
      onClose();
    } catch (error) {
      debugError('Error saving mileage entry:', error);
    }
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

  const handleSelectAddress = (address: string, locationData?: any) => {
    debugLog('📍 MileageEntryForm: Address selected:', address, 'Type:', addressSelectorType);
    const parts = parseAddressToParts(address);
    if (addressSelectorType === 'start') {
      setFormData(prev => ({ ...prev, startLocation: address }));
      setStartAddressParts(parts);
      setErrors(prev => ({ ...prev, startLocation: '' }));
    } else {
      setFormData(prev => ({ ...prev, endLocation: address }));
      setEndAddressParts(parts);
      setErrors(prev => ({ ...prev, endLocation: '' }));
    }
    setTimeout(() => setAddressSelectorOpen(false), 100);
  };

  const updateStartAddressPart = (field: keyof AddressParts, value: string) => {
    setStartAddressParts(prev => {
      const next = { ...prev, [field]: value };
      setFormData(f => ({ ...f, startLocation: formatAddressFromParts(next) }));
      return next;
    });
    if (errors.startLocation) setErrors(prev => ({ ...prev, startLocation: '' }));
  };

  const updateEndAddressPart = (field: keyof AddressParts, value: string) => {
    setEndAddressParts(prev => {
      const next = { ...prev, [field]: value };
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
    setCalculatingMiles(true);
    try {
      const base = API_BASE_URL || '';
      const res = await fetch(`${base}/api/distance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to calculate distance');
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
            {/* Date */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                error={!!errors.date}
                helperText={errors.date}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

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
                <TextField
                  label="Street Address"
                  value={startAddressParts.street}
                  onChange={(e) => updateStartAddressPart('street', e.target.value)}
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
                  Select Address
                </Button>
              </Box>
            </Box>

            {/* End Location - Street, City, State, Zip */}
            <Box sx={{ width: '100%' }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LocationIcon fontSize="small" /> End Location
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
                <TextField
                  label="Street Address"
                  value={endAddressParts.street}
                  onChange={(e) => updateEndAddressPart('street', e.target.value)}
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
                    Select Address
                  </Button>
                )}
              </Box>
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
                          setFormData(prev => ({ ...prev, endLocation: baseAddr }));
                          setEndAddressParts(parseAddressToParts(baseAddr));
                          setErrors(prev => ({ ...prev, purpose: '', endLocation: '' }));
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

            {/* Purpose */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Purpose"
                value={formData.purpose}
                onChange={(e) => handleInputChange('purpose', e.target.value)}
                error={!!errors.purpose}
                helperText={errors.purpose}
                multiline
                rows={2}
                disabled={returnToBA}
                placeholder={returnToBA ? 'Return to base (optional)' : undefined}
              />
            </Box>

            {/* Miles - primary field; Calculate miles using Google Maps */}
            <Box sx={{ width: '100%' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 2 }}>
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
        title={`Select ${addressSelectorType === 'start' ? 'Start' : 'End'} Location`}
      />
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
            {/* Date */}
            <Box sx={{ width: '100%' }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Date"
                  value={formData.date ? dayjs(formData.date) : null}
                  onChange={(newValue: Dayjs | null) => {
                    if (newValue) {
                      handleInputChange('date', newValue.format('YYYY-MM-DD'));
                    }
                  }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      InputProps: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <CalendarIcon />
                          </InputAdornment>
                        ),
                      },
                    },
                  }}
                />
              </LocalizationProvider>
            </Box>

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
            {/* Date */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

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
