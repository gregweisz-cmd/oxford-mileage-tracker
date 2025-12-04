import React, { useState, useEffect } from 'react';
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
  InputLabel,
  Select,
  MenuItem,
  // Chip, // Currently unused
  // Alert, // Currently unused
  CircularProgress,
  IconButton,
  // Divider, // Currently unused
  Paper,
  FormControlLabel,
  Switch,
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
  AttachMoney as MoneyIcon
} from '@mui/icons-material';
// import { DataSyncService } from '../services/dataSyncService'; // Currently unused
import { Employee, MileageEntry, Receipt, TimeTracking } from '../types';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import AddressSelector from './AddressSelector';
import { debugLog, debugError } from '../config/debug';

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
  const { notifyDataChange } = useRealtimeSync();
  const [addressSelectorOpen, setAddressSelectorOpen] = useState(false);
  const [addressSelectorType, setAddressSelectorType] = useState<'start' | 'end'>('start');

  // Initialize form data only when dialog first opens or initialData changes
  useEffect(() => {
    if (initialData) {
      // Ensure cost center is populated, fallback to employee's default if missing
      setFormData({
        ...initialData,
        costCenter: initialData.costCenter || employee.defaultCostCenter || employee.selectedCostCenters?.[0] || ''
      });
    }
    // Don't reset to empty form if we already have data entered
  }, [initialData, employee.defaultCostCenter, employee.selectedCostCenters]);

  // Reset form when dialog opens for new entry (no initialData)
  useEffect(() => {
    if (open && !initialData && mode === 'create') {
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
      setErrors({});
    }
  }, [open, mode, employee?.defaultCostCenter, employee?.id, employee?.selectedCostCenters, initialData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.startLocation.trim()) {
      newErrors.startLocation = 'Start location is required';
    }
    if (!formData.endLocation.trim()) {
      newErrors.endLocation = 'End location is required';
    }
    if (!formData.purpose.trim()) {
      newErrors.purpose = 'Purpose is required';
    }
    if (formData.miles <= 0) {
      newErrors.miles = 'Miles must be greater than 0';
    }
    if (formData.hoursWorked < 0) {
      newErrors.hoursWorked = 'Hours worked cannot be negative';
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
        type: 'mileage',
        action: mode === 'edit' ? 'update' : 'create',
        data: formData,
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
    
    // Update form data directly to ensure it persists
    setFormData(prev => {
      const updated = addressSelectorType === 'start'
        ? { ...prev, startLocation: address }
        : { ...prev, endLocation: address };
      debugLog('📍 MileageEntryForm: Updated form data:', updated);
      return updated;
    });
    
    // Close the address selector after a brief delay
    setTimeout(() => {
      setAddressSelectorOpen(false);
    }, 100);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
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

            {/* Start Location */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Start Location"
                value={formData.startLocation}
                onChange={(e) => handleInputChange('startLocation', e.target.value)}
                error={!!errors.startLocation}
                helperText={errors.startLocation || 'Click the location button to select from saved addresses'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenAddressSelector('start')}
                      >
                        Select Address
                      </Button>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* End Location */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="End Location"
                value={formData.endLocation}
                onChange={(e) => handleInputChange('endLocation', e.target.value)}
                error={!!errors.endLocation}
                helperText={errors.endLocation || 'Click the location button to select from saved addresses'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenAddressSelector('end')}
                      >
                        Select Address
                      </Button>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

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
              />
            </Box>

            {/* Starting Odometer */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Starting Odometer"
                type="number"
                value={formData.startingOdometer || ''}
                onChange={(e) => handleInputChange('startingOdometer', parseFloat(e.target.value) || 0)}
                error={!!errors.startingOdometer}
                helperText={errors.startingOdometer || 'Enter the starting odometer reading'}
                inputProps={{ min: 0, step: 0.1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CarIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Miles */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Miles"
                type="number"
                value={formData.miles}
                onChange={(e) => handleInputChange('miles', parseFloat(e.target.value) || 0)}
                error={!!errors.miles}
                helperText={errors.miles}
                inputProps={{ min: 0, step: 0.1 }}
              />
            </Box>

            {/* Hours Worked */}
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Hours Worked"
                type="number"
                value={formData.hoursWorked}
                onChange={(e) => handleInputChange('hoursWorked', parseFloat(e.target.value) || 0)}
                error={!!errors.hoursWorked}
                helperText={errors.hoursWorked}
                inputProps={{ min: 0, step: 0.25 }}
              />
            </Box>

            {/* GPS Tracked */}
            <Box sx={{ width: '100%' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isGpsTracked}
                    onChange={(e) => handleInputChange('isGpsTracked', e.target.checked)}
                  />
                }
                label="GPS Tracked"
              />
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
    'EES',
    'Rental Car',
    'Rental Car Fuel',
    'Office Supplies',
    'Ground Transportation',
    'Phone/Internet/Fax',
    'Postage/Shipping',
    'Printing',
    'Airfare/Bus/Train',
    'Parking/Tolls',
    'Hotels/AirBnB',
    'Per Diem',
    'Meals',
    'Travel',
    'Communication',
    'Equipment',
    'Training',
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
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
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
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
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
