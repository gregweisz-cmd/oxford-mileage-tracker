import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Typography,
  Chip,
  Box,
  IconButton,
  CircularProgress,
  Divider,
  Alert,
  MenuItem,
  Menu,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  MarkEmailRead as MarkEmailReadIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useToast } from '../contexts/ToastContext';
import { debugError } from '../config/debug';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/**
 * Format a date as "time ago" string (e.g., "2 hours ago", "3 days ago")
 */
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks !== 1 ? 's' : ''} ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
  }
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} year${diffInYears !== 1 ? 's' : ''} ago`;
};

export interface Notification {
  id: string;
  recipientId: string;
  recipientRole: string;
  type: string;
  title: string;
  message: string;
  reportId?: string;
  employeeId?: string;
  employeeName?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  isRead: boolean;
  isDismissible: boolean;
  createdAt: string;
  readAt?: string;
  metadata?: any;
}

interface NotificationsDialogProps {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  role?: 'employee' | 'supervisor' | 'admin' | 'finance';
  onUpdate?: () => void;
  onReportClick?: (reportId: string, employeeId?: string, month?: number, year?: number) => void;
}

export const NotificationsDialog: React.FC<NotificationsDialogProps> = ({
  open,
  onClose,
  employeeId,
  role,
  onUpdate,
  onReportClick,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [sundayReminderEnabled, setSundayReminderEnabled] = useState(true);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    if (open && employeeId) {
      fetchNotifications();
      fetchSundayReminderPreference();
    }
  }, [open, employeeId]);

  const fetchNotifications = async () => {
    if (!employeeId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${employeeId}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data || []);
      } else {
        showError('Failed to load notifications');
      }
    } catch (error) {
      showError('Error loading notifications');
      debugError('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSundayReminderPreference = async () => {
    if (!employeeId || role !== 'employee') return;
    
    try {
      // Fetch employee data to get sundayReminderEnabled preference
      const response = await fetch(`${API_BASE_URL}/api/employees/${employeeId}`);
      if (response.ok) {
        const employee = await response.json();
        setSundayReminderEnabled(employee.sundayReminderEnabled !== 0);
      }
    } catch (error) {
      debugError('Error fetching Sunday reminder preference:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
        );
        onUpdate?.();
      }
    } catch (error) {
      showError('Error marking notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${employeeId}/read-all`, {
        method: 'PUT',
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
        showSuccess('All notifications marked as read');
        onUpdate?.();
      }
    } catch (error) {
      showError('Error marking all notifications as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        showSuccess('Notification deleted');
        onUpdate?.();
      }
    } catch (error) {
      showError('Error deleting notification');
    }
    setAnchorEl(null);
    setSelectedNotification(null);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, notification: Notification) => {
    setAnchorEl(event.currentTarget);
    setSelectedNotification(notification);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedNotification(null);
  };

  const handleToggleSundayReminder = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    setSundayReminderEnabled(enabled);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/preferences/sunday-reminder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId,
          enabled,
        }),
      });
      if (response.ok) {
        showSuccess(enabled ? 'Sunday reminders enabled' : 'Sunday reminders disabled');
      } else {
        showError('Failed to update Sunday reminder preference');
        setSundayReminderEnabled(!enabled); // Revert on error
      }
    } catch (error) {
      showError('Error updating Sunday reminder preference');
      setSundayReminderEnabled(!enabled); // Revert on error
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    // If notification has a reportId and onReportClick callback is provided, navigate to report
    if (notification.reportId && onReportClick) {
      try {
        // Fetch report details to get month/year/employeeId
        const response = await fetch(`${API_BASE_URL}/api/expense-reports/${notification.reportId}`);
        if (response.ok) {
          const report = await response.json();
          onReportClick(
            notification.reportId,
            report.employeeId || notification.employeeId,
            report.month,
            report.year
          );
          onClose(); // Close the dialog after navigation
        } else {
          // If report not found, still try with what we have from notification
          onReportClick(
            notification.reportId,
            notification.employeeId,
            notification.metadata?.month,
            notification.metadata?.year
          );
          onClose();
        }
      } catch (error) {
        debugError('Error fetching report details:', error);
        // Still try to navigate with available data
        onReportClick(
          notification.reportId,
          notification.employeeId,
          notification.metadata?.month,
          notification.metadata?.year
        );
        onClose();
      }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'report_submitted':
      case 'approval_needed':
        return <InfoIcon color="info" />;
      case 'revision_requested':
        return <WarningIcon color="warning" />;
      case 'sunday_reminder':
        return <CheckCircleIcon color="success" />;
      default:
        return <InfoIcon />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'report_submitted':
      case 'approval_needed':
        return 'info';
      case 'revision_requested':
        return 'warning';
      case 'sunday_reminder':
        return 'success';
      default:
        return 'default';
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: '600px',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">Notifications</Typography>
          {unreadCount > 0 && (
            <Chip label={unreadCount} color="error" size="small" />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {role === 'employee' && (
            <FormControlLabel
              control={
                <Switch
                  checked={sundayReminderEnabled}
                  onChange={handleToggleSundayReminder}
                  size="small"
                />
              }
              label={
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                  Sunday Reminders
                </Typography>
              }
            />
          )}
          {unreadCount > 0 && (
            <Button size="small" onClick={markAllAsRead} startIcon={<MarkEmailReadIcon />}>
              Mark All Read
            </Button>
          )}
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
            <CircularProgress />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="textSecondary">
              No notifications
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  disablePadding
                  sx={{
                    bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                    '&:hover': {
                      bgcolor: 'action.selected',
                    },
                  }}
                >
                  <ListItemButton
                    onClick={() => handleNotificationClick(notification)}
                    sx={{ cursor: notification.reportId && onReportClick ? 'pointer' : 'default' }}
                  >
                    <ListItemIcon>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography component="span" variant="body2" fontWeight={notification.isRead ? 'normal' : 'bold'}>
                            {notification.title}
                          </Typography>
                          {!notification.isRead && (
                            <Chip label="New" color="error" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box component="span" sx={{ display: 'inline-block', width: '100%' }}>
                          <Box component="span" sx={{ display: 'block', mb: 0.5 }}>
                            {notification.message}
                          </Box>
                          <Box component="span" sx={{ fontSize: '0.75rem', opacity: 0.7, display: 'block' }}>
                            {formatTimeAgo(notification.createdAt)}
                          </Box>
                        </Box>
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                  </ListItemButton>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, notification)}
                    sx={{ mr: 1 }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </ListItem>
                {index < notifications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 1.5 }}>
        <Button onClick={onClose} variant="outlined" size="small">
          Close
        </Button>
      </DialogActions>

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
        {selectedNotification && !selectedNotification.isRead && (
          <MenuItem
            onClick={() => {
              markAsRead(selectedNotification.id);
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <MarkEmailReadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Mark as Read</ListItemText>
          </MenuItem>
        )}
        {selectedNotification && selectedNotification.isDismissible && (
          <MenuItem
            onClick={() => {
              deleteNotification(selectedNotification.id);
            }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Dialog>
  );
};

