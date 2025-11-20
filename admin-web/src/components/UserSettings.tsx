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
  Add as AddIcon,
  PhotoCamera as PhotoCameraIcon,
  Security as SecurityIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { TwoFactorService, TwoFactorStatus } from '../services/twoFactorService';

// Cost center options from mobile app
const COST_CENTERS = [
  'AL-SOR',
  'AL-SUBG',
  'AZ / CO',
  'AZ-BMC-SUBG',
  'AZ-CHCCP-SUBG (N)',
  'AZ-CHCCP-SUBG (S)',
  'AZ-MEDICAID-SUBG (N)',
  'CA / CO / NV',
  'CA-COCC-OSG',
  'CA-COCC-SUBG',
  'CA-SLOC-SUBG',
  'CO-EMSHIP-OSG',
  'CO-EMSHIP-SOR',
  'CO-EMSHIP-STATE',
  'CO-EMSHIP-SUBG',
  'CO-STATE',
  'CORPORATE',
  'CT / DE / ME',
  'DC / MD / VA',
  'DC-SOR',
  'DE / MD / VA',
  'DE-SOR',
  'DE-STATE',
  'FL-MEDICAID-OSG (N)',
  'FL-OSG',
  'FL-SOR',
  'FL-STATE',
  'Finance',
  'IL / MN / WI',
  'IL-BCBS',
  'IL-SUBG',
  'IN / KY / OH',
  'IN-BCBS',
  'IN-STATE',
  'IN-SUBG',
  'IN-TO-OSG',
  'KY / IN / OH',
  'KY-OSG',
  'KY-SOR',
  'KY-SUBG',
  'KY-STATE',
  'LA-BCBS',
  'LA-SOR',
  'LA-SUBG',
  'MD-GRACE',
  'NC / TN',
  'NC-AHA',
  'NC-MEDICAID-DSG',
  'NC-SOR',
  'NC-SUBG',
  'NC-STATE',
  'NC-T-SOR',
  'NC-T-SUBG',
  'NC-TRELLIS',
  'NC.F-SAPTBG',
  'NE-SOR',
  'NE-SOR (SUBG K)',
  'NE-SUBG',
  'NE-OSG',
  'NM-STATE',
  'NU-OSG',
  'NU-SOR',
  'NU-SOR (SUBG K)',
  'NV-MEDICAID',
  'NY',
  'NY-OCFS-OSG',
  'NY-OSG',
  'OK / MO / NE',
  'OK-GCI (RL-ENTRY)',
  'OK-KING',
  'OK-MO-STATE',
  'OK-SUBG',
  'OR-OSG',
  'OR-STATE',
  'OH-CHCCP',
  'OH-OSG',
  'OH-OSG (FC)',
  'OH-SOR/OSG',
  'OH-STATE',
  'Program Services',
  'PS-UM-UMDD',
  'SC-PHCA',
  'SC-STATE',
  'TN-STATE',
  'TN-SUBG',
  'TX / NM',
  'TX-SUBG',
  'UN-END',
  'WA-KING',
  'WA-OSG',
  'WA-SOR',
  'WA-SUBG',
];

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
  const [passwordDialogPurpose, setPasswordDialogPurpose] = useState<'password' | 'disable2fa'>('password');
  
  // Form states
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  // 2FA states
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus>({
    twoFactorEnabled: false,
    phoneNumberVerified: false,
    phoneNumber: null
  });
  const [twoFactorPhoneNumber, setTwoFactorPhoneNumber] = useState('');
  const [twoFactorVerificationCode, setTwoFactorVerificationCode] = useState('');
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  
  // Status
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | '', text: string }>({ type: '', text: '' });

  const loadUserProfile = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load employee data from API
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';
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
            console.log('Failed to parse costCenters:', employeeData.costCenters);
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
            console.log('Failed to parse selectedCostCenters:', employeeData.selectedCostCenters);
            selectedCostCenters = costCenters;
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
        }));
      } else {
        throw new Error('Failed to load employee data');
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
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
    loadTwoFactorStatus();
  }, [loadUserProfile]);

  const loadTwoFactorStatus = async () => {
    try {
      const status = await TwoFactorService.getStatus(employeeId);
      setTwoFactorStatus(status);
    } catch (error) {
      console.error('Error loading 2FA status:', error);
      // 2FA might not be configured, set default status
      setTwoFactorStatus({
        twoFactorEnabled: false,
        phoneNumberVerified: false,
        phoneNumber: null
      });
    }
  };

  const handleSendTwoFactorCode = async () => {
    if (!twoFactorPhoneNumber.trim()) {
      showMessage('error', 'Please enter your phone number');
      return;
    }

    setTwoFactorLoading(true);
    try {
      await TwoFactorService.sendCode(employeeId, twoFactorPhoneNumber);
      showMessage('success', 'Verification code sent to your phone');
      setShowTwoFactorSetup(true);
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to send verification code');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerifyTwoFactorCode = async () => {
    if (!twoFactorVerificationCode.trim() || twoFactorVerificationCode.length !== 6) {
      showMessage('error', 'Please enter a valid 6-digit verification code');
      return;
    }

    setTwoFactorLoading(true);
    try {
      await TwoFactorService.verifyPhone(employeeId, twoFactorPhoneNumber, twoFactorVerificationCode);
      showMessage('success', 'Two-factor authentication enabled successfully');
      setShowTwoFactorSetup(false);
      setTwoFactorPhoneNumber('');
      setTwoFactorVerificationCode('');
      await loadTwoFactorStatus();
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to verify code');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisableTwoFactor = async () => {
    if (!passwordData.current) {
      showMessage('error', 'Please enter your password to disable 2FA');
      return;
    }

    setTwoFactorLoading(true);
    try {
      await TwoFactorService.disable(employeeId, passwordData.current);
      showMessage('success', 'Two-factor authentication disabled successfully');
      setPasswordData({ current: '', new: '', confirm: '' });
      setPasswordDialogOpen(false);
      await loadTwoFactorStatus();
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to disable 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '' as any, text: '' }), 5000);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      // Prepare data for API update
      const updateData = {
        name: profile.name,
        preferredName: profile.preferredName,
        email: profile.email,
        oxfordHouseId: profile.oxfordHouseId || '',
        position: profile.position,
        phoneNumber: profile.phoneNumber,
        baseAddress: profile.baseAddresses.address1,
        baseAddress2: profile.baseAddresses.address2,
        costCenters: JSON.stringify(profile.costCenters),
        selectedCostCenters: JSON.stringify(profile.costCenters),
        defaultCostCenter: profile.costCenters[0] || '',
        signature: profile.signature,
      };
      
      // Update via API
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';
      const response = await fetch(`${API_BASE_URL}/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (response.ok) {
        const result = await response.json();
        showMessage('success', 'Profile updated successfully!');
        if (onSettingsUpdate) {
          onSettingsUpdate(profile);
        }
        // Reload the profile to confirm changes were saved
        await loadUserProfile();
      } else {
        const errorData = await response.json();
        console.error('Server error response:', errorData);
        throw new Error(errorData.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
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
                helperText="Display name for app and web portal"
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
                  setPasswordDialogPurpose('password');
                  setPasswordDialogOpen(true);
                  setPasswordData({ current: '', new: '', confirm: '' });
                }}
                sx={{ width: 'fit-content' }}
              >
                Change Password
              </Button>

              <Divider sx={{ my: 1 }} />

              {/* Two-Factor Authentication */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      Two-Factor Authentication (2FA)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {twoFactorStatus.twoFactorEnabled 
                        ? `Enabled for phone ending in ${twoFactorStatus.phoneNumber || '****'}`
                        : 'Add an extra layer of security to your account'}
                    </Typography>
                  </Box>
                  <Switch
                    checked={twoFactorStatus.twoFactorEnabled}
                    disabled={twoFactorLoading}
                    onChange={(e) => {
                      if (!e.target.checked && twoFactorStatus.twoFactorEnabled) {
                        // Disable 2FA - require password
                        setPasswordDialogPurpose('disable2fa');
                        setPasswordDialogOpen(true);
                        setPasswordData({ current: '', new: '', confirm: '' });
                      } else if (e.target.checked && !twoFactorStatus.twoFactorEnabled) {
                        // Enable 2FA - show setup
                        setShowTwoFactorSetup(true);
                        setTwoFactorPhoneNumber('');
                        setTwoFactorVerificationCode('');
                      }
                    }}
                  />
                </Box>

                {!twoFactorStatus.twoFactorEnabled && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    {!showTwoFactorSetup ? (
                      <>
                        <TextField
                          fullWidth
                          label="Phone Number"
                          type="tel"
                          value={twoFactorPhoneNumber}
                          onChange={(e) => setTwoFactorPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                          placeholder="(123) 456-7890"
                          margin="normal"
                          helperText="Enter your phone number to receive verification codes"
                        />
                        <Button
                          variant="contained"
                          onClick={handleSendTwoFactorCode}
                          disabled={twoFactorLoading || !twoFactorPhoneNumber.trim()}
                          sx={{ mt: 1 }}
                        >
                          {twoFactorLoading ? 'Sending...' : 'Send Verification Code'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Alert severity="info" sx={{ mb: 2 }}>
                          Verification code sent to {twoFactorPhoneNumber}
                        </Alert>
                        <TextField
                          fullWidth
                          label="Verification Code"
                          type="text"
                          value={twoFactorVerificationCode}
                          onChange={(e) => setTwoFactorVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Enter 6-digit code"
                          margin="normal"
                          inputProps={{
                            maxLength: 6,
                            pattern: '[0-9]*',
                            inputMode: 'numeric'
                          }}
                        />
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          <Button
                            variant="contained"
                            onClick={handleVerifyTwoFactorCode}
                            disabled={twoFactorLoading || twoFactorVerificationCode.length !== 6}
                          >
                            {twoFactorLoading ? 'Verifying...' : 'Verify & Enable'}
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={() => {
                              setShowTwoFactorSetup(false);
                              setTwoFactorVerificationCode('');
                            }}
                            disabled={twoFactorLoading}
                          >
                            Cancel
                          </Button>
                        </Box>
                      </>
                    )}
                  </Box>
                )}
              </Box>

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
                  onChange={(e) => setProfile(prev => ({
                    ...prev,
                    preferences: { ...prev.preferences, theme: e.target.value as 'light' | 'dark' }
                  }))}
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

      {/* Password Change / Disable 2FA Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)}>
        <DialogTitle>
          {passwordDialogPurpose === 'disable2fa' ? 'Disable Two-Factor Authentication' : 'Change Password'}
        </DialogTitle>
        <DialogContent>
          {passwordDialogPurpose === 'disable2fa' ? (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Please enter your password to disable two-factor authentication.
              </Alert>
              <TextField
                autoFocus
                margin="dense"
                label="Password"
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
            </>
          ) : (
            <>
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
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={passwordDialogPurpose === 'disable2fa' ? handleDisableTwoFactor : handlePasswordChange} 
            variant="contained"
            disabled={!passwordData.current || (passwordDialogPurpose === 'password' && (!passwordData.new || passwordData.new !== passwordData.confirm))}
          >
            {passwordDialogPurpose === 'disable2fa' ? 'Disable 2FA' : 'Change Password'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserSettings;