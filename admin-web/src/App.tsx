import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';

// Import all portal components
import StaffPortal from './StaffPortal';
import SupervisorPortal from './components/SupervisorPortal';
import { AdminPortal } from './components/AdminPortal';
import FinancePortal from './components/FinancePortal';
import ContractsPortal from './components/ContractsPortal';
import Login from './components/Login';
// import LoginForm from './components/LoginForm'; // Currently unused
import PortalSwitcher from './components/PortalSwitcher';
import OnboardingScreen from './components/OnboardingScreen';
import SetupWizard from './components/SetupWizard';
import { ToastProvider } from './contexts/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import AuthCallback from './components/AuthCallback';
// import AuthService from './services/authService'; // Currently unused

// Debug logging
import { debugLog, debugError, debugVerbose } from './config/debug';

// Helper function to get available portals for a user (used before user state is set)
const getAvailablePortalsForUser = (
  role: string,
  position: string,
  permissions: string[] = []
): Array<'admin' | 'supervisor' | 'staff' | 'finance' | 'contracts'> => {
  const normalizedRole = role.toLowerCase();
  const normalizedPosition = position.toLowerCase();
  const normalizedPermissions = permissions.map((perm) => perm.toLowerCase());

  if (normalizedPermissions.length > 0) {
    const allowed = new Set<'admin' | 'supervisor' | 'staff' | 'finance' | 'contracts'>();
    normalizedPermissions.forEach((permission) => {
      if (permission === 'admin') allowed.add('admin');
      if (permission === 'finance') allowed.add('finance');
      if (permission === 'contracts') allowed.add('contracts');
      if (permission === 'supervisor') allowed.add('supervisor');
      if (permission === 'staff') allowed.add('staff');
    });
    const portalOrder: Array<'admin' | 'finance' | 'contracts' | 'supervisor' | 'staff'> = [
      'admin',
      'finance',
      'contracts',
      'supervisor',
      'staff',
    ];
    return portalOrder.filter((portal) => allowed.has(portal));
  }

  const hasAdminRole = normalizedRole.includes('admin') || normalizedRole.includes('ceo');
  const hasFinanceRole = normalizedRole.includes('finance') || normalizedRole.includes('accounting');
  const hasContractsRole = normalizedRole.includes('contracts');
  const hasSupervisorRole = normalizedRole.includes('supervisor') || normalizedRole.includes('director') || normalizedRole.includes('manager');

  if (hasAdminRole) {
    return ['admin', 'finance', 'contracts', 'supervisor', 'staff'];
  } else if (hasFinanceRole) {
    return ['finance', 'staff'];
  } else if (hasContractsRole) {
    return ['contracts', 'staff'];
  } else if (hasSupervisorRole) {
    return ['supervisor', 'staff'];
  } else if (!normalizedRole || normalizedRole === 'employee') {
    // Fallback to position-based detection
    if (normalizedPosition.includes('admin') || normalizedPosition.includes('ceo')) {
      return ['admin', 'finance', 'contracts', 'supervisor', 'staff'];
    } else if (normalizedPosition.includes('finance') || normalizedPosition.includes('accounting')) {
      return ['finance', 'staff'];
    } else if (normalizedPosition.includes('contracts')) {
      return ['contracts', 'staff'];
    } else if (normalizedPosition.includes('supervisor') || normalizedPosition.includes('director') || normalizedPosition.includes('regional manager') || normalizedPosition.includes('manager')) {
      return ['supervisor', 'staff'];
    }
  }
  
  return ['staff'];
};

const normalizePermissionsValue = (value: unknown): Array<'admin' | 'finance' | 'contracts' | 'supervisor' | 'staff'> => {
  const normalizeToken = (token: string) => {
    const normalized = token.toLowerCase().trim();
    if (normalized.includes('admin')) return 'admin';
    if (normalized.includes('finance')) return 'finance';
    if (normalized.includes('contracts')) return 'contracts';
    if (normalized.includes('supervisor')) return 'supervisor';
    if (normalized.includes('staff')) return 'staff';
    return null;
  };

  const normalizeList = (list: string[]) =>
    list
      .map((item) => normalizeToken(item))
      .filter((item): item is 'admin' | 'finance' | 'contracts' | 'supervisor' | 'staff' => item !== null);

  if (Array.isArray(value)) {
    return normalizeList(value.map(String));
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return normalizeList(parsed.map(String));
      }
    } catch (error) {
      const fallback = value.split(',').map((item) => item.trim()).filter(Boolean);
      return normalizeList(fallback);
    }
  }

  return [];
};

// Create theme function
const createAppTheme = (mode: 'light' | 'dark') => {
  if (mode === 'dark') {
    return createTheme({
      palette: {
        mode: 'dark',
        primary: {
          main: '#1C75BC', // Brand blue
        },
        secondary: {
          main: '#2BB673', // Brand green
        },
        background: {
          default: '#1e1e1e', // Dark grey background
          paper: '#2d2d2d', // Slightly lighter grey for cards/paper
        },
        text: {
          primary: '#e0e0e0', // Light grey text
          secondary: '#b0b0b0', // Medium grey text
        },
        divider: '#404040', // Dark grey divider
      },
      typography: {
        fontFamily: '"Myriad Pro", "Segoe UI", Arial, sans-serif',
      },
      components: {
        MuiCard: {
          styleOverrides: {
            root: {
              backgroundColor: '#2d2d2d',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundColor: '#2d2d2d',
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundColor: '#2d2d2d',
            },
          },
        },
        MuiDrawer: {
          styleOverrides: {
            paper: {
              backgroundColor: '#2d2d2d',
            },
          },
        },
      },
    });
  } else {
    return createTheme({
      palette: {
        mode: 'light',
        primary: {
          main: '#1C75BC',
        },
        secondary: {
          main: '#2BB673',
        },
      },
      typography: {
        fontFamily: '"Myriad Pro", "Segoe UI", Arial, sans-serif',
      },
    });
  }
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentPortal, setCurrentPortal] = useState<'admin' | 'supervisor' | 'staff' | 'finance' | 'contracts'>('staff');
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check if user is already logged in
    const checkAuthStatus = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
          // Verify token with backend
          try {
            const { apiFetch } = await import('./services/rateLimitedApi');
            const response = await apiFetch('/api/auth/verify', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              }
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
            
            // Load theme preference from user profile (default to 'light' if not set)
            if (employee?.preferences) {
              try {
                const prefs = typeof employee.preferences === 'string' 
                  ? JSON.parse(employee.preferences) 
                  : employee.preferences;
                if (prefs?.theme === 'dark' || prefs?.theme === 'light') {
                  setThemeMode(prefs.theme);
                } else {
                  setThemeMode('light'); // Default to light if theme not set
                }
              } catch (e) {
                debugError('Error parsing preferences:', e);
                setThemeMode('light'); // Default to light on parse error
              }
            } else {
              setThemeMode('light'); // Default to light if no preferences
            }
            
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
            
            // Set initial portal based on user preference, then role, then position (fallback)
            const role = employee?.role?.toLowerCase() || '';
            const position = employee?.position?.toLowerCase() || '';
            const permissions = normalizePermissionsValue(employee?.permissions);
            
            // First, check if user has a saved default portal preference
            try {
              const { apiGet } = await import('./services/rateLimitedApi');
              const preferences = await apiGet(`/api/dashboard-preferences/${employee.id}`).catch(() => ({}));
              debugLog('🔍 Loaded user preferences (checkAuthStatus):', preferences);
              if (preferences.defaultPortal && ['admin', 'supervisor', 'staff', 'finance', 'contracts'].includes(preferences.defaultPortal)) {
                // Verify user has access to this portal
                const availablePortals = getAvailablePortalsForUser(role, position, permissions);
                debugLog('🔍 Available portals for user (checkAuthStatus):', availablePortals);
                debugLog('🔍 Preferred portal (checkAuthStatus):', preferences.defaultPortal);
                if (availablePortals.includes(preferences.defaultPortal)) {
                  debugLog('✅ Using saved default portal (checkAuthStatus):', preferences.defaultPortal);
                  setCurrentPortal(preferences.defaultPortal);
                  setLoading(false);
                  return;
                } else {
                  debugLog('⚠️ Saved portal not available (checkAuthStatus), falling back to role/position');
                }
              } else {
                debugLog('⚠️ No default portal preference found (checkAuthStatus)');
              }
            } catch (error) {
              debugError('Error fetching user preferences:', error);
            }
            
            // If no preference or preference invalid, use role/position-based detection
            const availablePortals = getAvailablePortalsForUser(role, position, permissions);
            if (availablePortals.includes('admin')) {
              setCurrentPortal('admin');
            } else if (availablePortals.includes('finance')) {
              setCurrentPortal('finance');
            } else if (availablePortals.includes('contracts')) {
              setCurrentPortal('contracts');
            } else if (availablePortals.includes('supervisor')) {
              setCurrentPortal('supervisor');
            } else {
              setCurrentPortal('staff');
            }
          } catch (error) {
            debugError('Error verifying token:', error);
            // Clear localStorage on error
            localStorage.clear();
            setCurrentUser(null);
          }
        }
      } catch (error) {
        debugError('Error checking auth status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);
  
  // Listen for user profile updates to refresh currentUser and theme
  useEffect(() => {
    const handleUserProfileUpdate = async (event: Event) => {
      const customEvent = event as CustomEvent<{ employeeId: string }>;
      const { employeeId } = customEvent.detail;
      if (currentUser?.id === employeeId) {
        // Reload employee data from backend
        try {
          const { apiFetch } = await import('./services/rateLimitedApi');
          const response = await apiFetch(`/api/employees/${employeeId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          if (response.ok) {
            const updatedEmployee = await response.json();
            setCurrentUser(updatedEmployee);
            
            // Update theme if preferences changed (default to 'light' if not set)
            if (updatedEmployee?.preferences) {
              try {
                const prefs = typeof updatedEmployee.preferences === 'string' 
                  ? JSON.parse(updatedEmployee.preferences) 
                  : updatedEmployee.preferences;
                if (prefs?.theme === 'dark' || prefs?.theme === 'light') {
                  setThemeMode(prefs.theme);
                } else {
                  setThemeMode('light'); // Default to light if theme not set
                }
              } catch (e) {
                debugError('Error parsing preferences:', e);
                setThemeMode('light'); // Default to light on parse error
              }
            } else {
              setThemeMode('light'); // Default to light if no preferences
            }
            
            debugLog('✅ Refreshed currentUser after profile update');
          }
        } catch (error) {
          debugError('Error refreshing currentUser:', error);
        }
      }
    };
    
    window.addEventListener('userProfileUpdated', handleUserProfileUpdate);
    
    return () => {
      window.removeEventListener('userProfileUpdated', handleUserProfileUpdate);
    };
  }, [currentUser?.id]);
  
  // Listen for theme changes
  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ theme: 'light' | 'dark' }>;
      if (customEvent.detail?.theme) {
        setThemeMode(customEvent.detail.theme);
      }
    };
    
    window.addEventListener('themeChanged', handleThemeChange);
    
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange);
    };
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
      debugError('Logout error:', error);
    } finally {
      // Clear state and localStorage regardless of API call success
      setCurrentUser(null);
      setCurrentPortal('staff');
      setThemeMode('light'); // Reset theme to light on logout
      localStorage.clear();
      
      // Clear any URL parameters to prevent error messages from showing
      window.history.replaceState({}, document.title, '/login');
    }
  };

  const handlePortalChange = (portal: 'admin' | 'supervisor' | 'staff' | 'finance' | 'contracts') => {
    setCurrentPortal(portal);
  };

  const handleLoginSuccess = async (employee: any, token: string) => {
    setCurrentUser(employee);
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentEmployeeId', employee.id);
    localStorage.setItem('employeeData', JSON.stringify(employee));
    
    // Load theme preference from user profile (default to 'light' if not set)
    if (employee?.preferences) {
      try {
        const prefs = typeof employee.preferences === 'string' 
          ? JSON.parse(employee.preferences) 
          : employee.preferences;
        if (prefs?.theme === 'dark' || prefs?.theme === 'light') {
          setThemeMode(prefs.theme);
        } else {
          setThemeMode('light'); // Default to light if theme not set
        }
      } catch (e) {
        debugError('Error parsing preferences:', e);
        setThemeMode('light'); // Default to light on parse error
      }
    } else {
      setThemeMode('light'); // Default to light if no preferences
    }
    
    // Check if user has completed onboarding (from backend employee data, not localStorage)
    // Handle both boolean and integer values, and treat null/undefined as false
    const hasCompletedOnboarding = employee?.hasCompletedOnboarding === true || 
                                   employee?.hasCompletedOnboarding === 1 || 
                                   employee?.hasCompletedOnboarding === '1';
    
    if (!hasCompletedOnboarding) {
      debugVerbose('Showing onboarding screen');
      setShowOnboarding(true);
    } else {
      // Check if user has completed setup wizard (from backend employee data, not localStorage)
      // Handle both boolean and integer values, and treat null/undefined as false
      const hasCompletedSetupWizard = employee?.hasCompletedSetupWizard === true || 
                                       employee?.hasCompletedSetupWizard === 1 || 
                                       employee?.hasCompletedSetupWizard === '1';
      
      if (!hasCompletedSetupWizard) {
        debugVerbose('Showing setup wizard');
        setShowSetupWizard(true);
      }
    }
    
    // Set initial portal based on user preference, then role, then position (fallback)
    // IMPORTANT: Role field takes priority over position field
    const role = employee?.role?.toLowerCase() || '';
    const position = employee?.position?.toLowerCase() || '';
    const permissions = normalizePermissionsValue(employee?.permissions);
    
    // First, check if user has a saved default portal preference
    try {
      const { apiGet } = await import('./services/rateLimitedApi');
      const preferences = await apiGet(`/api/dashboard-preferences/${employee.id}`).catch(() => ({}));
      debugLog('🔍 Loaded user preferences:', preferences);
      if (preferences.defaultPortal && ['admin', 'supervisor', 'staff', 'finance', 'contracts'].includes(preferences.defaultPortal)) {
        // Verify user has access to this portal
        const availablePortals = getAvailablePortalsForUser(role, position, permissions);
        debugLog('🔍 Available portals for user:', availablePortals);
        debugLog('🔍 Preferred portal:', preferences.defaultPortal);
        if (availablePortals.includes(preferences.defaultPortal)) {
          debugLog('✅ Using saved default portal:', preferences.defaultPortal);
          setCurrentPortal(preferences.defaultPortal);
          return;
        } else {
          debugLog('⚠️ Saved portal not available, falling back to role/position');
        }
      } else {
        debugLog('⚠️ No default portal preference found');
      }
    } catch (error) {
      debugError('Error fetching user preferences:', error);
    }
    
    // If no preference or preference invalid, use role/position-based detection
    // Check role first (explicit role assignment takes priority)
    if (role === 'admin') {
      setCurrentPortal('admin');
    } else if (role === 'finance') {
      setCurrentPortal('finance');
    } else if (role === 'contracts') {
      setCurrentPortal('contracts');
    } else if (role === 'supervisor') {
      setCurrentPortal('supervisor');
    } else if (role === 'employee' || !role) {
      // If role is 'employee' or not set, fall back to position-based detection
      if (position.includes('admin') || position.includes('ceo')) {
        setCurrentPortal('admin');
      } else if (position.includes('finance') || position.includes('accounting')) {
        setCurrentPortal('finance');
      } else if (position.includes('supervisor') || position.includes('director') || position.includes('regional manager') || position.includes('manager')) {
        setCurrentPortal('supervisor');
      } else {
        setCurrentPortal('staff');
      }
    } else {
      // Unknown role, default to staff
      setCurrentPortal('staff');
    }
  };

  // Create theme based on current mode
  const theme = createAppTheme(themeMode);

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

  // Check if we're on the OAuth callback route
  const isOAuthCallback = window.location.pathname === '/auth/callback' || 
                          window.location.search.includes('token=');

  // OAuth Callback Screen
  if (isOAuthCallback && !currentUser) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthCallback onLoginSuccess={handleLoginSuccess} />
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
            debugError('Error updating onboarding status:', error);
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
        return (
          <ErrorBoundary>
            <AdminPortal adminId={currentUser.id} adminName={currentUser.name} />
          </ErrorBoundary>
        );
      case 'finance':
        return (
          <ErrorBoundary>
            <FinancePortal financeUserId={currentUser.id} financeUserName={currentUser.name} />
          </ErrorBoundary>
        );
      case 'contracts':
        return (
          <ErrorBoundary>
            <ContractsPortal contractsUserId={currentUser.id} contractsUserName={currentUser.name} />
          </ErrorBoundary>
        );
      case 'supervisor':
        return (
          <ErrorBoundary>
            <SupervisorPortal supervisorId={currentUser.id} supervisorName={currentUser.name} />
          </ErrorBoundary>
        );
      case 'staff':
      default:
        return (
          <ErrorBoundary>
            <StaffPortal
              employeeId={currentUser.id}
              reportMonth={new Date().getMonth() + 1}
              reportYear={new Date().getFullYear()}
            />
          </ErrorBoundary>
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