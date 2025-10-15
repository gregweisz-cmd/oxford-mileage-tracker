import React from 'react';
import {
  Box,
  Chip,
  Tooltip,
  IconButton,
  Typography,
  Fade,
  CircularProgress
} from '@mui/material';
import {
  Wifi as ConnectedIcon,
  WifiOff as DisconnectedIcon,
  // Sync as SyncIcon, // Currently unused
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useRealtimeStatus } from '../hooks/useRealtimeSync';

interface RealtimeStatusIndicatorProps {
  compact?: boolean;
  showDetails?: boolean;
  onRefresh?: () => void;
}

export const RealtimeStatusIndicator: React.FC<RealtimeStatusIndicatorProps> = ({
  compact = false,
  showDetails = false,
  onRefresh
}) => {
  const status = useRealtimeStatus();
  const isConnected = status.connected;
  const isConnecting = status.reconnectAttempts > 0 && !status.connected;
  const lastUpdate = null; // Will be implemented
  const error = null; // Will be implemented

  const getStatusColor = () => {
    if (error) return 'error';
    if (isConnecting) return 'warning';
    if (isConnected) return 'success';
    return 'default';
  };

  const getStatusIcon = () => {
    if (error) return <ErrorIcon />;
    if (isConnecting) return <CircularProgress size={16} />;
    if (isConnected) return <ConnectedIcon />;
    return <DisconnectedIcon />;
  };

  const getStatusText = () => {
    if (error) return 'Connection Error';
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Live Sync';
    return 'Offline';
  };

  const getTooltipText = () => {
    if (error) return `Connection error: ${error}`;
    if (isConnecting) return 'Establishing real-time connection...';
    if (isConnected) {
      const lastUpdateText = lastUpdate 
        ? `Last update: ${new Date(lastUpdate).toLocaleTimeString()}`
        : 'Connected';
      return `Real-time sync active. ${lastUpdateText}`;
    }
    return 'Real-time sync is offline. Data may not be up to date.';
  };

  const formatLastUpdate = () => {
    if (!lastUpdate) return 'Never';
    const now = new Date();
    const updateTime = new Date(lastUpdate);
    const diffMs = now.getTime() - updateTime.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return updateTime.toLocaleDateString();
  };

  if (compact) {
    return (
      <Tooltip title={getTooltipText()}>
        <Chip
          icon={getStatusIcon()}
          label={getStatusText()}
          color={getStatusColor()}
          size="small"
          variant={isConnected ? 'filled' : 'outlined'}
          sx={{
            '& .MuiChip-icon': {
              color: 'inherit'
            }
          }}
        />
      </Tooltip>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={getTooltipText()}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {getStatusIcon()}
          <Typography variant="body2" color="textSecondary">
            {getStatusText()}
          </Typography>
        </Box>
      </Tooltip>

      {showDetails && (
        <Fade in={isConnected && !!lastUpdate}>
          <Typography variant="caption" color="textSecondary">
            {formatLastUpdate()}
          </Typography>
        </Fade>
      )}

      {onRefresh && (
        <Tooltip title="Refresh data">
          <IconButton
            size="small"
            onClick={onRefresh}
            disabled={isConnecting}
            sx={{ ml: 1 }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

// Enhanced status indicator with more details
export const DetailedRealtimeStatus: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const status = useRealtimeStatus();
  const isConnected = status.connected;
  const isConnecting = status.reconnectAttempts > 0 && !status.connected;
  const lastUpdate = null; // Will be implemented
  const error = null; // Will be implemented

  return (
    <Box sx={{ 
      p: 2, 
      border: '1px solid', 
      borderColor: isConnected ? 'success.main' : 'error.main',
      borderRadius: 1,
      bgcolor: isConnected ? 'success.light' : 'error.light',
      color: isConnected ? 'success.dark' : 'error.dark'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isConnected ? <SuccessIcon /> : <ErrorIcon />}
          <Typography variant="subtitle2" fontWeight="bold">
            {isConnected ? 'Real-time Sync Active' : 'Sync Disconnected'}
          </Typography>
        </Box>
        
        {onRefresh && (
          <IconButton
            size="small"
            onClick={onRefresh}
            disabled={isConnecting}
            sx={{ color: 'inherit' }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Typography variant="body2" sx={{ mt: 1 }}>
        {error ? (
          `Error: ${error}`
        ) : isConnecting ? (
          'Establishing connection...'
        ) : isConnected ? (
          lastUpdate 
            ? `Last update: ${new Date(lastUpdate).toLocaleString()}`
            : 'Connected and ready'
        ) : (
          'Connection lost. Data may not be up to date.'
        )}
      </Typography>
    </Box>
  );
};
