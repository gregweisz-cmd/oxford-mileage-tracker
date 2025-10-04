import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
} from '@mui/material';
import authService, { UserRole } from '../services/authService';

interface LoginFormProps {
  onLoginSuccess: (user: any) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await authService.login(email, password);
      
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getRoleDescription = (role: UserRole): string => {
    switch (role) {
      case 'admin':
        return 'Full system access - manage all employees, view all data, system administration';
      case 'supervisor':
        return 'Team management - view team data, approve reports, manage team members';
      case 'employee':
        return 'Personal access - view own data, submit reports';
      default:
        return '';
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card sx={{ width: '100%', maxWidth: 400 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography 
              variant="h4" 
              component="h1" 
              align="center" 
              gutterBottom
              sx={{ mb: 3, fontWeight: 'bold', color: 'primary.main' }}
            >
              Oxford House Expense System
            </Typography>
            
            <Typography 
              variant="h6" 
              align="center" 
              color="text.secondary" 
              sx={{ mb: 4 }}
            >
              Sign in to access the portal
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                required
                disabled={loading}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
                disabled={loading}
                sx={{ mb: 3 }}
              />
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading || !email || !password}
                sx={{ mb: 3, py: 1.5 }}
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </Box>

            {/* Role Information */}
            <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 1, fontSize: '0.875rem' }}>
              <Typography variant="subtitle2" gutterBottom color="primary">
                Access Levels:
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                  Admin: 
                </Typography>
                <Typography variant="caption">
                  {getRoleDescription('admin')}
                </Typography>
              </Box>
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                  Supervisor: 
                </Typography>
                <Typography variant="caption">
                  {getRoleDescription('supervisor')}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                  Employee: 
                </Typography>
                <Typography variant="caption">
                  {getRoleDescription('employee')}
                </Typography>
              </Box>
            </Box>

            {/* Demo Login Info */}
            <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="caption" align="center" display="block">
                <strong>Demo Login:</strong> Use Greg Weisz's email for Admin access
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default LoginForm;
