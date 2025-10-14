import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  Fade
} from '@mui/material';
import {
  Print as PrintIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  List as ListIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { RealtimeStatusIndicator } from './RealtimeStatusIndicator';
import { useToast } from '../contexts/ToastContext';
import OxfordHouseLogo from './OxfordHouseLogo';

interface EnhancedHeaderProps {
  title: string;
  subtitle?: string;
  employeeName?: string;
  reportMonth?: number;
  reportYear?: number;
  loading?: boolean;
  isAdminView?: boolean;
  onExportPdf?: () => void;
  onSaveReport?: () => void;
  onSubmitReport?: () => void;
  onSignatureCapture?: () => void;
  onViewAllReports?: () => void;
  onCheckCompleteness?: () => void;
  onRefresh?: () => void;
  onSettings?: () => void;
  notifications?: number;
  showRealTimeStatus?: boolean;
}

export const EnhancedHeader: React.FC<EnhancedHeaderProps> = ({
  title,
  subtitle,
  employeeName,
  reportMonth,
  reportYear,
  loading = false,
  isAdminView = false,
  onExportPdf,
  onSaveReport,
  onSubmitReport,
  onSignatureCapture,
  onViewAllReports,
  onCheckCompleteness,
  onRefresh,
  onSettings,
  notifications = 0,
  showRealTimeStatus = true
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const { showSuccess, showInfo } = useToast();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
      showSuccess('Data refreshed successfully');
    }
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || '';
  };

  const getStatusColor = () => {
    if (loading) return 'warning';
    if (isAdminView) return 'info';
    return 'success';
  };

  const getStatusIcon = () => {
    if (loading) return <WarningIcon />;
    if (isAdminView) return <SettingsIcon />;
    return <CheckCircleIcon />;
  };

  const getStatusText = () => {
    if (loading) return 'Loading...';
    if (isAdminView) return 'Admin View';
    return 'Ready';
  };

  return (
    <AppBar 
      position="sticky" 
      elevation={2}
      sx={{ 
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'divider',
        // Prevent shrinking on scroll
        transform: 'none !important',
        transition: 'none !important',
        // Increase height to accommodate subtitle text
        height: '80px !important',
        minHeight: '80px !important',
        maxHeight: '80px !important',
        // Override any potential CSS that might cause shrinking
        '&.MuiAppBar-root': {
          height: '80px !important',
          minHeight: '80px !important',
          maxHeight: '80px !important',
          transform: 'none !important',
          transition: 'none !important'
        }
      }}
    >
      <Toolbar sx={{ 
        minHeight: '80px !important',
        height: '80px !important',
        maxHeight: '80px !important',
        // Prevent any scaling or transformation
        transform: 'none !important',
        transition: 'none !important',
        // Ensure padding is consistent
        paddingTop: '8px !important',
        paddingBottom: '8px !important',
        // Override any potential CSS that might cause shrinking
        '&.MuiToolbar-root': {
          minHeight: '80px !important',
          height: '80px !important',
          maxHeight: '80px !important',
          transform: 'none !important',
          transition: 'none !important'
        }
      }}>
        {/* Left Section - Logo, Title and Info */}
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <OxfordHouseLogo size={40} />
          <Box>
            <Typography variant="h6" component="h1" sx={{ fontWeight: 'bold' }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
          </Box>

          {/* Employee Info */}
          {employeeName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                {employeeName.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  {employeeName}
                </Typography>
                {reportMonth && reportYear && (
                  <Typography variant="caption" color="textSecondary">
                    {getMonthName(reportMonth)} {reportYear}
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Status Indicator */}
          <Chip
            icon={getStatusIcon()}
            label={getStatusText()}
            color={getStatusColor()}
            size="small"
            variant="outlined"
          />
        </Box>

        {/* Center Section - Real-time Status */}
        {showRealTimeStatus && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <RealtimeStatusIndicator compact onRefresh={handleRefresh} />
          </Box>
        )}

        {/* Right Section - Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
          {/* Refresh Button */}
          <Tooltip title="Refresh Data">
            <IconButton
              onClick={handleRefresh}
              disabled={loading}
              size="small"
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          {/* Notifications */}
          {notifications > 0 && (
            <Tooltip title={`${notifications} notifications`}>
              <IconButton size="small">
                <Badge badgeContent={notifications} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          )}

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {onSignatureCapture && (
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={onSignatureCapture}
                disabled={loading || isAdminView}
                size="small"
              >
                Signature
              </Button>
            )}

            {onViewAllReports && (
              <Button
                variant="outlined"
                startIcon={<ListIcon />}
                onClick={onViewAllReports}
                disabled={loading}
                size="small"
              >
                All Reports
              </Button>
            )}

            {onCheckCompleteness && (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={onCheckCompleteness}
                disabled={loading}
                color="secondary"
                size="small"
              >
                Check
              </Button>
            )}

            {onSaveReport && (
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={onSaveReport}
                disabled={loading || isAdminView}
                size="small"
              >
                Save
              </Button>
            )}

            {onSubmitReport && (
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={onSubmitReport}
                disabled={loading || isAdminView}
                size="small"
              >
                Submit
              </Button>
            )}

            {onExportPdf && (
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={onExportPdf}
                disabled={loading}
                size="small"
              >
                Export PDF
              </Button>
            )}
          </Box>

          {/* Settings Menu */}
          <Tooltip title="Settings">
            <IconButton
              onClick={handleMenuOpen}
              size="small"
            >
              <AccountIcon />
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={() => { onSettings?.(); handleMenuClose(); }}>
              <SettingsIcon sx={{ mr: 1 }} />
              Settings
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { showInfo('Profile management coming soon'); handleMenuClose(); }}>
              <AccountIcon sx={{ mr: 1 }} />
              Profile
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
