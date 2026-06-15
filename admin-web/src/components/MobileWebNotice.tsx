import React from 'react';
import {
  Box,
  Button,
  Container,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import AndroidIcon from '@mui/icons-material/Android';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import OxfordHouseLogo from './OxfordHouseLogo';
import { MOBILE_APP_LINKS } from '../config/mobileAppLinks';
import { getMobilePlatform } from '../utils/mobileDetection';

interface MobileWebNoticeProps {
  onContinue: () => void;
  /** Shown on the sign-in screen vs. after authentication. */
  variant?: 'login' | 'portal';
}

const MobileWebNotice: React.FC<MobileWebNoticeProps> = ({
  onContinue,
  variant = 'login',
}) => {
  const platform = getMobilePlatform();
  const continueLabel =
    variant === 'login' ? 'Continue to sign in on web' : 'Continue to web portal';

  return (
    <Container component="main" maxWidth="sm" sx={{ px: 2 }}>
      <Box
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          py: 4,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <OxfordHouseLogo size={56} />
        </Box>

        <Typography component="h1" variant="h5" align="center" sx={{ mb: 0.5 }}>
          Oxford House Expense Tracker
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
          Works best on the mobile app
        </Typography>

        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            For GPS mileage, receipts, and day-to-day tracking, use the Oxford House
            mobile app. It is built for field work and stays in sync with this portal.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Need a quick change away from your computer? You can still open the web
            portal here to edit your report or submit when you are in a hurry.
          </Typography>

          <Stack spacing={1.5}>
            {(platform === 'ios' || platform === 'other') && (
              <Button
                component="a"
                href={MOBILE_APP_LINKS.ios}
                target="_blank"
                rel="noopener noreferrer"
                variant="contained"
                size="large"
                fullWidth
                startIcon={<PhoneIphoneIcon />}
              >
                {platform === 'ios' ? 'Get the iPhone app' : 'Get the iPhone app (TestFlight)'}
              </Button>
            )}

            {(platform === 'android' || platform === 'other') && (
              <Button
                component="a"
                href={MOBILE_APP_LINKS.android}
                target="_blank"
                rel="noopener noreferrer"
                variant={platform === 'android' ? 'contained' : 'outlined'}
                size="large"
                fullWidth
                startIcon={<AndroidIcon />}
              >
                Get the Android app
              </Button>
            )}

            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={<OpenInBrowserIcon />}
              onClick={onContinue}
            >
              {continueLabel}
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2.5 }}>
            New to the app?{' '}
            <Link href={MOBILE_APP_LINKS.mobileHowTo} target="_blank" rel="noopener noreferrer">
              Mobile app how-to
            </Link>
            {' · '}
            <Link href={MOBILE_APP_LINKS.support} target="_blank" rel="noopener noreferrer">
              Support
            </Link>
          </Typography>
        </Paper>

        <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 3 }}>
          On a computer? Add <code>?desktop=1</code> to the URL to skip this screen.
        </Typography>
      </Box>
    </Container>
  );
};

export default MobileWebNotice;
