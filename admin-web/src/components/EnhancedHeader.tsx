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
  Select,
  FormControl,
  // Fade // Currently unused
} from '@mui/material';
import {
  // Print as PrintIcon, // Currently unused
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
  // Error as ErrorIcon // Currently unused
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
  onMonthYearChange?: (month: number, year: number) => void;
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
  onMonthYearChange,
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
        // More compact height
        height: '60px !important',
        minHeight: '60px !important',
        maxHeight: '60px !important',
        // Override any potential CSS that might cause shrinking
        '&.MuiAppBar-root': {
          height: '60px !important',
          minHeight: '60px !important',
          maxHeight: '60px !important',
          transform: 'none !important',
          transition: 'none !important'
        }
      }}
    >
      <Toolbar sx={{ 
        minHeight: '60px !important',
        height: '60px !important',
        maxHeight: '60px !important',
        // Prevent any scaling or transformation
        transform: 'none !important',
        transition: 'none !important',
        // Ensure padding is consistent
        paddingTop: '4px !important',
        paddingBottom: '4px !important',
        // Override any potential CSS that might cause shrinking
        '&.MuiToolbar-root': {
          minHeight: '60px !important',
          height: '60px !important',
          maxHeight: '60px !important',
          transform: 'none !important',
          transition: 'none !important'
        }
      }}>
        {/* Left Section - Logo and Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 300 }}>
          <OxfordHouseLogo size={36} />
          <Box>
            <Typography variant="h6" component="h1" sx={{ fontWeight: 'bold', fontSize: '1rem' }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Center Section - Employee Info, Date Selectors, and Status */}
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          {/* Employee Info with Date Selectors */}
          {employeeName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main' }}>
                {employeeName.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.85rem' }}>
                  {employeeName}
                </Typography>
                {reportMonth && reportYear && onMonthYearChange && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <FormControl size="small" sx={{ minWidth: 70 }}>
                      <Select
                        value={reportMonth}
                        onChange={(e) => onMonthYearChange(Number(e.target.value), reportYear)}
                        variant="standard"
                        disableUnderline
                        sx={{ fontSize: '0.7rem', fontWeight: 400 }}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                          <MenuItem key={m} value={m} sx={{ fontSize: '0.75rem' }}>
                            {getMonthName(m)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 55 }}>
                      <Select
                        value={reportYear}
                        onChange={(e) => onMonthYearChange(reportMonth, Number(e.target.value))}
                        variant="standard"
                        disableUnderline
                        sx={{ fontSize: '0.7rem', fontWeight: 400 }}
                      >
                        {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                          <MenuItem key={y} value={y} sx={{ fontSize: '0.75rem' }}>
                            {y}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                )}
                {reportMonth && reportYear && !onMonthYearChange && (
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
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
            sx={{ height: 24 }}
          />

          {/* Real-time Status */}
          {showRealTimeStatus && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <RealtimeStatusIndicator compact onRefresh={handleRefresh} />
            </Box>
          )}
        </Box>

        {/* Right Section - Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 'auto' }}>
          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
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

          {/* Settings and Refresh */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5 }}>
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

            {/* Settings Menu */}
            <Tooltip title="Settings">
              <IconButton
                onClick={handleMenuOpen}
                size="small"
              >
                <AccountIcon />
              </IconButton>
            </Tooltip>
          </Box>

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
