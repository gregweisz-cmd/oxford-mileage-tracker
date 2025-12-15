import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Button,
  Collapse,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { NotificationsDialog } from './NotificationsDialog';
import { debugError } from '../config/debug';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  reportId?: string;
  employeeId?: string;
  metadata?: any;
}

interface DashboardNotificationsProps {
  employeeId: string;
  role?: 'employee' | 'supervisor' | 'admin' | 'finance';
  onReportClick?: (reportId: string, employeeId?: string, month?: number, year?: number) => void;
  maxDisplay?: number; // Maximum number of notifications to show in collapsed view
}

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
  return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
};

/**
 * Get icon for notification type
 */
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'report_approved':
    case 'report_submitted':
      return <CheckCircleIcon color="success" />;
    case 'report_rejected':
    case 'revision_requested':
      return <WarningIcon color="warning" />;
    case 'error':
      return <ErrorIcon color="error" />;
    default:
      return <InfoIcon color="info" />;
  }
};

/**
 * Get color for notification type
 */
const getNotificationColor = (type: string): 'success' | 'warning' | 'error' | 'info' => {
  switch (type) {
    case 'report_approved':
    case 'report_submitted':
      return 'success';
    case 'report_rejected':
    case 'revision_requested':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'info';
  }
};

export const DashboardNotifications: React.FC<DashboardNotificationsProps> = ({
  employeeId,
  role = 'employee',
  onReportClick,
  maxDisplay = 3,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (employeeId) {
      fetchNotifications();
      
      // Poll for new notifications every 60 seconds
      const interval = setInterval(() => {
        fetchNotifications();
      }, 60000);
      
      return () => clearInterval(interval);
    }
  }, [employeeId]);

  const fetchNotifications = async () => {
    if (!employeeId) return;
    
    setLoading(true);
    try {
      // Fetch unread count
      const countResponse = await fetch(`${API_BASE_URL}/api/notifications/${employeeId}/count`);
      if (countResponse.ok) {
        const countData = await countResponse.json();
        setUnreadCount(countData.count || 0);
      }

      // Fetch recent notifications (unread first, then recent)
      const notificationsResponse = await fetch(
        `${API_BASE_URL}/api/notifications/${employeeId}?limit=${maxDisplay * 2}`
      );
      if (notificationsResponse.ok) {
        const data = await notificationsResponse.json();
        setNotifications(data || []);
      }
    } catch (error) {
      debugError('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
      });
      if (response.ok) {
        // Update local state
        setNotifications(prev =>
          prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      debugError('Error marking notification as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // If it's a report-related notification, navigate to the report
    if (notification.reportId && onReportClick) {
      const metadata = notification.metadata || {};
      onReportClick(
        notification.reportId,
        notification.employeeId,
        metadata.month,
        metadata.year
      );
    }
  };

  const displayedNotifications = expanded
    ? notifications
    : notifications.filter(n => !n.isRead).slice(0, maxDisplay);

  const hasMoreNotifications = notifications.length > displayedNotifications.length;

  if (loading && notifications.length === 0) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Loading notifications...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (notifications.length === 0) {
    return null; // Don't show anything if there are no notifications
  }

  return (
    <>
      <Card sx={{ mb: 3, borderLeft: unreadCount > 0 ? '4px solid' : 'none', borderColor: 'primary.main' }}>
        <CardContent sx={{ pb: notifications.length > 0 ? 1 : 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotificationsIcon color="primary" />
              <Typography variant="h6" component="h2">
                Notifications
              </Typography>
              {unreadCount > 0 && (
                <Chip
                  label={unreadCount}
                  color="error"
                  size="small"
                  sx={{ height: 20, fontSize: '0.75rem' }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {notifications.length > maxDisplay && (
                <Button
                  size="small"
                  onClick={() => setExpanded(!expanded)}
                  endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                >
                  {expanded ? 'Show Less' : `Show All (${notifications.length})`}
                </Button>
              )}
              <Button size="small" onClick={() => setDialogOpen(true)}>
                View All
              </Button>
            </Box>
          </Box>

          {displayedNotifications.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              No unread notifications
            </Alert>
          ) : (
            <List sx={{ pt: 0 }}>
              {displayedNotifications.map((notification) => (
                <ListItem
                  key={notification.id}
                  sx={{
                    bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                    borderRadius: 1,
                    mb: 0.5,
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.selected',
                    },
                  }}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getNotificationIcon(notification.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="body2"
                          fontWeight={notification.isRead ? 'normal' : 'medium'}
                        >
                          {notification.title}
                        </Typography>
                        {!notification.isRead && (
                          <Chip
                            label="New"
                            color={getNotificationColor(notification.type)}
                            size="small"
                            sx={{ height: 16, fontSize: '0.65rem' }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          {formatTimeAgo(notification.createdAt)}
                        </Typography>
                      </Box>
                    }
                  />
                  {!notification.isRead && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                      sx={{ ml: 1 }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  )}
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <NotificationsDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          fetchNotifications(); // Refresh after closing
        }}
        employeeId={employeeId}
        role={role}
        onUpdate={fetchNotifications}
        onReportClick={onReportClick}
      />
    </>
  );
};

