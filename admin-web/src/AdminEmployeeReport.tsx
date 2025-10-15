// Supervisor Employee Report - Uses StaffPortal interface for supervisor review
import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PictureAsPdf as PdfIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';

import StaffPortal from './StaffPortal';

// Employee data structure
interface Employee {
  id: string;
  name: string;
  email: string;
  position: string;
  phoneNumber: string;
  baseAddress: string;
  baseAddress2?: string;
  costCenters: string[];
  createdAt: string;
}

const SupervisorEmployeeReport: React.FC = () => {
  // State management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [viewingReport, setViewingReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);

  // Get selected employee object
  const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId) || null;

  // Debug logging
  // AdminEmployeeReport render

  // Load employees on component mount
  useEffect(() => {
    loadEmployees();
  }, []);

  // Function to load all employees from the data sync service
  const loadEmployees = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Import DataSyncService dynamically to avoid circular dependencies
      const { DataSyncService } = await import('./services/dataSyncService');
      const employeesData = await DataSyncService.getEmployees();
      
      // Parse costCenters from JSON string if needed
      const parsedEmployees = employeesData.map((emp: any) => {
        let costCenters = [];
        try {
          if (typeof emp.costCenters === 'string') {
            costCenters = emp.costCenters ? JSON.parse(emp.costCenters) : [];
          } else {
            costCenters = emp.costCenters || [];
          }
        } catch (e) {
          console.warn(`Failed to parse cost centers for employee ${emp.name}:`, e);
          costCenters = [];
        }
        return {
          ...emp, 
          costCenters: Array.isArray(costCenters) ? costCenters : []
        };
      });

      setEmployees(parsedEmployees);
      // Employees loaded successfully
    } catch (err) {
      console.error('❌ Error loading employees:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to load employees: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle employee selection
  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setViewingReport(false); // Reset viewing state when employee changes
  };

  const handleViewReport = () => {
    if (selectedEmployeeId) {
      setViewingReport(true);
    }
  };

  // Function to go back to supervisor dashboard
  const handleBackToSupervisor = () => {
    setSelectedEmployeeId('');
    setViewingReport(false);
  };

  // Function to export report as PDF
  const handleExportPdf = () => {
    if (!selectedEmployee) return;
    
    // For now, just show a success message
    // In the future, this will generate and download a PDF
    setSuccess(`PDF export for ${selectedEmployee.name} - ${reportMonth}/${reportYear} will be implemented soon!`);
    
    // PDF Export requested
  };

  // Handle signature file upload
  const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'image/png') {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSignatureImage(e.target?.result as string);
        setSignatureDialogOpen(false);
        setSuccess('Signature uploaded successfully!');
      };
      reader.readAsDataURL(file);
    } else {
      setError('Please select a PNG file for the signature.');
    }
  };

  // Handle signature removal
  const handleRemoveSignature = () => {
    setSignatureImage(null);
    setSuccess('Signature removed successfully!');
  };

  // If an employee is selected and viewing report, show the StaffPortal interface
  if (selectedEmployee && viewingReport) {
    return (
      <Box>
        {/* Admin Header with Back Button and PDF Export */}
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <Button 
              color="inherit" 
              startIcon={<ArrowBackIcon />} 
              onClick={handleBackToSupervisor}
              sx={{ mr: 2 }}
            >
              Back to Supervisor
            </Button>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Supervisor Review: {selectedEmployee.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mr: 2 }}>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Month</InputLabel>
                <Select
                  value={reportMonth}
                  onChange={(e) => setReportMonth(Number(e.target.value))}
                  label="Month"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <MenuItem key={i + 1} value={i + 1}>
                      {new Date(0, i).toLocaleString('default', { month: 'long' })}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <InputLabel>Year</InputLabel>
                <Select
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                  label="Year"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Box>
            <Button 
              color="inherit" 
              startIcon={<UploadIcon />} 
              onClick={() => {
                // Supervisor Signature button clicked
                setSignatureDialogOpen(true);
              }}
              disabled={loading}
            >
              Supervisor Signature
            </Button>
            <Button 
              color="inherit" 
              startIcon={<PdfIcon />} 
              onClick={handleExportPdf}
              disabled={loading}
            >
              Export PDF
            </Button>
          </Toolbar>
        </AppBar>

        {/* StaffPortal Interface for Supervisor Review */}
        <StaffPortal 
          employeeId={selectedEmployee.id}
          reportMonth={reportMonth}
          reportYear={reportYear}
          isAdminView={true} // Pass flag to indicate this is supervisor view
          supervisorSignature={signatureImage} // Pass supervisor signature
        />
      </Box>
    );
  }

  // Employee selection interface
  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Supervisor Employee Report Review
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        {/* Error message display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Success message display */}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Employee Selection Card */}
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Select Employee Report to Review
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 600 }}>
              {/* Employee selection dropdown */}
              <FormControl fullWidth>
                <InputLabel>Employee</InputLabel>
                <Select<string>
                  value={selectedEmployeeId}
                  onChange={(e) => handleEmployeeSelect(e.target.value)}
                  label="Employee"
                  disabled={loading}
                >
                  {employees.map((employee) => (
                    <MenuItem key={employee.id} value={employee.id}>
                      {employee.name} - {employee.position}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              {/* Month and Year selection */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* Month selection dropdown */}
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel>Month</InputLabel>
                  <Select
                    value={reportMonth}
                    onChange={(e) => setReportMonth(Number(e.target.value))}
                    label="Month"
                    disabled={loading}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <MenuItem key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString('default', { month: 'long' })}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                {/* Year selection dropdown */}
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={reportYear}
                    onChange={(e) => setReportYear(Number(e.target.value))}
                    label="Year"
                    disabled={loading}
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <MenuItem key={year} value={year}>
                          {year}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Box>

              {/* Loading indicator */}
              {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <CircularProgress />
                </Box>
              )}

              {/* View Report Button */}
              <Button
                variant="contained"
                color="primary"
                onClick={handleViewReport}
                disabled={!selectedEmployeeId || loading}
                sx={{ mt: 2, alignSelf: 'flex-start' }}
              >
                View Report
              </Button>

              {/* Instructions */}
              <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                Select an employee and month/year, then click "View Report" to review their expense report. 
                You'll be able to view all tabs (Summary, Cost Centers, Timesheet, Receipt Management) 
                and export the report as a PDF.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>

      {/* Signature Dialog */}
      <Dialog open={signatureDialogOpen} onClose={() => {
        // Closing signature dialog
        setSignatureDialogOpen(false);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Supervisor Signature Capture</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="body1">
              Upload a PNG file containing your signature for the "Direct Supervisor" field. Please ensure the background is transparent or white for best results.
            </Typography>
            
            {signatureImage && (
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Current Signature:</Typography>
                <Box sx={{ 
                  border: '1px solid #ccc', 
                  borderRadius: 1, 
                  p: 2, 
                  bgcolor: 'white',
                  display: 'inline-block'
                }}>
                  <img 
                    src={signatureImage} 
                    alt="Supervisor Signature" 
                    style={{ 
                      maxHeight: '100px', 
                      maxWidth: '200px',
                      objectFit: 'contain'
                    }} 
                  />
                </Box>
              </Box>
            )}
            
            <input
              type="file"
              accept=".png"
              onChange={handleSignatureUpload}
              style={{ display: 'none' }}
              id="supervisor-signature-upload"
            />
            <label htmlFor="supervisor-signature-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<UploadIcon />}
                fullWidth
              >
                Choose PNG File
              </Button>
            </label>
            
            {signatureImage && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleRemoveSignature}
                fullWidth
              >
                Remove Signature
              </Button>
            )}
          </Box>

          <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
            <strong>Instructions:</strong>
            <br />• Use a PNG file with transparent background for best results
            <br />• Signature should be black or dark colored
            <br />• Recommended size: 200x100 pixels or similar
            <br />• This signature will appear in the "Direct Supervisor" field on the Approval Cover Sheet
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSignatureDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SupervisorEmployeeReport;
