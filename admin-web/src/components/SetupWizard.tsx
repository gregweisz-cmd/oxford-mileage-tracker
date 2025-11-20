import React, { useState, useRef } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  Typography,
  Paper,
  Container,
  Alert,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Home as HomeIcon,
  Star as StarIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Edit as EditIcon,
  Upload as UploadIcon,
  Create as CreateIcon,
} from '@mui/icons-material';
import SignatureCanvas from 'react-signature-canvas';
import { EmployeeApiService } from '../services/employeeApiService';

interface SetupWizardProps {
  employee: any;
  onComplete: () => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ employee, onComplete }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Form data
  const [baseAddress, setBaseAddress] = useState(employee?.baseAddress || '');
  const [defaultCostCenter, setDefaultCostCenter] = useState(employee?.defaultCostCenter || '');
  const [typicalWorkStartHour, setTypicalWorkStartHour] = useState<string>(
    employee?.typicalWorkStartHour !== undefined && employee?.typicalWorkStartHour !== null
      ? String(employee.typicalWorkStartHour)
      : '9'
  );
  const [typicalWorkEndHour, setTypicalWorkEndHour] = useState<string>(
    employee?.typicalWorkEndHour !== undefined && employee?.typicalWorkEndHour !== null
      ? String(employee.typicalWorkEndHour)
      : '17'
  );
  const [preferredName, setPreferredName] = useState(employee?.preferredName || '');
  const [email, setEmail] = useState(employee?.email || '');
  const [phoneNumber, setPhoneNumber] = useState(employee?.phoneNumber || '');
  const [signature, setSignature] = useState<string | null>(employee?.signature || null);
  const [signatureTab, setSignatureTab] = useState(0); // 0 = draw, 1 = upload
  
  // Signature canvas ref
  const signatureRef = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Cost centers from employee's assigned ones
  const availableCostCenters = employee?.selectedCostCenters && Array.isArray(employee.selectedCostCenters)
    ? employee.selectedCostCenters
    : (employee?.selectedCostCenters ? JSON.parse(employee.selectedCostCenters) : []);

  const steps = [
    {
      label: 'Base Address',
      icon: <HomeIcon />,
      description: 'Enter your primary work location used for mileage calculations.',
    },
    {
      label: 'Default Cost Center',
      icon: <StarIcon />,
      description: 'Select your default cost center. This will be pre-selected for new entries.',
    },
    {
      label: 'Work Hours',
      icon: <AccessTimeIcon />,
      description: 'Enter your typical work hours so notifications can be customized to your schedule.',
    },
    {
      label: 'Preferred Name',
      icon: <PersonIcon />,
      description: 'How would you like to be addressed?',
    },
    {
      label: 'Contact Info',
      icon: <EmailIcon />,
      description: 'Confirm your email address and phone number.',
    },
    {
      label: 'Signature',
      icon: <EditIcon />,
      description: 'Please sign using your mouse or touchscreen.',
    },
  ];

  const validateStep = (step: number): boolean => {
    setError('');
    
    switch (step) {
      case 0: // Base Address
        if (!baseAddress.trim()) {
          setError('Please enter your base address.');
          return false;
        }
        break;
      case 1: // Default Cost Center
        if (availableCostCenters.length > 0 && !defaultCostCenter.trim()) {
          setError('Please select a default cost center.');
          return false;
        }
        break;
      case 2: // Work Hours
        const startHour = parseInt(typicalWorkStartHour, 10);
        const endHour = parseInt(typicalWorkEndHour, 10);
        if (isNaN(startHour) || startHour < 0 || startHour > 23) {
          setError('Work start hour must be between 0 and 23.');
          return false;
        }
        if (isNaN(endHour) || endHour < 0 || endHour > 23) {
          setError('Work end hour must be between 0 and 23.');
          return false;
        }
        break;
      case 3: // Preferred Name
        if (!preferredName.trim()) {
          setError('Please enter your preferred name.');
          return false;
        }
        break;
      case 4: // Contact Info
        if (!email.trim() || !email.includes('@')) {
          setError('Please enter a valid email address.');
          return false;
        }
        if (!phoneNumber.trim()) {
          setError('Please enter your phone number.');
          return false;
        }
        break;
      case 5: // Signature
        if (!signature) {
          setError('Please provide your signature.');
          return false;
        }
        break;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    setError('');
  };

  const handleSignatureEnd = () => {
    if (signatureRef.current) {
      const dataURL = signatureRef.current.toDataURL('image/png');
      setSignature(dataURL);
    }
  };

  const handleClearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSignature(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    // Read file as data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setSignature(result);
      setError('');
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleComplete = async () => {
    if (!validateStep(activeStep)) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Get signature if not already captured
      let finalSignature = signature;
      if (!finalSignature && signatureRef.current && !signatureRef.current.isEmpty()) {
        finalSignature = signatureRef.current.toDataURL('image/png');
      }

      await EmployeeApiService.updateEmployee(employee.id, {
        baseAddress: baseAddress.trim(),
        defaultCostCenter: defaultCostCenter.trim() || undefined,
        typicalWorkStartHour: parseInt(typicalWorkStartHour, 10),
        typicalWorkEndHour: parseInt(typicalWorkEndHour, 10),
        preferredName: preferredName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        signature: finalSignature || undefined,
        hasCompletedSetupWizard: true, // Mark setup wizard as completed in backend
      });
      
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to save setup. Please try again.');
      setIsSaving(false);
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0: // Base Address
        return (
          <Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {steps[0].description}
            </Typography>
            <TextField
              fullWidth
              label="Base Address"
              value={baseAddress}
              onChange={(e) => setBaseAddress(e.target.value)}
              placeholder="e.g., 123 Main St, City, State ZIP"
              multiline
              rows={3}
              required
            />
          </Box>
        );

      case 1: // Default Cost Center
        return (
          <Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {steps[1].description}
            </Typography>
            {availableCostCenters.length === 0 ? (
              <Alert severity="info">
                No cost centers have been assigned to you yet. Please contact your administrator.
              </Alert>
            ) : (
              <FormControl fullWidth required>
                <InputLabel>Default Cost Center</InputLabel>
                <Select
                  value={defaultCostCenter}
                  onChange={(e) => setDefaultCostCenter(e.target.value)}
                  label="Default Cost Center"
                >
                  {availableCostCenters.map((cc: string) => (
                    <MenuItem key={cc} value={cc}>
                      {cc}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        );

      case 2: // Work Hours
        return (
          <Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {steps[2].description}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Work Start Hour"
                  type="number"
                  value={typicalWorkStartHour}
                  onChange={(e) => setTypicalWorkStartHour(e.target.value)}
                  inputProps={{ min: 0, max: 23 }}
                  helperText={`${parseInt(typicalWorkStartHour, 10) >= 12 ? parseInt(typicalWorkStartHour, 10) - 12 || 12 : parseInt(typicalWorkStartHour, 10) || 0} ${parseInt(typicalWorkStartHour, 10) >= 12 ? 'PM' : 'AM'}`}
                  required
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Work End Hour"
                  type="number"
                  value={typicalWorkEndHour}
                  onChange={(e) => setTypicalWorkEndHour(e.target.value)}
                  inputProps={{ min: 0, max: 23 }}
                  helperText={`${parseInt(typicalWorkEndHour, 10) >= 12 ? parseInt(typicalWorkEndHour, 10) - 12 || 12 : parseInt(typicalWorkEndHour, 10) || 0} ${parseInt(typicalWorkEndHour, 10) >= 12 ? 'PM' : 'AM'}`}
                  required
                />
              </Box>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
              Enter hours in 24-hour format (0-23). Example: 9 for 9 AM, 17 for 5 PM.
            </Typography>
          </Box>
        );

      case 3: // Preferred Name
        return (
          <Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {steps[3].description}
            </Typography>
            <TextField
              fullWidth
              label="Preferred Name"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder="e.g., John, Johnny, J."
              required
            />
          </Box>
        );

      case 4: // Contact Info
        return (
          <Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {steps[4].description}
            </Typography>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Phone Number"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g., (555) 123-4567"
              required
            />
          </Box>
        );

      case 5: // Signature
        return (
          <Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {steps[5].description}
            </Typography>
            
            <Tabs 
              value={signatureTab} 
              onChange={(e, newValue) => setSignatureTab(newValue)}
              sx={{ mb: 3 }}
              centered
            >
              <Tab icon={<CreateIcon />} label="Draw Signature" iconPosition="start" />
              <Tab icon={<UploadIcon />} label="Upload PNG File" iconPosition="start" />
            </Tabs>

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {signatureTab === 0 ? (
                // Draw signature
                <>
                  <SignatureCanvas
                    ref={signatureRef}
                    canvasProps={{
                      width: 600,
                      height: 200,
                      className: 'signature-canvas',
                      style: { border: '2px solid #ccc', borderRadius: '4px' },
                    }}
                    onEnd={handleSignatureEnd}
                  />
                  {signature && (
                    <Box sx={{ mt: 2 }}>
                      <img
                        src={signature}
                        alt="Signature preview"
                        style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </Box>
                  )}
                </>
              ) : (
                // Upload file
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <Button
                    variant="contained"
                    startIcon={<UploadIcon />}
                    onClick={handleUploadClick}
                    sx={{ mb: 2 }}
                  >
                    Choose PNG/Image File
                  </Button>
                  {signature && (
                    <Box sx={{ mt: 2 }}>
                      <img
                        src={signature}
                        alt="Signature preview"
                        style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                    </Box>
                  )}
                </>
              )}
              
              {signature && (
                <Button
                  variant="outlined"
                  onClick={handleClearSignature}
                  sx={{ mt: 2 }}
                >
                  Clear Signature
                </Button>
              )}
            </Paper>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Welcome! Let's Get You Set Up
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
          Please complete the following steps to configure your profile.
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel icon={step.icon}>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ minHeight: 300, mb: 4 }}>
          {renderStepContent(activeStep)}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            sx={{ mr: 1 }}
          >
            Back
          </Button>
          <Box>
            {activeStep === steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleComplete}
                disabled={isSaving}
                sx={{ ml: 1 }}
              >
                {isSaving ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Saving...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </Button>
            ) : (
              <Button variant="contained" onClick={handleNext} sx={{ ml: 1 }}>
                Next
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default SetupWizard;
