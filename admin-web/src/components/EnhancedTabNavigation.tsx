import React, { useRef, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Tooltip,
  Badge,
  Fade,
  Typography
} from '@mui/material';
import {
  Description as ApprovalIcon,
  TableChart as SummaryIcon,
  DirectionsCar as TravelIcon,
  Schedule as TimesheetIcon,
  Receipt as ReceiptIcon,
  Edit as DataEntryIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Article as ArticleIcon,
  LocalShipping as MileageIcon,
  Notes as DescriptionIcon
} from '@mui/icons-material';

interface EnhancedTab {
  label: string;
  icon: React.ReactNode;
  badge?: number;
  status?: 'complete' | 'incomplete' | 'error' | 'warning';
  tooltip?: string;
}

interface EnhancedTabNavigationProps {
  value: number;
  onChange: (event: React.SyntheticEvent, newValue: number) => void;
  tabs: EnhancedTab[];
  employeeData?: any;
  showStatus?: boolean;
  rawTimeEntries?: any[];
  currentMonth?: number;
  currentYear?: number;
  daysInMonth?: number;
}

/**
 * Enhanced Tab Navigation Component
 * 
 * Provides a scrollable tab navigation bar with:
 * - Status indicators (complete/warning/error) for each tab
 * - Horizontal scrolling via mouse wheel
 * - Dynamic tab labels based on cost centers
 * - Badge support for notifications
 * 
 * @param value - Currently selected tab index
 * @param onChange - Callback when tab selection changes
 * @param tabs - Array of tab configurations
 * @param employeeData - Employee data for status calculations
 * @param showStatus - Whether to show status indicators
 */
export const EnhancedTabNavigation: React.FC<EnhancedTabNavigationProps> = ({
  value,
  onChange,
  tabs,
  employeeData,
  showStatus = true,
  rawTimeEntries = [],
  currentMonth,
  currentYear,
  daysInMonth
}) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  /**
   * Enables horizontal scrolling via mouse wheel
   * Converts vertical wheel movement to horizontal tab scrolling
   */
  useEffect(() => {
    const tabsContainer = tabsContainerRef.current;
    if (!tabsContainer) return;

    const handleWheel = (e: WheelEvent) => {
      // Find the scrollable element within MUI Tabs component
      const scrollableElement = tabsContainer.querySelector('.MuiTabs-scroller') || 
                               tabsContainer.querySelector('.MuiTabs-scrollableX') || 
                               tabsContainer.querySelector('[role="tablist"]') ||
                               tabsContainer.querySelector('.MuiTabs-root') ||
                               tabsContainer;
      
      if (scrollableElement) {
        // Prevent default vertical scrolling
        e.preventDefault();
        e.stopPropagation();
        
        // Convert vertical wheel delta to horizontal scroll
        const scrollAmount = e.deltaY;
        scrollableElement.scrollLeft += scrollAmount;
      }
    };

    // Add event listener with capture to intercept wheel events early
    tabsContainer.addEventListener('wheel', handleWheel, { passive: false, capture: true });

    return () => {
      tabsContainer.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);

  /**
   * Returns the appropriate status icon based on tab status
   * @param status - Status value ('complete', 'warning', 'error')
   * @returns React component for the status icon or null
   */
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'complete': return <CheckIcon fontSize="small" />;
      case 'warning': return <WarningIcon fontSize="small" />;
      case 'error': return <ErrorIcon fontSize="small" />;
      default: return null;
    }
  };

  /**
   * Returns the appropriate MUI color name based on tab status
   * @param status - Status value ('complete', 'warning', 'error')
   * @returns MUI color name
   */
  const getStatusColor = (status?: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'complete': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  /**
   * Returns the icon for a tab based on its index
   * @param tabIndex - Zero-based index of the tab
   * @returns React component for the tab icon
   */
  const getTabIcon = (tabIndex: number): React.ReactNode => {
    const icons = [
      <ApprovalIcon />,
      <SummaryIcon />,
      <MileageIcon />,
      <DescriptionIcon />,
      <TravelIcon />,
      <TravelIcon />,
      <TravelIcon />,
      <TravelIcon />,
      <TravelIcon />,
      <TimesheetIcon />,
      <ReceiptIcon />,
      <DataEntryIcon />,
      <SettingsIcon />
    ];
    return icons[tabIndex] || <ArticleIcon />;
  };

  /**
   * Formats the tab label, adding cost center numbers for cost center tabs
   * @param tabIndex - Zero-based index of the tab
   * @param originalLabel - Original label from tab configuration
   * @returns Formatted label string
   */
  const getTabLabel = (tabIndex: number, originalLabel: string): string => {
    // Add cost center numbers to travel tabs (tabs 4+ are cost centers)
    if (originalLabel.includes('Cost Ctr') && employeeData?.costCenters) {
      // Tab indices: 0=Approval, 1=Summary, 2=Mileage, 3=Descriptions, 4+=Cost Centers
      const costCenterIndex = tabIndex - 4;
      if (costCenterIndex >= 0 && costCenterIndex < employeeData.costCenters.length) {
        return `#${costCenterIndex + 1} ${employeeData.costCenters[costCenterIndex]}`;
      }
    }
    return originalLabel;
  };

  /**
   * Determines the status of a tab based on employee data completeness
   * @param tabIndex - Zero-based index of the tab
   * @returns Status value ('complete', 'warning', 'error') or undefined
   */
  const getTabStatus = (tabIndex: number): 'complete' | 'warning' | 'error' | undefined => {
    if (!showStatus || !employeeData) return undefined;

    // Approval Cover Sheet - requires both signature AND checkbox
    if (tabIndex === 0) {
      const hasSignature = !!employeeData.employeeSignature;
      const hasAcknowledgment = !!employeeData.employeeCertificationAcknowledged;
      return (hasSignature && hasAcknowledgment) ? 'complete' : 'warning';
    }

    // Summary Sheet - no icon (auto-populated from other sheets)
    if (tabIndex === 1) {
      return undefined;
    }

    // Mileage Entries Tab - no icon (data from app/manual entry)
    if (tabIndex === 2) {
      return undefined;
    }

    // Daily Descriptions Tab - no icon (no way to know if needed)
    if (tabIndex === 3) {
      return undefined;
    }

    // Cost Center Travel Tabs - no icon (no way to know if needed)
    if (tabIndex >= 4 && tabIndex < 4 + (employeeData.costCenters?.length || 0)) {
      return undefined;
    }

    // Timesheet - check if hours entered for all days up to current day
    if (tabIndex === employeeData.costCenters?.length + 4) {
      if (!currentMonth || !currentYear || !daysInMonth || !rawTimeEntries) {
        return undefined;
      }
      
      const currentDate = new Date();
      const isCurrentMonth = currentMonth === currentDate.getMonth() + 1 && currentYear === currentDate.getFullYear();
      const daysToCheck = isCurrentMonth ? currentDate.getDate() : daysInMonth;
      
      // Filter time entries for current month
      const currentMonthTimeEntries = rawTimeEntries.filter((entry: any) => {
        const entryDate = new Date(entry.date);
        const entryMonth = entryDate.getUTCMonth() + 1;
        const entryYear = entryDate.getUTCFullYear();
        return entryMonth === currentMonth && entryYear === currentYear;
      });
      
      // Check if entries exist for each day from 1 to daysToCheck
      const allDaysHaveEntries = Array.from({ length: daysToCheck }, (_, i) => {
        const day = i + 1;
        return currentMonthTimeEntries.some((entry: any) => {
          const entryDate = new Date(entry.date);
          return entryDate.getUTCDate() === day;
        });
      }).every(hasEntry => hasEntry);
      
      return allDaysHaveEntries ? 'complete' : 'warning';
    }

    // Receipt Management - check if images present for all non-Per-Diem receipts
    if (tabIndex === employeeData.costCenters?.length + 5) {
      const receipts = employeeData.receipts || [];
      const nonPerDiemReceipts = receipts.filter((r: any) => r.category !== 'Per Diem');
      
      // If no non-Per-Diem receipts, consider complete
      if (nonPerDiemReceipts.length === 0) {
        return 'complete';
      }
      
      // Check if all non-Per-Diem receipts have images
      const allHaveImages = nonPerDiemReceipts.every((r: any) => 
        r.imageUri && r.imageUri.trim() !== ''
      );
      
      return allHaveImages ? 'complete' : 'warning';
    }

    return undefined;
  };

  // Ensure tabs array is not empty - fallback to default configuration if needed
  const displayTabs = tabs && tabs.length > 0 ? tabs : createTabConfig(employeeData);

  return (
    <Box 
      ref={tabsContainerRef}
      sx={{ 
        bgcolor: 'background.paper',
        width: '100%',
        display: 'block',
        // Remove sticky positioning since tabs are now in the header which is already sticky
      }}
    >
      <Tabs 
        value={value} 
        onChange={onChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          '& .MuiTab-root': {
            minHeight: 48,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.875rem',
            '&.Mui-selected': {
              color: 'primary.main',
              fontWeight: 600
            }
          },
          '& .MuiTabs-indicator': {
            height: 3,
            borderRadius: '3px 3px 0 0'
          },
          // Ensure smooth scrolling
          overflowX: 'auto',
          scrollBehavior: 'smooth'
        }}
      >
        {displayTabs.map((tab, index) => {
          const status = getTabStatus(index);
          const statusIcon = getStatusIcon(status);
          const statusColor = getStatusColor(status);
          const tabLabel = getTabLabel(index, tab.label);

          return (
            <Tab
              key={index}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {tab.icon || getTabIcon(index)}
                  <Typography variant="body2">
                    {tabLabel}
                  </Typography>
                  
                  {/* Status Indicator */}
                  {statusIcon && (
                    <Fade in={!!statusIcon}>
                      <Box sx={{ color: `${statusColor}.main` }}>
                        {statusIcon}
                      </Box>
                    </Fade>
                  )}

                  {/* Badge */}
                  {tab.badge && tab.badge > 0 && (
                    <Badge 
                      badgeContent={tab.badge} 
                      color="error" 
                      sx={{ '& .MuiBadge-badge': { fontSize: '0.75rem' } }}
                    >
                      <Box />
                    </Badge>
                  )}
                </Box>
              }
              iconPosition="start"
              {...(tab.tooltip && {
                component: Tooltip,
                title: tab.tooltip,
                placement: 'top'
              })}
            />
          );
        })}
      </Tabs>
    </Box>
  );
};

// Helper function to create tab configuration
export const createTabConfig = (employeeData: any): EnhancedTab[] => {
  const tabs: EnhancedTab[] = [
    {
      label: 'Approval Cover Sheet',
      icon: <ApprovalIcon />,
      tooltip: 'Employee and supervisor signatures'
    },
    {
      label: 'Summary Sheet',
      icon: <SummaryIcon />,
      tooltip: 'Monthly expense summary'
    },
    {
      label: 'Mileage Entries',
      icon: <MileageIcon />,
      tooltip: 'Enter and manage mileage data'
    },
    {
      label: 'Daily Descriptions',
      icon: <DescriptionIcon />,
      tooltip: 'Enter daily activity descriptions'
    }
  ];

  // Add cost center travel tabs
  if (employeeData?.costCenters) {
    employeeData.costCenters.forEach((center: string, index: number) => {
      tabs.push({
        label: `Cost Ctr #${index + 1} Travel`,
        icon: <TravelIcon />,
        tooltip: `Travel expenses for ${center}`
      });
    });
  }

  // Add remaining tabs
  tabs.push(
    {
      label: 'Timesheet',
      icon: <TimesheetIcon />,
      tooltip: 'Hours worked and time tracking'
    },
    {
      label: 'Receipt Management',
      icon: <ReceiptIcon />,
      tooltip: 'Receipt uploads and management'
    },
    {
      label: 'Data Entry',
      icon: <DataEntryIcon />,
      tooltip: 'Create and edit entries directly'
    },
    {
      label: 'Settings',
      icon: <SettingsIcon />,
      tooltip: 'User preferences and settings'
    }
  );

  return tabs;
};
