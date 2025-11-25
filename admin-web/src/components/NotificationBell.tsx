import React, { useState, useEffect } from 'react';
import { IconButton, Badge, Tooltip } from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { NotificationsDialog } from './NotificationsDialog';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

interface NotificationBellProps {
  employeeId: string;
  role?: 'employee' | 'supervisor' | 'admin' | 'finance';
  onReportClick?: (reportId: string, employeeId?: string, month?: number, year?: number) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ employeeId, role, onReportClick }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (employeeId) {
      fetchUnreadCount();
      
      // Poll for unread count every 30 seconds
      const interval = setInterval(() => {
        fetchUnreadCount();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [employeeId]);

  const fetchUnreadCount = async () => {
    if (!employeeId) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/${employeeId}/count`);
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      // Silently fail - don't show errors for polling
      console.error('Error fetching notification count:', error);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    // Refresh count when opening dialog
    fetchUnreadCount();
  };

  const handleClose = () => {
    setOpen(false);
    // Refresh count after closing dialog (in case notifications were read)
    setTimeout(() => {
      fetchUnreadCount();
    }, 500);
  };

  const handleNotificationsUpdate = () => {
    // Refresh count when notifications are updated
    fetchUnreadCount();
  };

  return (
    <>
      <Tooltip title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'Notifications'}>
        <IconButton
          onClick={handleOpen}
          color="inherit"
          size="small"
          sx={{ mr: 0.5 }}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      
      <NotificationsDialog
        open={open}
        onClose={handleClose}
        employeeId={employeeId}
        role={role}
        onUpdate={handleNotificationsUpdate}
        onReportClick={onReportClick}
      />
    </>
  );
};

