import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, Button } from '@mui/material';

// Import all portal components
import StaffPortal from './StaffPortal';
import SupervisorPortal from './components/SupervisorPortal';
import { AdminPortal } from './components/AdminPortal';
import LoginForm from './components/LoginForm';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuthStatus = async () => {
      try {
        const user = localStorage.getItem('current_user');
        if (user) {
          setCurrentUser(JSON.parse(user));
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);


  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('current_user');
    // Clear all localStorage
    localStorage.clear();
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
        <LoginForm onLoginSuccess={(user) => {
          setCurrentUser(user);
          localStorage.setItem('current_user', JSON.stringify(user));
        }} />
      </ThemeProvider>
    );
  }

  // Determine which portal to show based on user role
  const renderPortal = () => {
    const userRole = currentUser?.role || 'employee';

    switch (userRole) {
      case 'admin':
        return <AdminPortal adminId={currentUser.id} adminName={currentUser.name} />;
      case 'supervisor':
        return <SupervisorPortal supervisorId={currentUser.id} supervisorName={currentUser.name} />;
      case 'employee':
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
        {/* Logout Button */}
        <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
          <Button variant="outlined" color="secondary" onClick={handleLogout}>
            Logout
          </Button>
        </Box>
        
        {/* Render appropriate portal */}
        {renderPortal()}
      </Box>
    </ThemeProvider>
  );
};

export default App;