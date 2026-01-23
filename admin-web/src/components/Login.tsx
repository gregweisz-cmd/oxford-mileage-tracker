import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  // Avatar, // Currently unused
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import OxfordHouseLogo from './OxfordHouseLogo';
import { useEffect } from 'react';

interface LoginProps {
  onLoginSuccess: (employee: any, token: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [phoneNumberLast4, setPhoneNumberLast4] = useState('');

  // Check for error in URL (from OAuth redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      // Don't show "missing_token" error - it's not user-facing
      if (errorParam !== 'missing_token') {
        setError(decodeURIComponent(errorParam));
      }
      // Clear the error from URL
      window.history.replaceState({}, document.title, '/login');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com'}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          password,
          ...(twoFactorCode && { twoFactorCode })
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if 2FA is required
        if (data.requiresTwoFactor && !twoFactorCode) {
          setRequiresTwoFactor(true);
          setPhoneNumberLast4(data.phoneNumberLast4 || '');
          setError('');
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Login failed');
      }

      // Check if 2FA code is required
      if (data.requiresTwoFactor && !twoFactorCode) {
        setRequiresTwoFactor(true);
        setPhoneNumberLast4(data.phoneNumberLast4 || '');
        setLoading(false);
        return;
      }

      // Store token and employee data
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('currentEmployeeId', data.employee.id);
      localStorage.setItem('employeeData', JSON.stringify(data.employee));

      // Call success callback
      onLoginSuccess(data.employee, data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Box sx={{ m: 1 }}>
          <OxfordHouseLogo size={56} />
        </Box>
        
        <Typography component="h1" variant="h4" sx={{ mb: 1 }}>
          Oxford House
        </Typography>
        
        <Typography component="h2" variant="h6" color="text.secondary" sx={{ mb: 3 }}>
          Expense Tracker
        </Typography>

        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Box component="form" onSubmit={handleSubmit} noValidate>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || requiresTwoFactor}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {requiresTwoFactor && (
              <>
                <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                  A verification code has been sent to your phone ending in {phoneNumberLast4 || '****'}.
                  Please enter the code below.
                </Alert>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="twoFactorCode"
                  label="Verification Code"
                  type="text"
                  id="twoFactorCode"
                  autoComplete="off"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={loading}
                  placeholder="Enter 6-digit code"
                  inputProps={{
                    maxLength: 6,
                    pattern: '[0-9]*',
                    inputMode: 'numeric'
                  }}
                />
              </>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              disabled={loading || !email || !password || (requiresTwoFactor && !twoFactorCode)}
            >
              {loading ? 'Signing In...' : requiresTwoFactor ? 'Verify & Sign In' : 'Sign In'}
            </Button>
          </Box>
        </Paper>

        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 3 }}>
          © {new Date().getFullYear()} Oxford House. All rights reserved.
        </Typography>
      </Box>
    </Container>
  );
}

