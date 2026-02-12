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
  Select,
  FormControl,
} from '@mui/material';
import {
  Download as DownloadIcon,
  List as ListIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Settings as SettingsIcon,
  AccountCircle as AccountIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Today as TodayIcon,
  Replay as ReplayIcon,
} from '@mui/icons-material';
import { RealtimeStatusIndicator } from './RealtimeStatusIndicator';
import { NotificationBell } from './NotificationBell';
import { useToast } from '../contexts/ToastContext';
import OxfordHouseLogo from './OxfordHouseLogo';

interface EnhancedHeaderProps {
  title: string;
  subtitle?: string;
  employeeName?: string;
  employeeId?: string;
  employeeRole?: 'employee' | 'supervisor' | 'admin' | 'finance' | 'contracts';
  reportMonth?: number;
  reportYear?: number;
  loading?: boolean;
  isAdminView?: boolean;
  supervisorMode?: boolean;
  onExportPdf?: () => void;
  onSaveReport?: () => void;
  onSubmitReport?: () => void;
  onApproveReport?: () => void;
  onRequestRevision?: () => void;
  onViewAllReports?: () => void;
  onStartFreshReport?: () => void;
  onCheckCompleteness?: () => void;
  onRefresh?: () => void;
  onSettings?: () => void;
  onMonthYearChange?: (month: number, year: number) => void;
  notifications?: number;
  showRealTimeStatus?: boolean;
  onReportClick?: (reportId: string, employeeId?: string, month?: number, year?: number) => void;
  tabs?: React.ReactNode; // Tabs navigation component
}

export const EnhancedHeader: React.FC<EnhancedHeaderProps> = ({
  title,
  subtitle,
  employeeName,
  employeeId,
  employeeRole,
  reportMonth,
  reportYear,
  loading = false,
  isAdminView = false,
  tabs,
  supervisorMode = false,
  onExportPdf,
  onSaveReport,
  onSubmitReport,
  onApproveReport,
  onRequestRevision,
  onViewAllReports,
  onStartFreshReport,
  onCheckCompleteness,
  onRefresh,
  onSettings,
  onMonthYearChange,
  notifications = 0,
  showRealTimeStatus = true,
  onReportClick,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const { showSuccess, showInfo } = useToast();

  /**
   * Opens the settings menu
   */
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  /**
   * Closes the settings menu
   */
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  /**
   * Handles the refresh action, calling the onRefresh callback if provided
   */
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
      showSuccess('Data refreshed successfully');
    }
  };

  /**
   * Converts a month number (1-12) to its name
   * @param month - Month number (1-12)
   * @returns Month name or empty string if invalid
   */
  const getMonthName = (month: number): string => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || '';
  };

  /**
   * Returns the appropriate status color based on current state
   * @returns MUI color name ('warning', 'info', or 'success')
   */
  const getStatusColor = (): 'warning' | 'info' | 'success' => {
    if (loading) return 'warning';
    if (isAdminView) return 'info';
    return 'success';
  };

  /**
   * Returns the appropriate status icon based on current state
   * @returns React element for the status icon
   */
  const getStatusIcon = (): React.ReactElement | undefined => {
    if (loading) return <WarningIcon />;
    if (isAdminView) return <SettingsIcon />;
    return <CheckCircleIcon />;
  };

  /**
   * Returns the appropriate status text based on current state
   * @returns Status text string
   */
  const getStatusText = (): string => {
    if (loading) return 'Loading...';
    if (isAdminView) return 'Admin View';
    return 'Ready';
  };

  /**
   * Enhanced Header Component
   * 
   * Provides a sticky header with:
   * - Logo and title
   * - Employee information and status indicators
   * - Action buttons (Save, Submit, Approve, etc.)
   * - Tab navigation (if provided)
   * - Month/year selectors and utility icons
   * 
   * The entire header is wrapped in a sticky container that stays at the top when scrolling.
   */
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        bgcolor: 'background.paper',
      }}
    >
      {/* Main AppBar with logo, title, and action buttons */}
      <AppBar 
        position="static" 
        elevation={2}
        sx={{ 
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
          transform: 'none !important',
          transition: 'none !important',
          height: 'auto !important',
          minHeight: '72px !important',
          '&.MuiAppBar-root': {
            height: 'auto !important',
            minHeight: '72px !important',
            transform: 'none !important',
            transition: 'none !important'
          }
        }}
      >
      <Toolbar sx={{ 
        minHeight: '72px !important',
        height: '72px !important',
        maxHeight: '72px !important',
        transform: 'none !important',
        transition: 'none !important',
        paddingX: 2,
        paddingY: 1,
        '&.MuiToolbar-root': {
          minHeight: '72px !important',
          height: '72px !important',
          maxHeight: '72px !important',
          transform: 'none !important',
          transition: 'none !important'
        }
      }}>
        {/* Left Section - Logo and Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 280, flexShrink: 0 }}>
          <OxfordHouseLogo size={32} />
          <Box sx={{ lineHeight: 1.2 }}>
            <Typography variant="h6" component="h1" sx={{ fontWeight: 'bold', fontSize: '0.95rem', lineHeight: 1.2 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem', lineHeight: 1.2, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Center Section - Employee Info, Date Selectors, and Status */}
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {/* Employee Info with Date Selectors */}
          {employeeName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                {employeeName.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.85rem' }}>
                  {employeeName}
                </Typography>
                {reportMonth && reportYear && !onMonthYearChange && (
                  <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem' }}>
                    {getMonthName(reportMonth)} {reportYear}
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Status Indicators - Grouped together */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={getStatusIcon()}
              label={getStatusText()}
              color={getStatusColor()}
              size="small"
              variant="outlined"
              sx={{ height: 26, fontSize: '0.75rem' }}
            />
            {showRealTimeStatus && (
              <RealtimeStatusIndicator compact onRefresh={handleRefresh} />
            )}
          </Box>
        </Box>

        {/* Right Section - Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 'auto', flexShrink: 0 }}>
          {/* Action Buttons - Less used actions as icon-only */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {onViewAllReports && (
              <Tooltip title="All Reports">
                <IconButton
                  onClick={onViewAllReports}
                  disabled={loading}
                  size="small"
                  sx={{ 
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <ListIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {onStartFreshReport && (
              <Tooltip title="Start fresh report for this month (deletes current report)">
                <IconButton
                  onClick={onStartFreshReport}
                  disabled={loading}
                  size="small"
                  sx={{ 
                    border: '1px solid',
                    borderColor: 'divider',
                    color: 'warning.main',
                    '&:hover': { bgcolor: 'warning.light', color: 'warning.dark' }
                  }}
                >
                  <ReplayIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {onCheckCompleteness && (
              <Tooltip title="Check Completeness">
                <IconButton
                  onClick={onCheckCompleteness}
                  disabled={loading}
                  size="small"
                  sx={{ 
                    border: '1px solid',
                    borderColor: 'divider',
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'primary.light', color: 'primary.dark' }
                  }}
                >
                  <CheckCircleIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {onSaveReport && (
              <Tooltip title="Save Report">
                <IconButton
                  onClick={onSaveReport}
                  disabled={loading || isAdminView}
                  size="small"
                  sx={{ 
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <SaveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {/* Primary action buttons keep text labels */}
            {supervisorMode ? (
              <>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => {
                    if (onApproveReport) {
                      onApproveReport();
                    }
                  }}
                  disabled={loading}
                  size="small"
                  sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}
                >
                  Approve
                </Button>
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<WarningIcon />}
                  onClick={() => {
                    if (onRequestRevision) {
                      onRequestRevision();
                    }
                  }}
                  disabled={loading}
                  size="small"
                  sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}
                >
                  Revision
                </Button>
              </>
            ) : (
              onSubmitReport && (
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={onSubmitReport}
                  disabled={loading}
                  size="small"
                  sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}
                >
                  Submit
                </Button>
              )
            )}

            {onExportPdf && (
              <Tooltip title="Export PDF">
                <IconButton
                  onClick={onExportPdf}
                  disabled={loading}
                  size="small"
                  sx={{ 
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Toolbar>

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

      </AppBar>

      {/* Tab Navigation - Renders below the main header */}
      {tabs && (
        <Box
          component="div"
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            overflowX: 'auto',
            width: '100%',
            display: 'block',
            '&::-webkit-scrollbar': {
              height: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: '2px',
            },
          }}
        >
          {tabs}
        </Box>
      )}

      {/* Utility Icons Row - Month/Year selectors and utility buttons positioned below tabs */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        gap: 1,
        paddingX: 2,
        paddingY: 0.5,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.default'
      }}>
        {/* Left Side - Month/Year Selectors */}
        {reportMonth && reportYear && onMonthYearChange && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <Select
                value={reportMonth}
                onChange={(e) => onMonthYearChange(Number(e.target.value), reportYear)}
                variant="standard"
                disableUnderline
                sx={{ fontSize: '0.75rem', fontWeight: 400 }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                  <MenuItem key={m} value={m} sx={{ fontSize: '0.8rem' }}>
                    {getMonthName(m)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 60 }}>
              <Select
                value={reportYear}
                onChange={(e) => onMonthYearChange(reportMonth, Number(e.target.value))}
                variant="standard"
                disableUnderline
                sx={{ fontSize: '0.75rem', fontWeight: 400 }}
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <MenuItem key={y} value={y} sx={{ fontSize: '0.8rem' }}>
                    {y}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {/* Go To Current Month Button */}
            {(() => {
              const now = new Date();
              const currentMonth = now.getMonth() + 1;
              const currentYear = now.getFullYear();
              const isCurrentMonth = reportMonth === currentMonth && reportYear === currentYear;
              
              return (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<TodayIcon />}
                  onClick={() => {
                    if (!isCurrentMonth && onMonthYearChange) {
                      onMonthYearChange(currentMonth, currentYear);
                      showSuccess(`Navigated to ${getMonthName(currentMonth)} ${currentYear}`);
                    }
                  }}
                  disabled={isCurrentMonth || loading}
                  sx={{ 
                    fontSize: '0.7rem',
                    minWidth: 'auto',
                    padding: '4px 8px',
                    textTransform: 'none',
                    opacity: isCurrentMonth ? 0.5 : 1,
                    '& .MuiButton-startIcon': {
                      marginRight: '4px',
                      marginLeft: 0
                    }
                  }}
                >
                  Current Month
                </Button>
              );
            })()}
          </Box>
        )}

        {/* Right Side - Utility Icons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Notification Bell */}
          {employeeId && (
            <NotificationBell 
              employeeId={employeeId} 
              role={employeeRole}
              onReportClick={onReportClick}
            />
          )}

          {/* Refresh Button */}
          <Tooltip title="Refresh Data">
            <IconButton
              onClick={handleRefresh}
              disabled={loading}
              size="small"
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Settings Menu */}
          <Tooltip title="Settings">
            <IconButton
              onClick={handleMenuOpen}
              size="small"
            >
              <AccountIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
};
