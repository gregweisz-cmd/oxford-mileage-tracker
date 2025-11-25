import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';

// Import all portal components
import StaffPortal from './StaffPortal';
import SupervisorPortal from './components/SupervisorPortal';
import { AdminPortal } from './components/AdminPortal';
import FinancePortal from './components/FinancePortal';
import Login from './components/Login';
// import LoginForm from './components/LoginForm'; // Currently unused
import PortalSwitcher from './components/PortalSwitcher';
import OnboardingScreen from './components/OnboardingScreen';
import SetupWizard from './components/SetupWizard';
import { ToastProvider } from './contexts/ToastContext';
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
  const [currentPortal, setCurrentPortal] = useState<'admin' | 'supervisor' | 'staff' | 'finance'>('staff');
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuthStatus = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
          // Verify token with backend
          try {
            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3002'}/api/auth/verify`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              },
              credentials: 'include'
            });
            
            if (!response.ok) {
              // Invalid token, clear and force re-login
              localStorage.clear();
              setCurrentUser(null);
              setLoading(false);
              return;
            }
            
            // Valid token, get employee data
            const { employee } = await response.json();
            setCurrentUser(employee);
            
            // Check if user has completed onboarding (from backend employee data, not localStorage)
            // Handle both boolean and integer values, and treat null/undefined as false
            const hasCompletedOnboarding = employee?.hasCompletedOnboarding === true || 
                                           employee?.hasCompletedOnboarding === 1 || 
                                           employee?.hasCompletedOnboarding === '1';
            if (!hasCompletedOnboarding) {
              setShowOnboarding(true);
            } else {
              // Check if user has completed setup wizard (from backend employee data, not localStorage)
              // Handle both boolean and integer values, and treat null/undefined as false
              const hasCompletedSetupWizard = employee?.hasCompletedSetupWizard === true || 
                                               employee?.hasCompletedSetupWizard === 1 || 
                                               employee?.hasCompletedSetupWizard === '1';
              if (!hasCompletedSetupWizard) {
                setShowSetupWizard(true);
              }
            }
            
            // Set initial portal based on user position
            const position = employee?.position?.toLowerCase() || '';
            if (position.includes('admin') || position.includes('ceo')) {
              setCurrentPortal('admin');
            } else if (position.includes('finance') || position.includes('accounting')) {
              setCurrentPortal('finance');
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

  const handlePortalChange = (portal: 'admin' | 'supervisor' | 'staff' | 'finance') => {
    setCurrentPortal(portal);
  };

  const handleLoginSuccess = async (employee: any, token: string) => {
    setCurrentUser(employee);
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentEmployeeId', employee.id);
    localStorage.setItem('employeeData', JSON.stringify(employee));
    
    // Debug logging
    console.log('Login success - employee data:', {
      id: employee.id,
      name: employee.name,
      hasCompletedOnboarding: employee?.hasCompletedOnboarding,
      hasCompletedSetupWizard: employee?.hasCompletedSetupWizard,
      onboardingType: typeof employee?.hasCompletedOnboarding,
      wizardType: typeof employee?.hasCompletedSetupWizard
    });
    
    // Check if user has completed onboarding (from backend employee data, not localStorage)
    // Handle both boolean and integer values, and treat null/undefined as false
    const hasCompletedOnboarding = employee?.hasCompletedOnboarding === true || 
                                   employee?.hasCompletedOnboarding === 1 || 
                                   employee?.hasCompletedOnboarding === '1';
    console.log('hasCompletedOnboarding check:', hasCompletedOnboarding);
    
    if (!hasCompletedOnboarding) {
      console.log('Showing onboarding screen');
      setShowOnboarding(true);
    } else {
      // Check if user has completed setup wizard (from backend employee data, not localStorage)
      // Handle both boolean and integer values, and treat null/undefined as false
      const hasCompletedSetupWizard = employee?.hasCompletedSetupWizard === true || 
                                       employee?.hasCompletedSetupWizard === 1 || 
                                       employee?.hasCompletedSetupWizard === '1';
      console.log('hasCompletedSetupWizard check:', hasCompletedSetupWizard);
      
      if (!hasCompletedSetupWizard) {
        console.log('Showing setup wizard');
        setShowSetupWizard(true);
      } else {
        console.log('Both onboarding and setup wizard completed - showing portal');
      }
    }
    
    // Set initial portal based on user position
    const position = employee?.position?.toLowerCase() || '';
    if (position.includes('admin') || position.includes('ceo')) {
      setCurrentPortal('admin');
    } else if (position.includes('finance') || position.includes('accounting')) {
      setCurrentPortal('finance');
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

  // Onboarding Screen
  if (showOnboarding) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <OnboardingScreen onComplete={async () => {
          // Mark onboarding as complete in the backend
          try {
            await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3002'}/api/employees/${currentUser.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
              },
              body: JSON.stringify({
                ...currentUser,
                hasCompletedOnboarding: true
              })
            });
            // Update local state
            setCurrentUser({ ...currentUser, hasCompletedOnboarding: true });
          } catch (error) {
            console.error('Error updating onboarding status:', error);
          }
          
          setShowOnboarding(false);
          // After onboarding, check if setup wizard is needed
          // Handle both boolean and integer values, and treat null/undefined as false
          const hasCompletedSetupWizard = currentUser?.hasCompletedSetupWizard === true || 
                                           currentUser?.hasCompletedSetupWizard === 1 || 
                                           currentUser?.hasCompletedSetupWizard === '1';
          if (!hasCompletedSetupWizard) {
            setShowSetupWizard(true);
          }
        }} />
      </ThemeProvider>
    );
  }

  // Setup Wizard Screen
  if (showSetupWizard && currentUser) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SetupWizard 
          employee={currentUser} 
          onComplete={async () => {
            // Update local state to reflect setup wizard completion
            setCurrentUser({ ...currentUser, hasCompletedSetupWizard: true });
            setShowSetupWizard(false);
            // Reload employee data after setup
            // The employee data will be refreshed when the portal loads
          }} 
        />
      </ThemeProvider>
    );
  }

  // Determine which portal to show based on current portal selection
  const renderPortal = () => {
    switch (currentPortal) {
      case 'admin':
        return <AdminPortal adminId={currentUser.id} adminName={currentUser.name} />;
      case 'finance':
        return <FinancePortal financeUserId={currentUser.id} financeUserName={currentUser.name} />;
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
      <ToastProvider>
        <Box>
          <PortalSwitcher
            currentUser={currentUser}
            currentPortal={currentPortal}
            onPortalChange={handlePortalChange}
            onLogout={handleLogout}
          />
          {renderPortal()}
        </Box>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;