import React, { useState, useEffect, useCallback } from 'react';
import { IconButton, Badge, Tooltip } from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { NotificationsDialog } from './NotificationsDialog';
import { useVisibilityPolling } from '../hooks/useVisibilityPolling';
import {
  fetchNotificationUnreadCount,
  getNotificationRecipientId,
  logNotificationApiError,
} from '../services/notificationApi';

interface NotificationBellProps {
  employeeId: string;
  role?: 'employee' | 'supervisor' | 'admin' | 'finance' | 'contracts';
  onReportClick?: (
    reportId: string,
    employeeId?: string,
    month?: number,
    year?: number,
    staffPortalTabIndex?: number
  ) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ employeeId, role, onReportClick }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const recipientId = getNotificationRecipientId(employeeId) || employeeId;

  const fetchUnreadCount = useCallback(async () => {
    if (!recipientId) return;
    
    try {
      const count = await fetchNotificationUnreadCount(recipientId);
      setUnreadCount(count);
    } catch (error) {
      logNotificationApiError('Error fetching notification count:', error);
    }
  }, [recipientId]);

  useEffect(() => {
    if (recipientId) {
      fetchUnreadCount();
    }
  }, [recipientId, fetchUnreadCount]);

  useVisibilityPolling(fetchUnreadCount, 60000, { enabled: !!recipientId });

  const handleOpen = () => {
    setOpen(true);
    fetchUnreadCount();
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleNotificationsUpdate = (options?: { markAllAsRead?: boolean; unreadCount?: number }) => {
    if (options?.markAllAsRead) {
      setUnreadCount(0);
      return;
    }
    if (typeof options?.unreadCount === 'number') {
      setUnreadCount(Math.max(0, options.unreadCount));
    }
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
        employeeId={recipientId}
        role={role}
        onUpdate={handleNotificationsUpdate}
        onReportClick={onReportClick}
      />
    </>
  );
};
