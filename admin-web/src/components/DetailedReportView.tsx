import React, { useState, useEffect } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardContent,
  Tabs,
  Tab,
  CircularProgress,
  IconButton,
  Checkbox,
  TextField,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  Receipt as ReceiptIcon,
  DirectionsCar as CarIcon,
  AccessTime as TimeIcon,
  Assessment as ChartIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';

// API configuration - use environment variable or default to localhost for development
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

interface MileageEntry {
  id: string;
  date: string;
  startLocation: string;
  endLocation: string;
  miles: number;
  purpose: string;
  costCenter?: string;
  notes?: string;
  isGpsTracked: boolean;
}

interface Receipt {
  id: string;
  date: string;
  amount: number;
  vendor: string;
  category: string;
  description?: string;
  costCenter?: string;
  imageUri?: string;
}

interface TimeEntry {
  id: string;
  date: string;
  category: string;
  hours: number;
  description?: string;
  costCenter?: string;
}

interface CostCenterBreakdown {
  costCenter: string;
  miles: number;
  expenses: number;
  hours: number;
  receiptCount: number;
  mileageCount: number;
  timeCount: number;
}

interface DetailedReportData {
  report: {
    id: string;
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    month: number;
    year: number;
    totalMiles: number;
    totalExpenses: number;
    status: string;
    submittedAt?: string;
    reviewedAt?: string;
  };
  mileageEntries: MileageEntry[];
  receipts: Receipt[];
  timeTracking: TimeEntry[];
  costCenterBreakdown: CostCenterBreakdown[];
  summary: {
    totalEntries: number;
    totalMiles: number;
    totalExpenses: number;
    totalHours: number;
    receiptCount: number;
    mileageCount: number;
    timeCount: number;
  };
}

interface DetailedReportViewProps {
  reportId: string;
  open: boolean;
  onClose: () => void;
}

const DetailedReportViewInner = ({ reportId, open, onClose }: DetailedReportViewProps) => {
  const [reportData, setReportData] = useState<DetailedReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  
  // Line-item revision state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedItemTypes, setSelectedItemTypes] = useState<Map<string, 'mileage' | 'receipt' | 'time'>>(new Map());
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [revisionReason, setRevisionReason] = useState('');
  const [submittingRevision, setSubmittingRevision] = useState(false);

  const loadDetailedReport = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/monthly-reports/${reportId}/detailed`);
      
      if (!response.ok) {
        throw new Error('Failed to load detailed report');
      }

      const data = await response.json();
      setReportData(data);
    } catch (err: any) {
      console.error('Error loading detailed report:', err);
      setError(err.message || 'Failed to load report details');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  // Track if we've already loaded this report
  const prevReportId = React.useRef<string | null>(null);
  const hasLoaded = React.useRef<boolean>(false);

  useEffect(() => {
    if (open && reportId && reportId.trim() !== '') {
      // Only reset tab and load if this is a new report or hasn't been loaded yet
      if (prevReportId.current !== reportId || !hasLoaded.current) {
        if (prevReportId.current !== reportId) {
          setActiveTab(0);
        }
        prevReportId.current = reportId;
        hasLoaded.current = true;
        loadDetailedReport();
      }
      // If same report ID and already loaded, do nothing - preserve tab state
    } else if (!open && prevReportId.current) {
      // Modal just closed - reset everything
      setReportData(null);
      setError(null);
      prevReportId.current = null;
      hasLoaded.current = false;
      // Clear selected items
      setSelectedItems(new Set());
      setSelectedItemTypes(new Map());
      setRevisionReason('');
      // Don't reset activeTab here - let user keep their preference
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reportId]);

  // Prevent unnecessary re-renders from parent polling by memoizing tab labels
  const tabLabels = React.useMemo(() => {
    if (!reportData) return [];
    const { summary } = reportData;
    const mileageCount = summary?.mileageCount || 0;
    const timeCount = summary?.timeCount || 0;
    const receiptCount = summary?.receiptCount || 0;
    return [
      { label: 'Approval Cover Sheet', icon: <ChartIcon /> },
      { label: 'Summary Sheet', icon: <ChartIcon /> },
      { label: 'Daily Report', icon: <ChartIcon /> },
      { label: `Mileage (${mileageCount})`, icon: <CarIcon /> },
      { label: 'Daily Descriptions', icon: <ChartIcon /> },
      { label: `Timesheet (${timeCount})`, icon: <TimeIcon /> },
      { label: `Receipts (${receiptCount})`, icon: <ReceiptIcon /> },
    ];
  }, [reportData]);

  const formatDate = (dateString: string) => {
    // Parse YYYY-MM-DD format directly to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-based in Date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatMonth = (month: number) => {
    const date = new Date(2000, month - 1, 1);
    return date.toLocaleString('en-US', { month: 'long' });
  };

  // Handler for item selection
  const handleItemToggle = (itemId: string, itemType: 'mileage' | 'receipt' | 'time') => {
    const newSelected = new Set(selectedItems);
    const newTypes = new Map(selectedItemTypes);
    
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      newTypes.delete(itemId);
    } else {
      newSelected.add(itemId);
      newTypes.set(itemId, itemType);
    }
    
    setSelectedItems(newSelected);
    setSelectedItemTypes(newTypes);
  };

  // Handler for requesting revision on selected items
  const handleRequestRevision = () => {
    if (selectedItems.size === 0) {
      alert('Please select at least one item to request revision');
      return;
    }
    setShowRevisionDialog(true);
  };

  // Handler for submitting revision request
  const handleSubmitRevision = async () => {
    if (!revisionReason.trim()) {
      alert('Please provide a reason for the revision request');
      return;
    }

    try {
      setSubmittingRevision(true);
      
      const items = Array.from(selectedItems).map(itemId => ({
        id: itemId,
        type: selectedItemTypes.get(itemId),
        reason: revisionReason
      }));

      const response = await fetch(`${API_BASE_URL}/api/monthly-reports/${reportId}/request-line-item-revision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestedBy: 'greg-weisz-001', // TODO: Get from current user context
          items,
          reason: revisionReason
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit revision request');
      }

      // Success
      setShowRevisionDialog(false);
      setSelectedItems(new Set());
      setSelectedItemTypes(new Map());
      setRevisionReason('');
      
      // Reload the report to show updated status
      await loadDetailedReport();
      
      alert('Revision request submitted successfully');
    } catch (err: any) {
      console.error('Error submitting revision request:', err);
      alert(`Failed to submit revision request: ${err.message}`);
    } finally {
      setSubmittingRevision(false);
    }
  };

  // Generate all days of the month with aggregated data for Daily Report
  const dailyReportData = React.useMemo(() => {
    if (!reportData || !reportData.report) return [];
    
    const { report, timeTracking = [], mileageEntries = [], receipts = [] } = reportData;
    const year = report.year;
    const month = report.month; // DB stores 1-12 (Jan=1, Oct=10)
    
    // Get number of days in the month
    // JavaScript Date months are 0-11, so we pass month-1 for Date constructor
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Create a map of entries by date
    const entriesByDate: any = {};
    
    // Add time tracking entries (Daily Descriptions)
    timeTracking.forEach(entry => {
      const date = entry.date;
      if (!entriesByDate[date]) {
        entriesByDate[date] = { dailyDesc: [], mileageDesc: [], hours: 0, miles: 0, mileageAmt: 0, receiptAmt: 0, costCenters: new Set() };
      }
      const desc = entry.description || entry.category;
      entriesByDate[date].dailyDesc.push(desc);
      entriesByDate[date].hours += entry.hours;
      if (entry.costCenter) entriesByDate[date].costCenters.add(entry.costCenter);
    });
    
    // Add mileage entries
    mileageEntries.forEach(entry => {
      const date = entry.date;
      if (!entriesByDate[date]) {
        entriesByDate[date] = { dailyDesc: [], mileageDesc: [], hours: 0, miles: 0, mileageAmt: 0, receiptAmt: 0, costCenters: new Set() };
      }
      // Format as "location name (address)"
      const startLoc = entry.startLocation.includes('(') ? entry.startLocation : `${entry.startLocation} (${entry.startLocation})`;
      const endLoc = entry.endLocation.includes('(') ? entry.endLocation : `${entry.endLocation} (${entry.endLocation})`;
      const mileageText = `${startLoc} → ${endLoc}`;
      entriesByDate[date].mileageDesc.push(mileageText);
      entriesByDate[date].miles += entry.miles;
      entriesByDate[date].mileageAmt += entry.miles * 0.445;
      if (entry.costCenter) entriesByDate[date].costCenters.add(entry.costCenter);
    });

    // Add receipts (only amounts, not descriptions)
    receipts.forEach(receipt => {
      const date = receipt.date;
      if (!entriesByDate[date]) {
        entriesByDate[date] = { descriptions: [], hours: 0, miles: 0, mileageAmt: 0, receiptAmt: 0, costCenters: new Set() };
      }
      // Don't add receipt to descriptions - only track the amount
      entriesByDate[date].receiptAmt += receipt.amount;
      if (receipt.costCenter) entriesByDate[date].costCenters.add(receipt.costCenter);
    });
    
    // Generate array with ALL days of the month
    const allDays = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = entriesByDate[dateStr];
      
      // Format description: Daily Descriptions first, then "Driving:" with chained mileage entries
      let description = '';
      if (dayData) {
        if (dayData.dailyDesc && dayData.dailyDesc.length > 0) {
          description = dayData.dailyDesc.join('; ');
        }
        if (dayData.mileageDesc && dayData.mileageDesc.length > 0) {
          if (description) {
            description += '\n\nDriving: ' + dayData.mileageDesc.join(' → ');
          } else {
            description = 'Driving: ' + dayData.mileageDesc.join(' → ');
          }
        }
      }
      
      allDays.push({
        date: dateStr,
        description: description || '-',
        hours: dayData?.hours || 0,
        miles: dayData?.miles || 0,
        mileageAmt: dayData?.mileageAmt || 0,
        receiptAmt: dayData?.receiptAmt || 0,
        costCenters: dayData ? Array.from(dayData.costCenters) : [],
      });
    }
    
    return allDays;
  }, [reportData]);
  
  // Calculate cost center breakdown if not provided - MUST be before any early returns
  const costCenterBreakdown = React.useMemo(() => {
    if (!reportData) return [];
    
    const { costCenterBreakdown: rawCostCenterBreakdown, mileageEntries = [], receipts = [], timeTracking = [] } = reportData;
    
    if (rawCostCenterBreakdown && rawCostCenterBreakdown.length > 0) {
      return rawCostCenterBreakdown;
    }
    
    // Build breakdown from entries
    const ccMap = new Map<string, {
      costCenter: string;
      miles: number;
      expenses: number;
      hours: number;
      receiptCount: number;
      mileageCount: number;
      timeCount: number;
    }>();
    
    mileageEntries.forEach(entry => {
      const cc = entry.costCenter || 'Unassigned';
      const existing = ccMap.get(cc) || {
        costCenter: cc,
        miles: 0,
        expenses: 0,
        hours: 0,
        receiptCount: 0,
        mileageCount: 0,
        timeCount: 0
      };
      existing.miles += entry.miles || 0;
      existing.expenses += (entry.miles || 0) * 0.655;
      existing.mileageCount++;
      ccMap.set(cc, existing);
    });
    
    receipts.forEach(receipt => {
      const cc = receipt.costCenter || 'Unassigned';
      const existing = ccMap.get(cc) || {
        costCenter: cc,
        miles: 0,
        expenses: 0,
        hours: 0,
        receiptCount: 0,
        mileageCount: 0,
        timeCount: 0
      };
      existing.expenses += receipt.amount || 0;
      existing.receiptCount++;
      ccMap.set(cc, existing);
    });
    
    timeTracking.forEach(entry => {
      const cc = entry.costCenter || 'Unassigned';
      const existing = ccMap.get(cc) || {
        costCenter: cc,
        miles: 0,
        expenses: 0,
        hours: 0,
        receiptCount: 0,
        mileageCount: 0,
        timeCount: 0
      };
      existing.hours += entry.hours || 0;
      existing.timeCount++;
      ccMap.set(cc, existing);
    });
    
    return Array.from(ccMap.values());
  }, [reportData]);

  if (loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Loading detailed report...</Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
        <DialogContent>
          <Typography color="error">{error}</Typography>
        </DialogContent>
      </Dialog>
    );
  }

  if (!reportData) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
        <DialogContent>
          <Typography>No report data available</Typography>
        </DialogContent>
      </Dialog>
    );
  }

  const { report, summary, mileageEntries, receipts, timeTracking } = reportData;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth sx={{ '& .MuiDialog-paper': { height: '90vh' } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h5" fontWeight="bold">
          {report.employeeName}'s Expense Report
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Supervisor View Banner */}
      <Box sx={{ bgcolor: 'info.light', color: 'info.contrastText', p: 1.5, px: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2">
          <strong>Supervisor View:</strong> You are viewing {report.employeeName}'s expense report in supervisor mode. Some features like direct editing may be limited.
        </Typography>
      </Box>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Report Sections Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            {tabLabels.map((tab, index) => (
              <Tab key={index} label={tab.label} icon={tab.icon} iconPosition="start" />
            ))}
          </Tabs>
        </Box>

        {/* Tab Content */}
        <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 3 }}>
          {/* Approval Cover Sheet Tab */}
          {activeTab === 0 && (
            <Box>
              <Typography variant="h4" align="center" fontWeight="bold" gutterBottom>
                MONTHLY EXPENSE REPORT APPROVAL COVER SHEET
              </Typography>
              <Typography variant="h5" align="center" gutterBottom>
                OXFORD HOUSE, INC.
              </Typography>
              <Typography align="center" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
                1010 Wayne Ave. Suite # 300, Silver Spring, MD 20910
              </Typography>

              <Box sx={{ display: 'flex', gap: 4, mb: 4 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1"><strong>Name:</strong> {report.employeeName}</Typography>
                  <Typography variant="body1"><strong>Month:</strong> {formatMonth(report.month)}, {report.year}</Typography>
                  <Typography variant="body1"><strong>Date Completed:</strong> {new Date().toLocaleDateString('en-US')}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" gutterBottom><strong>Cost Centers:</strong></Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {costCenterBreakdown.map((cc, idx) => (
                      <Button key={idx} variant="outlined" size="small" sx={{ justifyContent: 'flex-start' }}>
                        {idx + 1}.) {cc.costCenter}
                      </Button>
                    ))}
                  </Box>
                </Box>
              </Box>

              <Box sx={{ bgcolor: 'warning.light', p: 2, mb: 4 }}>
                <Typography variant="body2" color="error" component="div">
                  <strong>* Note:</strong> Signature also required on Summary Sheet & Timesheet
                </Typography>
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                  <strong>* Note:</strong> In order to be reimbursed for per diem, your daily work activities must entail your having been away from home for a minimum of eight hours, as documented in your Travel
                </Typography>
              </Box>

              <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
                Signatures of Approval:
              </Typography>
              <Box sx={{ display: 'flex', gap: 4, mt: 2 }}>
                <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom><strong>Employee Signature</strong></Typography>
                  <Typography variant="body2" color="text.secondary">Upload signature using 'Signature Capture' button</Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>{report.employeeName}</Typography>
                  <Box sx={{ mt: 2, borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
                    <Typography variant="caption">Date: __________</Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom><strong>Direct Supervisor</strong></Typography>
                  <Box sx={{ mt: 4, borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
                    <Typography variant="caption">Signature: __________</Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>Date: __________</Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1, border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom><strong>Finance Department</strong></Typography>
                  <Box sx={{ mt: 4, borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
                    <Typography variant="caption">Signature: __________</Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>Date: __________</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}

          {/* Summary Sheet Tab */}
          {activeTab === 1 && (
            <Box>
              <Typography variant="h5" gutterBottom>Expense Summary</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Total Miles</Typography>
                    <Typography variant="h5">{summary?.totalMiles?.toFixed(1) || '0.0'}</Typography>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Total Expenses</Typography>
                    <Typography variant="h5">${summary?.totalExpenses?.toFixed(2) || '0.00'}</Typography>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Total Hours</Typography>
                    <Typography variant="h5">{summary?.totalHours?.toFixed(1) || '0.0'}</Typography>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">Total Entries</Typography>
                    <Typography variant="h5">{summary?.totalEntries || 0}</Typography>
                  </CardContent>
                </Card>
              </Box>

              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Cost Center Breakdown</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Cost Center</TableCell>
                      <TableCell align="right">Miles</TableCell>
                      <TableCell align="right">Expenses</TableCell>
                      <TableCell align="right">Hours</TableCell>
                      <TableCell align="right">Entries</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {costCenterBreakdown.map((cc, index) => (
                      <TableRow key={index}>
                        <TableCell><Chip label={cc.costCenter} size="small" variant="outlined" /></TableCell>
                        <TableCell align="right">{cc.miles.toFixed(1)}</TableCell>
                        <TableCell align="right">${cc.expenses.toFixed(2)}</TableCell>
                        <TableCell align="right">{cc.hours.toFixed(1)}</TableCell>
                        <TableCell align="right">{cc.mileageCount + cc.receiptCount + cc.timeCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          )}

          {/* Daily Report Tab */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h5" gutterBottom>
                Daily Report - Mileage & Per Diem
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Mileage Rate: $0.445 per mile
              </Typography>
              <TableContainer>
                <Table size="small" sx={{ border: '1px solid #ccc', '& td, & th': { border: '1px solid #ccc' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>Date</TableCell>
                      <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>Description of Activity</TableCell>
                      <TableCell align="right" sx={{ border: '1px solid #ccc', p: 1 }}>Hours</TableCell>
                      <TableCell align="right" sx={{ border: '1px solid #ccc', p: 1 }}>Miles</TableCell>
                      <TableCell align="right" sx={{ border: '1px solid #ccc', p: 1 }}>Mileage ($)</TableCell>
                      <TableCell align="right" sx={{ border: '1px solid #ccc', p: 1 }}>Receipts ($)</TableCell>
                      <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>Cost Center</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dailyReportData.map((day: any, index: number) => (
                      <TableRow 
                        key={day.date} 
                        hover={!!day.description}
                        sx={!day.description ? { bgcolor: 'grey.50' } : {}}
                      >
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>{formatDate(day.date)}</TableCell>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                          <Box sx={{ whiteSpace: 'pre-wrap' }}>
                            {day.description || '-'}
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ border: '1px solid #ccc', p: 1 }}>
                          {day.hours > 0 ? day.hours.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ border: '1px solid #ccc', p: 1 }}>
                          {day.miles > 0 ? day.miles.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ border: '1px solid #ccc', p: 1 }}>
                          {day.mileageAmt > 0 ? `$${day.mileageAmt.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ border: '1px solid #ccc', p: 1 }}>
                          {day.receiptAmt > 0 ? `$${day.receiptAmt.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell sx={{ border: '1px solid #ccc', p: 1 }}>
                          {day.costCenters.length > 0 ? (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {day.costCenters.map((cc: string, idx: number) => (
                                <Chip key={idx} label={cc} size="small" variant="outlined" />
                              ))}
                            </Box>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Mileage Entries Tab */}
          {activeTab === 3 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Mileage Entries</Typography>
                {selectedItems.size > 0 && (
                  <Button 
                    variant="contained" 
                    color="warning" 
                    onClick={handleRequestRevision}
                    disabled={submittingRevision}
                  >
                    Request Revision on {selectedItems.size} Item{selectedItems.size > 1 ? 's' : ''}
                  </Button>
                )}
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Request Revision</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Route</TableCell>
                      <TableCell align="right">Miles</TableCell>
                      <TableCell>Purpose</TableCell>
                      <TableCell>Cost Center</TableCell>
                      <TableCell>GPS</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mileageEntries.map((entry) => {
                      const needsRevision = (entry as any).needsRevision;
                      return (
                        <TableRow 
                          key={entry.id} 
                          hover
                          sx={needsRevision ? { bgcolor: 'warning.light' } : {}}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedItems.has(entry.id)}
                              onChange={() => handleItemToggle(entry.id, 'mileage')}
                            />
                          </TableCell>
                          <TableCell>{formatDate(entry.date)}</TableCell>
                          <TableCell>
                            <Typography variant="body2">{entry.startLocation}</Typography>
                            <Typography variant="caption" color="text.secondary">↓ {entry.endLocation}</Typography>
                          </TableCell>
                          <TableCell align="right">{entry.miles.toFixed(1)}</TableCell>
                          <TableCell>{entry.purpose || '-'}</TableCell>
                          <TableCell><Chip label={entry.costCenter || 'Unassigned'} size="small" /></TableCell>
                          <TableCell>
                            {entry.isGpsTracked ? <Chip label="GPS" size="small" color="success" /> : <Typography variant="caption" color="text.secondary">Manual</Typography>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {mileageEntries.length === 0 && (
                      <TableRow><TableCell colSpan={7} align="center"><Typography color="text.secondary">No mileage entries</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Daily Descriptions Tab */}
          {activeTab === 4 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" gutterBottom>Daily Descriptions</Typography>
                  <Typography color="text.secondary">Daily work descriptions and activities for {formatMonth(report.month)} {report.year}</Typography>
                </Box>
                {selectedItems.size > 0 && (
                  <Button 
                    variant="contained" 
                    color="warning" 
                    onClick={handleRequestRevision}
                    disabled={submittingRevision}
                  >
                    Request Revision on {selectedItems.size} Item{selectedItems.size > 1 ? 's' : ''}
                  </Button>
                )}
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Request Revision</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Cost Center</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {timeTracking.map((entry) => {
                      const needsRevision = (entry as any).needsRevision;
                      return (
                        <TableRow 
                          key={entry.id} 
                          hover
                          sx={needsRevision ? { bgcolor: 'warning.light' } : {}}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedItems.has(entry.id)}
                              onChange={() => handleItemToggle(entry.id, 'time')}
                            />
                          </TableCell>
                          <TableCell>{formatDate(entry.date)}</TableCell>
                          <TableCell>{entry.category}: {entry.description || '-'}</TableCell>
                          <TableCell><Chip label={entry.costCenter || 'Unassigned'} size="small" /></TableCell>
                        </TableRow>
                      );
                    })}
                    {timeTracking.length === 0 && (
                      <TableRow><TableCell colSpan={4} align="center"><Typography color="text.secondary">No descriptions available</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Timesheet Tab */}
          {activeTab === 5 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Timesheet - {formatMonth(report.month)} {report.year}</Typography>
                {selectedItems.size > 0 && (
                  <Button 
                    variant="contained" 
                    color="warning" 
                    onClick={handleRequestRevision}
                    disabled={submittingRevision}
                  >
                    Request Revision on {selectedItems.size} Item{selectedItems.size > 1 ? 's' : ''}
                  </Button>
                )}
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Request Revision</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">Hours</TableCell>
                      <TableCell>Cost Center</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {timeTracking.map((entry) => {
                      const needsRevision = (entry as any).needsRevision;
                      return (
                        <TableRow 
                          key={entry.id} 
                          hover
                          sx={needsRevision ? { bgcolor: 'warning.light' } : {}}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedItems.has(entry.id)}
                              onChange={() => handleItemToggle(entry.id, 'time')}
                            />
                          </TableCell>
                          <TableCell>{formatDate(entry.date)}</TableCell>
                          <TableCell>{entry.category}</TableCell>
                          <TableCell align="right">{entry.hours.toFixed(1)}</TableCell>
                          <TableCell><Chip label={entry.costCenter || 'Unassigned'} size="small" /></TableCell>
                          <TableCell>{entry.description || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                    {timeTracking.length === 0 && (
                      <TableRow><TableCell colSpan={6} align="center"><Typography color="text.secondary">No time entries</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Receipts Tab */}
          {activeTab === 6 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Receipt Management</Typography>
                {selectedItems.size > 0 && (
                  <Button 
                    variant="contained" 
                    color="warning" 
                    onClick={handleRequestRevision}
                    disabled={submittingRevision}
                  >
                    Request Revision on {selectedItems.size} Item{selectedItems.size > 1 ? 's' : ''}
                  </Button>
                )}
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Request Revision</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Image</TableCell>
                      <TableCell>Vendor</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Cost Center</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {receipts.map((receipt) => {
                      const needsRevision = (receipt as any).needsRevision;
                      return (
                        <TableRow 
                          key={receipt.id} 
                          hover
                          sx={needsRevision ? { bgcolor: 'warning.light' } : {}}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedItems.has(receipt.id)}
                              onChange={() => handleItemToggle(receipt.id, 'receipt')}
                            />
                          </TableCell>
                          <TableCell>{formatDate(receipt.date)}</TableCell>
                          <TableCell>
                            {(() => {
                              const raw = receipt.imageUri || '';
                              // Only render if it's a backend-served path, not a local file URI
                              if (!raw || raw.startsWith('file://')) {
                                return <Typography variant="caption" color="text.secondary">No image</Typography>;
                              }
                              const path = raw.startsWith('/uploads')
                                ? raw
                                : (raw.startsWith('uploads')
                                  ? `/${raw}`
                                  : (`/uploads/${raw}`));
                              if (!path) {
                                return <Typography variant="caption" color="text.secondary">No image</Typography>;
                              }
                              const src = `${API_BASE_URL}${path}`;
                              return (
                                <img
                                  src={src}
                                  alt={receipt.vendor || 'Receipt'}
                                  style={{ maxWidth: 80, maxHeight: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }}
                                />
                              );
                            })()}
                          </TableCell>
                          <TableCell>{receipt.vendor}</TableCell>
                          <TableCell>{receipt.category}</TableCell>
                          <TableCell align="right">${receipt.amount.toFixed(2)}</TableCell>
                          <TableCell><Chip label={receipt.costCenter || 'Unassigned'} size="small" /></TableCell>
                          <TableCell>{receipt.description || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                    {receipts.length === 0 && (
                      <TableRow><TableCell colSpan={7} align="center"><Typography color="text.secondary">No receipts</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose} variant="outlined">Close</Button>
        <Button startIcon={<DownloadIcon />} variant="contained" color="primary">
          Export Report
        </Button>
      </DialogActions>

      {/* Revision Request Dialog */}
      <Dialog open={showRevisionDialog} onClose={() => !submittingRevision && setShowRevisionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Request Revision on Selected Items</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            You have selected {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} for revision. 
            Please provide a reason for the revision request.
          </Alert>
          <TextField
            label="Revision Reason *"
            fullWidth
            multiline
            rows={4}
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
            helperText="Explain what needs to be corrected for the selected items"
            required
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRevisionDialog(false)} disabled={submittingRevision}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitRevision}
            variant="contained"
            color="warning"
            disabled={submittingRevision || !revisionReason.trim()}
          >
            {submittingRevision ? <CircularProgress size={20} /> : 'Submit Revision Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

// Memoize to prevent re-renders when parent re-renders due to polling
const DetailedReportView = React.memo(DetailedReportViewInner);

export default DetailedReportView;

