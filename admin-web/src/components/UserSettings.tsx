import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  IconButton,
  FormControlLabel,
} from '@mui/material';
import {
  Save as SaveIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PhotoCamera as PhotoCameraIcon,
  Security as SecurityIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { debugLog, debugError } from '../config/debug';

interface UserSettingsProps {
  employeeId: string;
  onSettingsUpdate?: (settings: any) => void;
}

interface UserProfile {
  id: string;
  name: string;
  preferredName: string;
  email: string;
  position: string;
  phoneNumber: string;
  password: string;
  oxfordHouseId?: string;
  costCenters: string[];
  baseAddresses: {
    address1: string;
    address2: string;
  };
  preferences: {
    autoSaveInterval: number;
    notificationsEnabled: boolean;
    defaultCurrency: string;
    theme: 'light' | 'dark';
    emailNotifications: boolean;
    smsNotifications: boolean;
  };
  signature?: string;
  profilePicture?: string;
}

const UserSettings: React.FC<UserSettingsProps> = ({ employeeId, onSettingsUpdate }) => {
  const [profile, setProfile] = useState<UserProfile>({
    id: employeeId,
    name: '',
    preferredName: '',
    email: '',
    position: '',
    phoneNumber: '',
    password: '',
    costCenters: ['NC.F-SAPTBG'],
    baseAddresses: {
      address1: '',
      address2: '',
    },
    preferences: {
      autoSaveInterval: 30,
      notificationsEnabled: true,
      defaultCurrency: 'USD',
      theme: 'light',
      emailNotifications: true,
      smsNotifications: false,
    },
    signature: '',
    profilePicture: '',
  });

  // Dialog states
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  
  // Form states
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  // Status
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | '', text: string }>({ type: '', text: '' });

  const loadUserProfile = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load employee data from API
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';
      const response = await fetch(`${API_BASE_URL}/api/employees/${employeeId}`);
      if (response.ok) {
        const employeeData = await response.json();
        
        // Parse cost centers if they're stored as JSON string
        let costCenters = ['NC.F-SAPTBG']; // Default fallback
        if (employeeData.costCenters) {
          try {
            costCenters = typeof employeeData.costCenters === 'string' 
              ? JSON.parse(employeeData.costCenters) 
              : employeeData.costCenters;
          } catch (parseErr) {
            debugLog('Failed to parse costCenters:', employeeData.costCenters);
            costCenters = ['NC.F-SAPTBG'];
          }
        }
        
        // Parse selected cost centers if they exist
        let selectedCostCenters = costCenters;
        if (employeeData.selectedCostCenters) {
          try {
            selectedCostCenters = typeof employeeData.selectedCostCenters === 'string' 
              ? JSON.parse(employeeData.selectedCostCenters) 
              : employeeData.selectedCostCenters;
          } catch (parseErr) {
            debugLog('Failed to parse selectedCostCenters:', employeeData.selectedCostCenters);
            selectedCostCenters = costCenters;
          }
        }
        
        // Parse preferences if they exist
        let preferences = {
          autoSaveInterval: 30,
          notificationsEnabled: true,
          defaultCurrency: 'USD',
          theme: 'light' as 'light' | 'dark',
          emailNotifications: true,
          smsNotifications: false,
        };
        if (employeeData.preferences) {
          try {
            const parsedPrefs = typeof employeeData.preferences === 'string' 
              ? JSON.parse(employeeData.preferences) 
              : employeeData.preferences;
            preferences = {
              ...preferences,
              ...parsedPrefs,
            };
          } catch (parseErr) {
            debugLog('Failed to parse preferences:', employeeData.preferences);
          }
        }
        
        setProfile(prev => ({
          ...prev,
          id: employeeData.id,
          name: employeeData.name || 'Current User',
          preferredName: employeeData.preferredName || '',
          email: employeeData.email || 'user@oxfordhouse.org',
          position: employeeData.position || 'Field Staff',
          phoneNumber: employeeData.phoneNumber || '555-0123',
          costCenters: selectedCostCenters,
          baseAddresses: {
            address1: employeeData.baseAddress || '',
            address2: employeeData.baseAddress2 || '',
          },
          signature: employeeData.signature || '',
          oxfordHouseId: employeeData.oxfordHouseId || '',
          preferences: preferences,
        }));
      } else {
        throw new Error('Failed to load employee data');
      }
    } catch (error) {
      debugError('Error loading user profile:', error);
      showMessage('error', 'Failed to load user profile.');
      
      // Fallback to default values
      setProfile(prev => ({
        ...prev,
        name: 'Current User',
        email: 'user@oxfordhouse.org',
        position: 'Field Staff',
        phoneNumber: '555-0123',
      }));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '' as any, text: '' }), 5000);
  };

  /**
   * Validates that a phone number contains exactly 10 digits (or is empty)
   * @param phoneNumber - The phone number string (can contain digits, spaces, dashes, parentheses, etc.)
   * @returns true if the phone number is empty or has exactly 10 digits, false otherwise
   */
  const validatePhoneNumber = (phoneNumber: string): boolean => {
    // Allow empty phone numbers (optional field)
    if (!phoneNumber || !phoneNumber.trim()) {
      return true;
    }
    
    // Remove all non-digit characters and count digits
    const digits = phoneNumber.replace(/\D/g, '');
    return digits.length === 10;
  };

  /**
   * Formats a phone number to (###) ###-#### format
   * @param phoneNumber - The phone number string (can contain digits, spaces, dashes, parentheses, etc.)
   * @returns Formatted phone number in (###) ###-#### format, or empty string if invalid
   */
  const formatPhoneNumber = (phoneNumber: string): string => {
    if (!phoneNumber || !phoneNumber.trim()) {
      return '';
    }
    
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // If we don't have exactly 10 digits, return empty string (validation will catch this)
    if (digits.length !== 10) {
      return '';
    }
    
    // Format as (###) ###-####
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      // Validate phone number has exactly 10 digits (if provided)
      if (profile.phoneNumber && profile.phoneNumber.trim() && !validatePhoneNumber(profile.phoneNumber)) {
        showMessage('error', 'Phone number must contain exactly 10 digits. Please enter a valid phone number (e.g., 1234567890, (123) 456-7890, or 123-456-7890), or leave it empty.');
        setLoading(false);
        return;
      }
      
      // Format phone number before saving
      const formattedPhoneNumber = formatPhoneNumber(profile.phoneNumber);
      
      // Update local state to show formatted phone number immediately
      setProfile(prev => ({ ...prev, phoneNumber: formattedPhoneNumber }));
      
      // Prepare data for API update
      const updateData = {
        name: profile.name,
        preferredName: profile.preferredName || '', // Ensure empty string is sent, not undefined
        email: profile.email,
        oxfordHouseId: profile.oxfordHouseId || '',
        position: profile.position,
        phoneNumber: formattedPhoneNumber,
        baseAddress: profile.baseAddresses.address1,
        baseAddress2: profile.baseAddresses.address2,
        costCenters: JSON.stringify(profile.costCenters),
        selectedCostCenters: JSON.stringify(profile.costCenters),
        defaultCostCenter: profile.costCenters[0] || '',
        signature: profile.signature,
        preferences: JSON.stringify(profile.preferences), // Save preferences including theme
      };
      
      // Update via API
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com';
      const response = await fetch(`${API_BASE_URL}/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (response.ok) {
        await response.json();
        showMessage('success', 'Profile updated successfully!');
        if (onSettingsUpdate) {
          onSettingsUpdate(profile);
        }
        // Reload the profile to confirm changes were saved
        await loadUserProfile();
        // Dispatch event to refresh currentUser in App.tsx
        window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: { employeeId } }));
      } else {
        const errorData = await response.json();
        debugError('Server error response:', errorData);
        throw new Error(errorData.error || 'Failed to update profile');
      }
    } catch (error) {
      debugError('Error saving profile:', error);
      showMessage('error', 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };


  const handlePasswordChange = () => {
    if (passwordData.new !== passwordData.confirm) {
      showMessage('error', 'New passwords do not match.');
      return;
    }
    if (passwordData.new.length < 8) {
      showMessage('error', 'Password must be at least 8 characters long.');
      return;
    }
    
    setProfile(prev => ({ ...prev, password: passwordData.new }));
    setPasswordDialogOpen(false);
    setPasswordData({ current: '', new: '', confirm: '' });
    showMessage('success', 'Password updated successfully!');
  };

  const handleProfilePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setProfile(prev => ({ ...prev, profilePicture: result }));
        showMessage('success', 'Profile picture updated successfully!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setProfile(prev => ({ ...prev, signature: result }));
        showMessage('success', 'Signature updated successfully!');
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Box sx={{ flex: 1, p: 3, maxWidth: 1200, mx: 'auto', width: '100%', pb: 10 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <SettingsIcon sx={{ mr: 2 }} />
          User Settings
        </Typography>

        {message.text && (
          <Alert severity={message.type as any} sx={{ mb: 3 }} onClose={() => setMessage({ type: '' as any, text: '' })}>
            {message.text}
          </Alert>
        )}

        {/* Profile Information */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <PersonIcon sx={{ mr: 1 }} />
              Profile Information
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Avatar
                src={profile.profilePicture}
                sx={{ width: 80, height: 80, mr: 2 }}
              />
              <Box>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="profile-picture-input"
                  type="file"
                  onChange={handleProfilePictureChange}
                />
                <label htmlFor="profile-picture-input">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<PhotoCameraIcon />}
                  >
                    Change Photo
                  </Button>
                </label>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Recommended: Square image, max 2MB
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Full Name (Legal Name)"
                value={profile.name}
                onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                sx={{ minWidth: 250 }}
                helperText="Used for official reports and documents"
              />
              <TextField
                label="Preferred Name"
                value={profile.preferredName}
                onChange={(e) => setProfile(prev => ({ ...prev, preferredName: e.target.value }))}
                sx={{ minWidth: 250 }}
                helperText="Display name for app and web portal only. Your legal name will always be used on expense reports and official documents."
                placeholder="Leave empty to use legal name"
              />
              <TextField
                label="Email Address"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                sx={{ minWidth: 250 }}
              />
              <TextField
                label="Position"
                value={profile.position}
                onChange={(e) => setProfile(prev => ({ ...prev, position: e.target.value }))}
                sx={{ minWidth: 200 }}
              />
              <TextField
                label="Phone Number"
                value={profile.phoneNumber}
                onChange={(e) => setProfile(prev => ({ ...prev, phoneNumber: e.target.value }))}
                sx={{ minWidth: 200 }}
                helperText="Enter 10 digits (e.g., 1234567890, (123) 456-7890, or 123-456-7890). Will be formatted as (###) ###-#### on save."
                placeholder="(123) 456-7890"
              />
            </Box>
          </CardContent>
        </Card>

        {/* Cost Centers */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <BusinessIcon sx={{ mr: 1 }} />
              Cost Centers
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Your assigned cost centers for expense reporting (managed by administrators)
            </Typography>

            <Box sx={{ mb: 2 }}>
              {profile.costCenters.length > 0 ? (
                profile.costCenters.map((costCenter, index) => (
                  <Chip
                    key={index}
                    label={costCenter}
                    sx={{ mr: 1, mb: 1 }}
                    color="primary"
                    variant="outlined"
                  />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No cost centers assigned. Please contact your administrator.
                </Typography>
              )}
            </Box>

            <Typography variant="caption" color="text.secondary">
              Changes to cost centers can only be made by administrators
            </Typography>
          </CardContent>
        </Card>

        {/* Base Addresses */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <HomeIcon sx={{ mr: 1 }} />
              Base Addresses
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Set your default addresses for easier expense tracking and GPS functionality
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>Base Address 1</Typography>
                <TextField
                  value={profile.baseAddresses.address1}
                  onChange={(e) => setProfile(prev => ({
                    ...prev,
                    baseAddresses: { ...prev.baseAddresses, address1: e.target.value }
                  }))}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Enter your primary base address"
                />
              </Box>
              <Box>
                <Typography variant="subtitle2" gutterBottom>Base Address 2</Typography>
                <TextField
                  value={profile.baseAddresses.address2}
                  onChange={(e) => setProfile(prev => ({
                    ...prev,
                    baseAddresses: { ...prev.baseAddresses, address2: e.target.value }
                  }))}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Enter your secondary base address (optional)"
                />
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Digital Signature */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Digital Signature
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Store your digital signature for expense reports
            </Typography>

            <Box sx={{ mb: 2 }}>
              {profile.signature ? (
                <Box sx={{ 
                  border: 1, 
                  borderColor: 'grey.300', 
                  borderRadius: 1, 
                  p: 2, 
                  minHeight: 80,
                  bgcolor: '#fafafa',
                  position: 'relative'
                }}>
                  <img 
                    src={profile.signature} 
                    alt="Signature" 
                    style={{ maxWidth: '100%', maxHeight: 120 }}
                  />
                  <Box sx={{ display: 'flex', gap: 0.5, position: 'absolute', top: 4, right: 4 }}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        const input = document.getElementById('signature-input');
                        input?.click();
                      }}
                      sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setProfile(prev => ({ ...prev, signature: '' }));
                        showMessage('info', 'Signature removed. Click "Save Settings" to confirm.');
                      }}
                      sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'error.light', color: 'error.main' } }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ 
                  border: 2, 
                  borderColor: 'grey.300', 
                  borderStyle: 'dashed',
                  borderRadius: 1, 
                  p: 3, 
                  textAlign: 'center',
                  minHeight: 80,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No signature uploaded
                  </Typography>
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="signature-input"
                    type="file"
                    onChange={handleSignatureChange}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => {
                      const input = document.getElementById('signature-input');
                      input?.click();
                    }}
                  >
                    Upload Signature
                  </Button>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <SecurityIcon sx={{ mr: 1 }} />
              Security Settings
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Manage your account security settings
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setPasswordDialogOpen(true);
                  setPasswordData({ current: '', new: '', confirm: '' });
                }}
                sx={{ width: 'fit-content' }}
              >
                Change Password
              </Button>

              <Divider sx={{ my: 1 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={profile.preferences.notificationsEnabled}
                    onChange={(e) => setProfile(prev => ({
                      ...prev,
                      preferences: { ...prev.preferences, notificationsEnabled: e.target.checked }
                    }))}
                  />
                }
                label="Enable Notifications"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={profile.preferences.emailNotifications}
                    onChange={(e) => setProfile(prev => ({
                      ...prev,
                      preferences: { ...prev.preferences, emailNotifications: e.target.checked }
                    }))}
                  />
                }
                label="Email Notifications"
              />
            </Box>
          </CardContent>
        </Card>

        {/* Application Preferences */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Application Preferences
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Auto-Save Interval</InputLabel>
                <Select
                  value={profile.preferences.autoSaveInterval || 30}
                  onChange={(e) => setProfile(prev => ({
                    ...prev,
                    preferences: { ...prev.preferences, autoSaveInterval: e.target.value as number }
                  }))}
                >
                  <MenuItem value={15}>15 seconds</MenuItem>
                  <MenuItem value={30}>30 seconds</MenuItem>
                  <MenuItem value={60}>1 minute</MenuItem>
                  <MenuItem value={300}>5 minutes</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Default Currency</InputLabel>
                <Select
                  value={profile.preferences.defaultCurrency || 'USD'}
                  onChange={(e) => setProfile(prev => ({
                    ...prev,
                    preferences: { ...prev.preferences, defaultCurrency: e.target.value }
                  }))}
                >
                  <MenuItem value="USD">USD - US Dollar</MenuItem>
                  <MenuItem value="EUR">EUR - Euro</MenuItem>
                  <MenuItem value="CAD">CAD - Canadian Dollar</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Theme</InputLabel>
                <Select
                  value={profile.preferences.theme || 'light'}
                  onChange={(e) => {
                    const newTheme = e.target.value as 'light' | 'dark';
                    setProfile(prev => ({
                      ...prev,
                      preferences: { ...prev.preferences, theme: newTheme }
                    }));
                    // Dispatch event to update theme immediately
                    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
                  }}
                >
                  <MenuItem value="light">Light</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </CardContent>
        </Card>
        </Box>
      </Box>

      {/* Sticky Save Button */}
      <Box sx={{ 
        position: 'sticky', 
        bottom: 0, 
        bgcolor: 'background.paper', 
        borderTop: 1, 
        borderColor: 'divider',
        p: 2,
        boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
        zIndex: 1000
      }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<SaveIcon />}
            onClick={handleSaveProfile}
            disabled={loading}
            sx={{ minWidth: 150 }}
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </Box>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)}>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Current Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            variant="outlined"
            value={passwordData.current}
            onChange={(e) => setPasswordData(prev => ({ ...prev, current: e.target.value }))}
            InputProps={{
              endAdornment: (
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              ),
            }}
          />
          <TextField
            margin="dense"
            label="New Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            variant="outlined"
            value={passwordData.new}
            onChange={(e) => setPasswordData(prev => ({ ...prev, new: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Confirm New Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            variant="outlined"
            value={passwordData.confirm}
            onChange={(e) => setPasswordData(prev => ({ ...prev, confirm: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handlePasswordChange} 
            variant="contained"
            disabled={!passwordData.current || !passwordData.new || passwordData.new !== passwordData.confirm}
          >
            Change Password
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserSettings;