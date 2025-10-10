import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, Button } from '@mui/material';

// Import all portal components
import StaffPortal from './StaffPortal';
import SupervisorPortal from './components/SupervisorPortal';
import { AdminPortal } from './components/AdminPortal';
import Login from './components/Login';
import LoginForm from './components/LoginForm';
import PortalSwitcher from './components/PortalSwitcher';
// import AuthService from './services/authService'; // Currently unused

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentPortal, setCurrentPortal] = useState<'admin' | 'supervisor' | 'staff'>('staff');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuthStatus = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
          // Verify token with backend
          try {
            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3002'}/api/auth/verify`, {
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            });
            
            if (!response.ok) {
              // Invalid token, clear and force re-login
              console.warn('Invalid auth token, clearing localStorage');
              localStorage.clear();
              setCurrentUser(null);
              setLoading(false);
              return;
            }
            
            // Valid token, get employee data
            const { employee } = await response.json();
            setCurrentUser(employee);
            
            // Set initial portal based on user position
            const position = employee?.position?.toLowerCase() || '';
            if (position.includes('admin') || position.includes('ceo')) {
              setCurrentPortal('admin');
            } else if (position.includes('supervisor') || position.includes('director')) {
              setCurrentPortal('supervisor');
            } else {
              setCurrentPortal('staff');
            }
          } catch (error) {
            console.error('Error verifying token:', error);
            // Clear localStorage on error
            localStorage.clear();
            setCurrentUser(null);
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);


  const handleLogout = async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      if (authToken) {
        // Call logout endpoint
        await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3002'}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear state and localStorage regardless of API call success
      setCurrentUser(null);
      setCurrentPortal('staff');
      localStorage.clear();
    }
  };

  const handlePortalChange = (portal: 'admin' | 'supervisor' | 'staff') => {
    setCurrentPortal(portal);
  };

  const handleLoginSuccess = (employee: any, token: string) => {
    setCurrentUser(employee);
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentEmployeeId', employee.id);
    localStorage.setItem('employeeData', JSON.stringify(employee));
    
    // Set initial portal based on user position
    const position = employee?.position?.toLowerCase() || '';
    if (position.includes('admin') || position.includes('ceo')) {
      setCurrentPortal('admin');
    } else if (position.includes('supervisor') || position.includes('director')) {
      setCurrentPortal('supervisor');
    } else {
      setCurrentPortal('staff');
    }
  };

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          Loading...
        </Box>
      </ThemeProvider>
    );
  }

  // Login Screen
  if (!currentUser) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  // Determine which portal to show based on current portal selection
  const renderPortal = () => {
    switch (currentPortal) {
      case 'admin':
        return <AdminPortal adminId={currentUser.id} adminName={currentUser.name} />;
      case 'supervisor':
        return <SupervisorPortal supervisorId={currentUser.id} supervisorName={currentUser.name} />;
      case 'staff':
      default:
        return (
          <StaffPortal
            employeeId={currentUser.id}
            reportMonth={new Date().getMonth() + 1}
            reportYear={new Date().getFullYear()}
          />
        );
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box>
        <PortalSwitcher
          currentUser={currentUser}
          currentPortal={currentPortal}
          onPortalChange={handlePortalChange}
          onLogout={handleLogout}
        />
        {renderPortal()}
      </Box>
    </ThemeProvider>
  );
};

export default App;