import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

interface TestData {
  employees: any[];
  mileageEntries: any[];
  receipts: any[];
  timeTracking: any[];
}

export const WebPortalSyncTester: React.FC = () => {
  const [testData, setTestData] = useState<TestData>({
    employees: [],
    mileageEntries: [],
    receipts: [],
    timeTracking: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadTestData();
  }, []);

  const loadTestData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';
      const [employeesRes, mileageRes, receiptsRes, timeRes] = await Promise.all([
        fetch(`${apiUrl}/api/employees`),
        fetch(`${apiUrl}/api/mileage-entries`),
        fetch(`${apiUrl}/api/receipts`),
        fetch(`${apiUrl}/api/time-tracking`)
      ]);

      if (!employeesRes.ok || !mileageRes.ok || !receiptsRes.ok || !timeRes.ok) {
        throw new Error('Failed to fetch data from backend');
      }

      const [employees, mileageEntries, receipts, timeTracking] = await Promise.all([
        employeesRes.json(),
        mileageRes.json(),
        receiptsRes.json(),
        timeRes.json()
      ]);

      setTestData({
        employees,
        mileageEntries,
        receipts,
        timeTracking
      });

      setSuccess(`✅ Successfully loaded data: ${employees.length} employees, ${mileageEntries.length} mileage entries, ${receipts.length} receipts, ${timeTracking.length} time entries`);
      
    } catch (err) {
      setError(`❌ Error loading data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testBackendConnection = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';
      const response = await fetch(`${apiUrl}/api/stats`);
      
      if (!response.ok) {
        throw new Error(`Backend not responding: ${response.status}`);
      }
      
      const stats = await response.json();
      setSuccess(`✅ Backend connection successful! Stats: ${JSON.stringify(stats)}`);
      
    } catch (err) {
      setError(`❌ Backend connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testCreateTestData = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Create a test employee
      const testEmployee = {
        name: `Web Test Employee ${Date.now()}`,
        email: `webtest${Date.now()}@example.com`,
        oxfordHouseId: 'web-test-house',
        position: 'Web Test Position',
        phoneNumber: '555-9999',
        baseAddress: '456 Web Test St, Web City, WC 54321',
        costCenters: ['WEB-TEST']
      };

      const apiUrl = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';
      const response = await fetch(`${apiUrl}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testEmployee)
      });

      if (!response.ok) {
        throw new Error(`Failed to create test employee: ${response.statusText}`);
      }

      const result = await response.json();
      setSuccess(`✅ Test employee created successfully: ${testEmployee.name} (ID: ${result.id})`);
      
      // Refresh data
      setTimeout(() => {
        loadTestData();
      }, 1000);
      
    } catch (err) {
      setError(`❌ Error creating test data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Web Portal Sync Tester
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Test web portal data synchronization with mobile app
      </Typography>

      {/* Status Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Test Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Test Controls
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
              onClick={testBackendConnection}
              disabled={loading}
            >
              Test Backend Connection
            </Button>
            
            <Button
              variant="contained"
              color="secondary"
              startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
              onClick={testCreateTestData}
              disabled={loading}
            >
              Create Test Data
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadTestData}
              disabled={loading}
            >
              Refresh Data
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Data Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Data Summary
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
              <Typography variant="h4" color="primary.contrastText">
                {testData.employees.length}
              </Typography>
              <Typography variant="body2" color="primary.contrastText">
                Employees
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'secondary.light', borderRadius: 1 }}>
              <Typography variant="h4" color="secondary.contrastText">
                {testData.mileageEntries.length}
              </Typography>
              <Typography variant="body2" color="secondary.contrastText">
                Mileage Entries
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
              <Typography variant="h4" color="success.contrastText">
                {testData.receipts.length}
              </Typography>
              <Typography variant="body2" color="success.contrastText">
                Receipts
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
              <Typography variant="h4" color="warning.contrastText">
                {testData.timeTracking.length}
              </Typography>
              <Typography variant="body2" color="warning.contrastText">
                Time Entries
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Recent Employees */}
      {testData.employees.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Employees
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Position</TableCell>
                    <TableCell>Phone</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {testData.employees.slice(0, 5).map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>{employee.name}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>{employee.phoneNumber}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Mileage Entries */}
      {testData.mileageEntries.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Mileage Entries
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Employee</TableCell>
                    <TableCell>Purpose</TableCell>
                    <TableCell>Miles</TableCell>
                    <TableCell>Start Location</TableCell>
                    <TableCell>End Location</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {testData.mileageEntries.slice(0, 5).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                      <TableCell>{entry.employeeName || 'Unknown'}</TableCell>
                      <TableCell>{entry.purpose}</TableCell>
                      <TableCell>{entry.miles}</TableCell>
                      <TableCell>{entry.startLocation}</TableCell>
                      <TableCell>{entry.endLocation}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Testing Instructions */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Testing Instructions
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>1. Test Backend Connection:</strong> Verify the backend API is accessible
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>2. Create Test Data:</strong> Add sample data to the backend
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>3. Mobile App Sync:</strong> Use the mobile app to sync data to backend
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>4. Verify Data:</strong> Check that mobile data appears in the web portal
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>5. Bidirectional Sync:</strong> Test syncing data from web portal to mobile app
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};
