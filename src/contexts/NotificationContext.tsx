import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert, AlertButton } from 'react-native';
import { AnomalyDetectionService, AnomalyAlert } from '../services/anomalyDetectionService';

interface NotificationContextType {
  alerts: AnomalyAlert[];
  addAlert: (alert: AnomalyAlert) => void;
  dismissAlert: (alertId: string) => void;
  dismissAllAlerts: () => void;
  showAnomalyAlert: (anomalies: any[], context: string) => void;
  getActiveAlerts: (employeeId: string) => AnomalyAlert[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
  currentEmployeeId?: string;
}

export function NotificationProvider({ children, currentEmployeeId }: NotificationProviderProps) {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);

  useEffect(() => {
    if (currentEmployeeId) {
      // Load existing alerts for the employee
      const existingAlerts = AnomalyDetectionService.getActiveAlerts(currentEmployeeId);
      setAlerts(existingAlerts);
    }
  }, [currentEmployeeId]);

  const addAlert = (alert: AnomalyAlert) => {
    setAlerts(prev => [...prev, alert]);
  };

  const dismissAlert = (alertId: string) => {
    AnomalyDetectionService.dismissAlert(alertId);
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const dismissAllAlerts = () => {
    alerts.forEach(alert => {
      AnomalyDetectionService.dismissAlert(alert.id);
    });
    setAlerts([]);
  };

  const getActiveAlerts = (employeeId: string): AnomalyAlert[] => {
    return alerts.filter(alert => 
      alert.id.startsWith(employeeId) && !alert.dismissed
    );
  };

  const showAnomalyAlert = (anomalies: any[], context: string) => {
    if (anomalies.length === 0) return;

    // Group anomalies by severity
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
    const highAnomalies = anomalies.filter(a => a.severity === 'high');
    const mediumAnomalies = anomalies.filter(a => a.severity === 'medium');
    const lowAnomalies = anomalies.filter(a => a.severity === 'low');

    // Show the most severe anomalies first
    const anomaliesToShow = [...criticalAnomalies, ...highAnomalies, ...mediumAnomalies, ...lowAnomalies].slice(0, 3);

    const title = anomaliesToShow.length === 1 
      ? `${anomaliesToShow[0].severity.toUpperCase()}: ${context} Alert`
      : `${anomaliesToShow.length} ${context} Issues Detected`;

    const message = anomaliesToShow
      .map(anomaly => `• ${anomaly.reason}`)
      .join('\n\n');

    const buttons: AlertButton[] = [
      {
        text: 'Dismiss',
        style: 'cancel'
      }
    ];

    // Add action button if there are critical/high severity issues
    if (criticalAnomalies.length > 0 || highAnomalies.length > 0) {
      buttons.unshift({
        text: 'Review',
        style: 'default',
        onPress: () => {
          // Could navigate to a review screen
          console.log('User wants to review anomalies');
        }
      });
    }

    Alert.alert(title, message, buttons);
  };

  const value: NotificationContextType = {
    alerts,
    addAlert,
    dismissAlert,
    dismissAllAlerts,
    showAnomalyAlert,
    getActiveAlerts
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
