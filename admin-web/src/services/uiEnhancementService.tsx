import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Box, Fade, Slide, Typography, Paper, Chip } from '@mui/material';
import { CheckCircle, Warning, Error, Info } from '@mui/icons-material';

// UI Enhancement Context
interface UIEnhancementContextType {
  // Loading states
  isLoading: boolean;
  loadingMessage: string;
  loadingProgress?: number;
  startLoading: (message?: string) => void;
  setProgress: (progress: number) => void;
  stopLoading: () => void;

  // Animation states
  enableAnimations: boolean;
  setAnimations: (enabled: boolean) => void;

  // Theme states
  isDarkMode: boolean;
  toggleDarkMode: () => void;

  // Layout states
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Notification states
  notifications: NotificationItem[];
  addNotification: (notification: Omit<NotificationItem, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

interface NotificationItem {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  persistent?: boolean;
}

const UIEnhancementContext = createContext<UIEnhancementContextType | undefined>(undefined);

// UI Enhancement Provider
export const UIEnhancementProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [loadingProgress, setLoadingProgress] = useState<number | undefined>(undefined);
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const startLoading = useCallback((message = 'Loading...') => {
    setLoadingMessage(message);
    setLoadingProgress(undefined);
    setIsLoading(true);
  }, []);

  const setProgress = useCallback((progress: number) => {
    setLoadingProgress(progress);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingProgress(undefined);
  }, []);

  const setAnimations = useCallback((enabled: boolean) => {
    setEnableAnimations(enabled);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const addNotification = useCallback((notification: Omit<NotificationItem, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: NotificationItem = {
      ...notification,
      id,
      timestamp: new Date(),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);

    // Auto-remove non-persistent notifications after 5 seconds
    if (!notification.persistent) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 5000);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <UIEnhancementContext.Provider value={{
      isLoading,
      loadingMessage,
      loadingProgress,
      startLoading,
      setProgress,
      stopLoading,
      enableAnimations,
      setAnimations,
      isDarkMode,
      toggleDarkMode,
      sidebarOpen,
      toggleSidebar,
      setSidebarOpen,
      notifications,
      addNotification,
      removeNotification,
      clearNotifications
    }}>
      {children}
    </UIEnhancementContext.Provider>
  );
};

// Hook to use UI enhancements
export const useUIEnhancement = (): UIEnhancementContextType => {
  const context = useContext(UIEnhancementContext);
  if (!context) {
    const error = new (Error as any)('useUIEnhancement must be used within a UIEnhancementProvider');
    throw error;
  }
  return context;
};

// Enhanced Animation Components
interface AnimatedBoxProps {
  children: ReactNode;
  animation?: 'fade' | 'slide' | 'scale';
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
}

export const AnimatedBox: React.FC<AnimatedBoxProps> = ({
  children,
  animation = 'fade',
  direction = 'up',
  delay = 0,
  duration = 300
}) => {
  const { enableAnimations } = useUIEnhancement();
  const [visible, setVisible] = useState(!enableAnimations);

  React.useEffect(() => {
    if (enableAnimations) {
      const timer = setTimeout(() => setVisible(true), delay);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [enableAnimations, delay]);

  if (!enableAnimations) {
    return <>{children}</>;
  }

  const animationProps = {
    in: visible,
    timeout: duration,
    ...(animation === 'slide' && {
      direction: direction as any
    })
  };

  switch (animation) {
    case 'fade':
      return <Fade {...animationProps}><div>{children}</div></Fade>;
    case 'slide':
      return <Slide {...animationProps}><div>{children}</div></Slide>;
    case 'scale':
      return (
        <Fade {...animationProps}>
          <Box sx={{ transform: visible ? 'scale(1)' : 'scale(0.8)', transition: `transform ${duration}ms ease-in-out` }}>
            {children}
          </Box>
        </Fade>
      );
    default:
      return <>{children}</>;
  }
};

// Status Indicator Component
interface StatusIndicatorProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'loading';
  message: string;
  showIcon?: boolean;
  variant?: 'chip' | 'badge' | 'inline';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  message,
  showIcon = true,
  variant = 'chip'
}) => {
  const getIcon = () => {
    switch (status) {
      case 'success': return <CheckCircle fontSize="small" />;
      case 'warning': return <Warning fontSize="small" />;
      case 'error': return <Error fontSize="small" />;
      case 'info': return <Info fontSize="small" />;
      case 'loading': return <Box sx={{ width: 16, height: 16, border: '2px solid', borderColor: 'primary.main', borderRadius: '50%', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />;
      default: return null;
    }
  };

  const getColor = () => {
    switch (status) {
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      case 'info': return 'info';
      case 'loading': return 'primary';
      default: return 'default';
    }
  };

  if (variant === 'chip') {
    const icon = showIcon ? getIcon() : undefined;
    return (
      <Chip
        icon={icon || undefined}
        label={message}
        color={getColor() as any}
        size="small"
        variant="outlined"
      />
    );
  }

  if (variant === 'badge') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {showIcon && getIcon()}
        <Typography variant="body2" color={`${getColor()}.main`}>
          {message}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {showIcon && getIcon()}
      <Typography variant="caption" color={`${getColor()}.main`}>
        {message}
      </Typography>
    </Box>
  );
};

// Enhanced Card Component
interface EnhancedCardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  status?: 'success' | 'warning' | 'error' | 'info' | 'loading';
  statusMessage?: string;
  actions?: ReactNode;
  loading?: boolean;
  elevation?: number;
  animation?: 'fade' | 'slide' | 'scale';
  delay?: number;
}

export const EnhancedCard: React.FC<EnhancedCardProps> = ({
  children,
  title,
  subtitle,
  status,
  statusMessage,
  actions,
  loading = false,
  elevation = 1,
  animation = 'fade',
  delay = 0
}) => {
  return (
    <AnimatedBox animation={animation} delay={delay}>
      <Paper
        elevation={elevation}
        sx={{
          p: 3,
          borderRadius: 2,
          border: status ? `1px solid` : undefined,
          borderColor: status ? `${status}.main` : undefined,
          bgcolor: status ? `${status}.light` : undefined,
          opacity: loading ? 0.7 : 1,
          transition: 'all 0.3s ease-in-out'
        }}
      >
        {(title || subtitle || status || actions) && (
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              {title && (
                <Typography variant="h6" gutterBottom>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {subtitle}
                </Typography>
              )}
              {status && statusMessage && (
                <StatusIndicator status={status} message={statusMessage} variant="inline" />
              )}
            </Box>
            {actions && (
              <Box>
                {actions}
              </Box>
            )}
          </Box>
        )}
        {children}
      </Paper>
    </AnimatedBox>
  );
};

// CSS for animations
const animationStyles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideInUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  @keyframes slideInDown {
    from { transform: translateY(-20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  @keyframes slideInLeft {
    from { transform: translateX(-20px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideInRight {
    from { transform: translateX(20px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes scaleIn {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
`;

// Inject animation styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = animationStyles;
  document.head.appendChild(styleSheet);
}
