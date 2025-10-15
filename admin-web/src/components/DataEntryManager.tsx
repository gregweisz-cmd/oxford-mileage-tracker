import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  // Grid, // Currently unused
  Chip,
  IconButton,
  // Dialog, // Currently unused
  // DialogTitle, // Currently unused
  // DialogContent, // Currently unused
  // DialogActions, // Currently unused
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  // CircularProgress, // Currently unused
  Tabs,
  Tab,
  Paper,
  // Tooltip, // Currently unused
  Menu,
  MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  DirectionsCar as CarIcon,
  Receipt as ReceiptIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
  // FilterList as FilterIcon // Currently unused
} from '@mui/icons-material';
import { DataSyncService } from '../services/dataSyncService';
import { Employee, MileageEntry, Receipt, TimeTracking } from '../types';
import { MileageEntryForm, ReceiptForm, TimeTrackingForm, MileageEntryFormData, ReceiptFormData, TimeTrackingFormData } from './DataEntryForms';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

interface DataEntryManagerProps {
  employee: Employee;
  month: number;
  year: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`data-entry-tabpanel-${index}`}
      aria-labelledby={`data-entry-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const DataEntryManager: React.FC<DataEntryManagerProps> = ({ employee, month, year }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mileageEntries, setMileageEntries] = useState<MileageEntry[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [timeTracking, setTimeTracking] = useState<TimeTracking[]>([]);
  
  // Form states
  const [mileageFormOpen, setMileageFormOpen] = useState(false);
  const [receiptFormOpen, setReceiptFormOpen] = useState(false);
  const [timeTrackingFormOpen, setTimeTrackingFormOpen] = useState(false);
  const [editingMileage, setEditingMileage] = useState<MileageEntry | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [editingTimeTracking, setEditingTimeTracking] = useState<TimeTracking | null>(null);
  
  // Context menu states
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    item: any;
    type: 'mileage' | 'receipt' | 'timeTracking';
  } | null>(null);

  const { notifyDataChange } = useRealtimeSync();

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mileageData, receiptsData, timeTrackingData] = await Promise.all([
        DataSyncService.getMileageEntries(employee.id, month, year),
        DataSyncService.getReceipts(employee.id, month, year),
        DataSyncService.getTimeTracking(employee.id, month, year)
      ]);

      setMileageEntries(mileageData);
      setReceipts(receiptsData);
      setTimeTracking(timeTrackingData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [employee.id, month, year]);

  useEffect(() => {
    loadData();
  }, [employee.id, month, year, loadData]);

  // Handle form submissions
  const handleMileageSave = async (formData: MileageEntryFormData) => {
    setLoading(true);
    try {
      // Prepare the data for the backend, mapping startingOdometer to odometerReading
      const backendData = {
        ...formData,
        odometerReading: formData.startingOdometer || 0
      };
      
      if (editingMileage) {
        // Update existing entry
        const response = await fetch(`http://localhost:3002/api/mileage-entries/${editingMileage.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backendData)
        });
        
        if (!response.ok) throw new Error('Failed to update mileage entry');
        
        // Update local state
        setMileageEntries(prev => prev.map(entry => 
          entry.id === editingMileage.id ? { ...entry, ...formData, date: new Date(formData.date), odometerReading: formData.startingOdometer } : entry
        ));
      } else {
        // Create new entry
        const response = await fetch('http://localhost:3002/api/mileage-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backendData)
        });
        
        if (!response.ok) throw new Error('Failed to create mileage entry');
        
        const newEntry = await response.json();
        // Ensure the new entry has all required fields for display
        const completeEntry = {
          ...formData,
          id: newEntry.id,
          date: new Date(formData.date),
          odometerReading: formData.startingOdometer,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setMileageEntries(prev => [...prev, completeEntry]);
      }
      
      setEditingMileage(null);
      setMileageFormOpen(false);
    } catch (error) {
      console.error('Error saving mileage entry:', error);
      alert('Error saving mileage entry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiptSave = async (formData: ReceiptFormData) => {
    setLoading(true);
    try {
      if (editingReceipt) {
        // Update existing receipt
        const response = await fetch(`http://localhost:3002/api/receipts/${editingReceipt.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        if (!response.ok) throw new Error('Failed to update receipt');
        
        // Update local state
        setReceipts(prev => prev.map(receipt => 
          receipt.id === editingReceipt.id ? { ...receipt, ...formData, date: new Date(formData.date) } : receipt
        ));
      } else {
        // Create new receipt
        const response = await fetch('http://localhost:3002/api/receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        if (!response.ok) throw new Error('Failed to create receipt');
        
        const newReceipt = await response.json();
        const completeReceipt = {
          ...newReceipt,
          date: new Date(newReceipt.date),
          createdAt: new Date(newReceipt.createdAt),
          updatedAt: new Date(newReceipt.updatedAt)
        };
        setReceipts(prev => [...prev, completeReceipt]);
      }
      
      setEditingReceipt(null);
      setReceiptFormOpen(false);
    } catch (error) {
      console.error('Error saving receipt:', error);
      alert('Error saving receipt. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeTrackingSave = async (formData: TimeTrackingFormData) => {
    setLoading(true);
    try {
      if (editingTimeTracking) {
        // Update existing entry
        const response = await fetch(`http://localhost:3002/api/time-tracking/${editingTimeTracking.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        if (!response.ok) throw new Error('Failed to update time tracking');
        
        // Update local state
        setTimeTracking(prev => prev.map(entry => 
          entry.id === editingTimeTracking.id ? { ...entry, ...formData, date: new Date(formData.date) } : entry
        ));
      } else {
        // Create new entry
        const response = await fetch('http://localhost:3002/api/time-tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        if (!response.ok) throw new Error('Failed to create time tracking');
        
        const newEntry = await response.json();
        const completeEntry = {
          ...newEntry,
          date: new Date(newEntry.date),
          createdAt: new Date(newEntry.createdAt),
          updatedAt: new Date(newEntry.updatedAt)
        };
        setTimeTracking(prev => [...prev, completeEntry]);
      }
      
      setEditingTimeTracking(null);
      setTimeTrackingFormOpen(false);
    } catch (error) {
      console.error('Error saving time tracking:', error);
      alert('Error saving time tracking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle deletions
  const handleDelete = async (id: string, type: 'mileage' | 'receipt' | 'timeTracking') => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;

    setLoading(true);
    try {
      const endpoint = type === 'mileage' ? 'mileage-entries' : 
                     type === 'receipt' ? 'receipts' : 'time-tracking';
      
      const response = await fetch(`http://localhost:3002/api/${endpoint}/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error(`Failed to delete ${type}`);
      
      // Update local state
      if (type === 'mileage') {
        setMileageEntries(prev => prev.filter(entry => entry.id !== id));
      } else if (type === 'receipt') {
        setReceipts(prev => prev.filter(receipt => receipt.id !== id));
      } else {
        setTimeTracking(prev => prev.filter(entry => entry.id !== id));
      }
      
      // Notify real-time sync
      notifyDataChange({
        type: type === 'mileage' ? 'mileage' : type === 'receipt' ? 'receipt' : 'time_tracking',
        action: 'delete',
        data: { id },
        timestamp: new Date(),
        employeeId: employee.id
      });
      
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      alert(`Error deleting ${type}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  // Context menu handlers
  const handleContextMenu = (event: React.MouseEvent, item: any, type: 'mileage' | 'receipt' | 'timeTracking') => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      item,
      type
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleEdit = (item: any, type: 'mileage' | 'receipt' | 'timeTracking') => {
    if (type === 'mileage') {
      setEditingMileage(item);
      setMileageFormOpen(true);
    } else if (type === 'receipt') {
      setEditingReceipt(item);
      setReceiptFormOpen(true);
    } else {
      setEditingTimeTracking(item);
      setTimeTrackingFormOpen(true);
    }
    handleContextMenuClose();
  };

  const handleDeleteFromContext = () => {
    if (contextMenu) {
      handleDelete(contextMenu.item.id, contextMenu.type);
      handleContextMenuClose();
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      // Handle different date formats
      let date: Date;
      if (dateString.includes('-')) {
        // Handle YYYY-MM-DD format
        date = new Date(dateString + 'T00:00:00');
      } else {
        // Handle other formats
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Invalid Date';
    }
  };

  // Convert MileageEntry to MileageEntryFormData
  const convertMileageToFormData = (entry: MileageEntry): MileageEntryFormData => ({
    id: entry.id,
    employeeId: entry.employeeId,
    date: entry.date instanceof Date ? entry.date.toISOString().split('T')[0] : entry.date,
    startLocation: entry.startLocation,
    endLocation: entry.endLocation,
    purpose: entry.purpose,
    miles: entry.miles,
    startingOdometer: entry.odometerReading || 0,
    notes: entry.notes || '',
    hoursWorked: entry.hoursWorked || 0,
    isGpsTracked: entry.isGpsTracked || false,
    costCenter: entry.costCenter || employee.defaultCostCenter || employee.selectedCostCenters?.[0] || ''
  });

  // Convert Receipt to ReceiptFormData
  const convertReceiptToFormData = (receipt: Receipt): ReceiptFormData => ({
    id: receipt.id,
    employeeId: receipt.employeeId,
    date: receipt.date instanceof Date ? receipt.date.toISOString().split('T')[0] : receipt.date,
    amount: receipt.amount,
    vendor: receipt.vendor,
    description: receipt.description || '',
    category: receipt.category,
    imageUri: receipt.imageUri || '',
    costCenter: receipt.costCenter || ''
  });

  // Convert TimeTracking to TimeTrackingFormData
  const convertTimeTrackingToFormData = (entry: TimeTracking): TimeTrackingFormData => ({
    id: entry.id,
    employeeId: entry.employeeId,
    date: entry.date instanceof Date ? entry.date.toISOString().split('T')[0] : entry.date,
    hours: entry.hours,
    type: entry.category, // Map category to type for form data
    description: entry.description || '',
    costCenter: entry.costCenter || ''
  });

  // Calculate totals
  const totalMiles = mileageEntries.reduce((sum, entry) => sum + (entry.miles || 0), 0);
  const totalReceipts = receipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);
  const totalHours = timeTracking.reduce((sum, entry) => sum + (entry.hours || 0), 0);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Data Entry Manager
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Mileage Entries
                  </Typography>
                  <Typography variant="h4">
                    {mileageEntries.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {totalMiles.toFixed(1)} miles
                  </Typography>
                </Box>
                <CarIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Receipts
                  </Typography>
                  <Typography variant="h4">
                    {receipts.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    ${totalReceipts.toFixed(2)}
                  </Typography>
                </Box>
                <ReceiptIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flex: '1 1 300px', minWidth: 300 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Time Entries
                  </Typography>
                  <Typography variant="h4">
                    {timeTracking.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {totalHours.toFixed(1)} hours
                  </Typography>
                </Box>
                <ScheduleIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          aria-label="data entry tabs"
        >
          <Tab label={`Mileage (${mileageEntries.length})`} icon={<CarIcon />} />
          <Tab label={`Receipts (${receipts.length})`} icon={<ReceiptIcon />} />
          <Tab label={`Time Tracking (${timeTracking.length})`} icon={<ScheduleIcon />} />
        </Tabs>

        {/* Mileage Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Mileage Entries</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingMileage(null);
                setMileageFormOpen(true);
              }}
            >
              Add Mileage Entry
            </Button>
          </Box>

          {mileageEntries.length === 0 ? (
            <Alert severity="info">
              No mileage entries found for this month. Click "Add Mileage Entry" to get started.
            </Alert>
          ) : (
            <List>
              {mileageEntries.map((entry, index) => (
                <React.Fragment key={entry.id}>
                  <ListItem
                    onContextMenu={(e) => handleContextMenu(e, entry, 'mileage')}
                    sx={{ cursor: 'context-menu' }}
                  >
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle1" component="span">
                            {entry.startLocation} → {entry.endLocation}
                          </Typography>
                          <Chip label={entry.costCenter || 'No Cost Center'} size="small" />
                        </Box>
                      }
                      secondary={
                        <Box component="div">
                          <Box component="span" display="block" color="text.secondary" fontSize="0.875rem">
                            {formatDate(entry.date instanceof Date ? entry.date.toISOString() : entry.date)} • {entry.miles} miles • {entry.hoursWorked || 0} hours
                          </Box>
                          <Box component="span" display="block" fontSize="0.875rem">
                            {entry.purpose}
                          </Box>
                        </Box>
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={(e) => handleContextMenu(e, entry, 'mileage')}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < mileageEntries.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </TabPanel>

        {/* Receipts Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Receipts</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingReceipt(null);
                setReceiptFormOpen(true);
              }}
            >
              Add Receipt
            </Button>
          </Box>

          {receipts.length === 0 ? (
            <Alert severity="info">
              No receipts found for this month. Click "Add Receipt" to get started.
            </Alert>
          ) : (
            <List>
              {receipts.map((receipt, index) => (
                <React.Fragment key={receipt.id}>
                  <ListItem
                    onContextMenu={(e) => handleContextMenu(e, receipt, 'receipt')}
                    sx={{ cursor: 'context-menu' }}
                  >
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle1" component="span">
                            {receipt.vendor}
                          </Typography>
                          <Chip label={receipt.category} size="small" />
                          <Chip label={receipt.costCenter || 'No Cost Center'} size="small" />
                        </Box>
                      }
                      secondary={
                        <Box component="div">
                          <Box component="span" display="block" color="text.secondary" fontSize="0.875rem">
                            {formatDate(receipt.date instanceof Date ? receipt.date.toISOString() : receipt.date)} • ${receipt.amount.toFixed(2)}
                          </Box>
                          <Box component="span" display="block" fontSize="0.875rem">
                            {receipt.description}
                          </Box>
                        </Box>
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={(e) => handleContextMenu(e, receipt, 'receipt')}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < receipts.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </TabPanel>

        {/* Time Tracking Tab */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Time Tracking</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingTimeTracking(null);
                setTimeTrackingFormOpen(true);
              }}
            >
              Add Time Entry
            </Button>
          </Box>

          {timeTracking.length === 0 ? (
            <Alert severity="info">
              No time entries found for this month. Click "Add Time Entry" to get started.
            </Alert>
          ) : (
            <List>
              {timeTracking.map((entry, index) => (
                <React.Fragment key={entry.id}>
                  <ListItem
                    onContextMenu={(e) => handleContextMenu(e, entry, 'timeTracking')}
                    sx={{ cursor: 'context-menu' }}
                  >
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="subtitle1" component="span">
                            {entry.category}
                          </Typography>
                          <Chip label={entry.costCenter || 'No Cost Center'} size="small" />
                        </Box>
                      }
                      secondary={
                        <Box component="div">
                          <Box component="span" display="block" color="text.secondary" fontSize="0.875rem">
                            {formatDate(entry.date instanceof Date ? entry.date.toISOString() : entry.date)} • {entry.hours} hours
                          </Box>
                          {entry.description && (
                            <Box component="span" display="block" fontSize="0.875rem">
                              {entry.description}
                            </Box>
                          )}
                        </Box>
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={(e) => handleContextMenu(e, entry, 'timeTracking')}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < timeTracking.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </TabPanel>
      </Paper>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => handleEdit(contextMenu?.item, contextMenu?.type!)}>
          <EditIcon sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDeleteFromContext} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Forms */}
      <MileageEntryForm
        open={mileageFormOpen}
        onClose={() => {
          setMileageFormOpen(false);
          setEditingMileage(null);
        }}
        onSave={handleMileageSave}
        employee={employee}
        initialData={editingMileage ? convertMileageToFormData(editingMileage) : undefined}
        mode={editingMileage ? 'edit' : 'create'}
        loading={loading}
      />

      <ReceiptForm
        open={receiptFormOpen}
        onClose={() => {
          setReceiptFormOpen(false);
          setEditingReceipt(null);
        }}
        onSave={handleReceiptSave}
        employee={employee}
        initialData={editingReceipt ? convertReceiptToFormData(editingReceipt) : undefined}
        mode={editingReceipt ? 'edit' : 'create'}
        loading={loading}
      />

      <TimeTrackingForm
        open={timeTrackingFormOpen}
        onClose={() => {
          setTimeTrackingFormOpen(false);
          setEditingTimeTracking(null);
        }}
        onSave={handleTimeTrackingSave}
        employee={employee}
        initialData={editingTimeTracking ? convertTimeTrackingToFormData(editingTimeTracking) : undefined}
        mode={editingTimeTracking ? 'edit' : 'create'}
        loading={loading}
      />
    </Box>
  );
};
