import React, { useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { debugLog, debugError } from '../config/debug';

interface AuthCallbackProps {
  onLoginSuccess: (employee: any, token: string) => void;
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ onLoginSuccess }) => {
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const email = urlParams.get('email');
      const error = urlParams.get('error');
      const returnUrl = urlParams.get('returnUrl') || '/';

      debugLog('🔍 OAuth callback - URL params:', { token: token ? 'present' : 'missing', email, error, returnUrl });

      if (error) {
        debugError('OAuth callback error:', error);
        window.history.replaceState({}, document.title, '/login');
        window.location.href = `/login?error=${encodeURIComponent(error)}`;
        return;
      }

      if (!token || !email) {
        debugError('OAuth callback missing token or email', { token: !!token, email: !!email });
        debugError('Full URL:', window.location.href);
        debugError('URL search params:', window.location.search);
        window.history.replaceState({}, document.title, '/login');
        window.location.href = '/login?error=missing_token';
        return;
      }

      // Clear URL parameters AFTER we've read them
      window.history.replaceState({}, document.title, window.location.pathname);

      try {
        debugLog('🔐 Processing OAuth callback...');
        
        // Store token
        localStorage.setItem('authToken', token);

        // Get employee data from token (token format: session_${employeeId}_${timestamp})
        // Extract employee ID from token
        const tokenParts = token.split('_');
        if (tokenParts.length < 2) {
          throw new Error('Invalid token format');
        }
        const employeeId = tokenParts[1];

        debugLog('🔍 Fetching employee data for:', employeeId);

        // Fetch employee data from backend
        const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';
        const response = await fetch(`${API_BASE_URL}/api/employees/${employeeId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch employee data: ${response.status}`);
        }

        const employee = await response.json();
        
        if (!employee || !employee.id) {
          throw new Error('Employee data not found');
        }

        debugLog('✅ Employee data fetched, completing login...');

        // Store employee data
        localStorage.setItem('currentEmployeeId', employee.id);
        localStorage.setItem('employeeData', JSON.stringify(employee));

        // Call success callback
        onLoginSuccess(employee, token);
      } catch (err: any) {
        debugError('Error verifying OAuth session:', err);
        localStorage.removeItem('authToken');
        // Redirect to login with error
        window.location.href = `/login?error=${encodeURIComponent(err.message || 'Session verification failed')}`;
      }
    };

    handleOAuthCallback();
  }, [onLoginSuccess]);

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        p: 3
      }}
    >
      <CircularProgress size={60} sx={{ mb: 2 }} />
      <Typography variant="h6" sx={{ mb: 1 }}>
        Completing sign in...
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Please wait while we verify your Google account
      </Typography>
    </Box>
  );
};

export default AuthCallback;

