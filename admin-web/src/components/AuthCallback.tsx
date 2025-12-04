import React, { useEffect } from 'react';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
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

      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);

      if (error) {
        debugError('OAuth callback error:', error);
        // Error will be handled by redirecting back to login
        // which will read the error from URL params
        return;
      }

      if (!token || !email) {
        debugError('OAuth callback missing token or email');
        // Redirect to login with error
        window.location.href = '/login?error=missing_token';
        return;
      }

      try {
        debugLog('🔐 Verifying OAuth session token...');
        
        // Store token temporarily
        localStorage.setItem('authToken', token);

        // Verify session and get user info
        const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';
        const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Session verification failed');
        }

        const { employee } = await response.json();
        
        if (!employee) {
          throw new Error('Employee data not found');
        }

        debugLog('✅ OAuth session verified, completing login...');

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

