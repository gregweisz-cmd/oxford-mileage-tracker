import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
} from '@mui/material';
import {
  DriveEta as DriveEtaIcon,
  Receipt as ReceiptIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  LocationOn as LocationOnIcon,
  ArrowForward,
  ArrowBack,
} from '@mui/icons-material';

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface OnboardingSlide {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const slides: OnboardingSlide[] = [
  {
    icon: <DriveEtaIcon sx={{ fontSize: 120 }} />,
    title: 'Track Mileage',
    description: 'Automatically track your trips with GPS or manually enter mileage. Everything syncs instantly between mobile and web.',
    color: '#2196F3',
  },
  {
    icon: <ReceiptIcon sx={{ fontSize: 120 }} />,
    title: 'Capture Receipts',
    description: 'Take photos of receipts and our OCR will extract vendor, amount, and date automatically. Upload from mobile or web.',
    color: '#4CAF50',
  },
  {
    icon: <ScheduleIcon sx={{ fontSize: 120 }} />,
    title: 'Log Time',
    description: 'Track your working hours across different cost centers and categories. Easily switch between months to review past data.',
    color: '#FF9800',
  },
  {
    icon: <AssessmentIcon sx={{ fontSize: 120 }} />,
    title: 'Generate Reports',
    description: 'Submit monthly expense reports with one click. Everything is organized and ready for supervisor approval.',
    color: '#9C27B0',
  },
  {
    icon: <LocationOnIcon sx={{ fontSize: 120 }} />,
    title: 'Smart Per Diem',
    description: 'Automatic per diem calculation based on your location, miles driven, and hours worked. Set your base address to get started.',
    color: '#F44336',
  },
];

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    if (activeStep < slides.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: `linear-gradient(135deg, ${slides[activeStep].color}15 0%, #fff 50%)`,
      }}
    >
      {/* Skip Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
        <Button onClick={handleSkip} sx={{ color: '#666' }}>
          Skip
        </Button>
      </Box>

      {/* Main Content */}
      <Container maxWidth="md" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Card sx={{ borderRadius: 4, boxShadow: 6 }}>
          <CardContent sx={{ p: 6 }}>
            {/* Icon */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mb: 4,
              }}
            >
              <Box
                sx={{
                  width: 200,
                  height: 200,
                  borderRadius: '50%',
                  backgroundColor: `${slides[activeStep].color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: slides[activeStep].color,
                }}
              >
                {slides[activeStep].icon}
              </Box>
            </Box>

            {/* Title */}
            <Typography
              variant="h3"
              component="h1"
              align="center"
              gutterBottom
              sx={{ fontWeight: 'bold', color: '#333', mb: 3 }}
            >
              {slides[activeStep].title}
            </Typography>

            {/* Description */}
            <Typography
              variant="h6"
              component="p"
              align="center"
              sx={{ color: '#666', lineHeight: 1.8, mb: 4 }}
            >
              {slides[activeStep].description}
            </Typography>

            {/* Stepper */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
              {slides.map((_, index) => (
                <Box
                  key={index}
                  sx={{
                    width: index === activeStep ? 30 : 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: index === activeStep ? slides[activeStep].color : '#ccc',
                    mx: 0.5,
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </Box>

            {/* Navigation Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                onClick={handleBack}
                disabled={activeStep === 0}
                startIcon={<ArrowBack />}
                sx={{ visibility: activeStep === 0 ? 'hidden' : 'visible' }}
              >
                Previous
              </Button>

              <Button
                variant="contained"
                onClick={handleNext}
                endIcon={<ArrowForward />}
                sx={{
                  backgroundColor: slides[activeStep].color,
                  '&:hover': {
                    backgroundColor: slides[activeStep].color,
                    opacity: 0.9,
                  },
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                }}
              >
                {activeStep === slides.length - 1 ? 'Get Started' : 'Next'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default OnboardingScreen;

