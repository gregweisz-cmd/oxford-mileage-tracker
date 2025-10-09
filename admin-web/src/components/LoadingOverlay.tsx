import React from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Backdrop,
  Fade,
  LinearProgress
} from '@mui/material';

interface LoadingOverlayProps {
  open: boolean;
  message?: string;
  progress?: number; // 0-100
  variant?: 'backdrop' | 'inline' | 'linear';
  size?: number;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  open,
  message = 'Loading...',
  progress,
  variant = 'backdrop',
  size = 40,
  color = 'primary'
}) => {
  if (!open) return null;

  const renderSpinner = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <CircularProgress size={size} color={color} />
      <Typography variant="body2" color="textSecondary">
        {message}
      </Typography>
      {progress !== undefined && (
        <Typography variant="caption" color="textSecondary">
          {Math.round(progress)}%
        </Typography>
      )}
    </Box>
  );

  const renderLinear = () => (
    <Box sx={{ width: '100%', p: 2 }}>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
        {message}
      </Typography>
      <LinearProgress 
        variant={progress !== undefined ? 'determinate' : 'indeterminate'}
        value={progress}
        color={color}
        sx={{ height: 6, borderRadius: 3 }}
      />
      {progress !== undefined && (
        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
          {Math.round(progress)}%
        </Typography>
      )}
    </Box>
  );

  switch (variant) {
    case 'backdrop':
      return (
        <Backdrop
          open={open}
          sx={{
            color: '#fff',
            zIndex: (theme) => theme.zIndex.drawer + 1,
            bgcolor: 'rgba(0, 0, 0, 0.5)'
          }}
        >
          <Fade in={open}>
            {renderSpinner()}
          </Fade>
        </Backdrop>
      );

    case 'linear':
      return (
        <Fade in={open}>
          {renderLinear()}
        </Fade>
      );

    case 'inline':
    default:
      return (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          p: 4,
          minHeight: 200
        }}>
          <Fade in={open}>
            {renderSpinner()}
          </Fade>
        </Box>
      );
  }
};

// Specialized loading components for common use cases
export const PageLoadingOverlay: React.FC<{ message?: string }> = ({ message }) => (
  <LoadingOverlay open={true} message={message} variant="backdrop" />
);

export const InlineLoading: React.FC<{ message?: string; size?: number }> = ({ message, size }) => (
  <LoadingOverlay open={true} message={message} variant="inline" size={size} />
);

export const LinearLoading: React.FC<{ message?: string; progress?: number }> = ({ message, progress }) => (
  <LoadingOverlay open={true} message={message} variant="linear" progress={progress} />
);

// Loading state hook for easy integration
export const useLoadingState = (initialState = false) => {
  const [isLoading, setIsLoading] = React.useState(initialState);
  const [loadingMessage, setLoadingMessage] = React.useState('Loading...');
  const [loadingProgress, setLoadingProgress] = React.useState<number | undefined>(undefined);

  const startLoading = (message?: string) => {
    setLoadingMessage(message || 'Loading...');
    setLoadingProgress(undefined);
    setIsLoading(true);
  };

  const setProgress = (progress: number) => {
    setLoadingProgress(progress);
  };

  const stopLoading = () => {
    setIsLoading(false);
    setLoadingProgress(undefined);
  };

  return {
    isLoading,
    loadingMessage,
    loadingProgress,
    startLoading,
    setProgress,
    stopLoading
  };
};
