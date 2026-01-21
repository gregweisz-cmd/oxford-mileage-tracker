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
}

export const EnhancedTabNavigation: React.FC<EnhancedTabNavigationProps> = ({
  value,
  onChange,
  tabs,
  employeeData,
  showStatus = true
}) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Add mouse wheel scrolling functionality
  useEffect(() => {
    const tabsContainer = tabsContainerRef.current;
    if (!tabsContainer) return;

    const handleWheel = (e: WheelEvent) => {
      // Find the actual scrollable element within the tabs
      const scrollableElement = tabsContainer.querySelector('.MuiTabs-scroller') || 
                               tabsContainer.querySelector('.MuiTabs-scrollableX') || 
                               tabsContainer.querySelector('[role="tablist"]') ||
                               tabsContainer.querySelector('.MuiTabs-root') ||
                               tabsContainer;
      
      if (scrollableElement) {
        // Prevent default vertical scrolling
        e.preventDefault();
        e.stopPropagation();
        
        // Scroll horizontally based on wheel delta
        const scrollAmount = e.deltaY;
        scrollableElement.scrollLeft += scrollAmount;
      }
    };

    // Add event listener with capture to catch it early
    tabsContainer.addEventListener('wheel', handleWheel, { passive: false, capture: true });

    return () => {
      tabsContainer.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);
  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'complete': return <CheckIcon fontSize="small" />;
      case 'warning': return <WarningIcon fontSize="small" />;
      case 'error': return <ErrorIcon fontSize="small" />;
      default: return null;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'complete': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getTabIcon = (tabIndex: number) => {
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

  const getTabLabel = (tabIndex: number, originalLabel: string) => {
    // Add cost center numbers to travel tabs
    if (originalLabel.includes('Cost Ctr') && employeeData?.costCenters) {
      const costCenterIndex = tabIndex - 4; // First two tabs are approval and summary, plus Mileage Entries and Daily Descriptions
      if (costCenterIndex >= 0 && costCenterIndex < employeeData.costCenters.length) {
        return `#${costCenterIndex + 1} ${employeeData.costCenters[costCenterIndex]}`;
      }
    }
    return originalLabel;
  };

  const getTabStatus = (tabIndex: number) => {
    if (!showStatus || !employeeData) return undefined;

    // Approval Cover Sheet
    if (tabIndex === 0) {
      return employeeData.employeeSignature ? 'complete' : 'warning';
    }

    // Summary Sheet
    if (tabIndex === 1) {
      const hasData = employeeData.dailyEntries?.length > 0 || 
                     employeeData.totalMileageAmount > 0 ||
                     employeeData.phoneInternetFax > 0;
      return hasData ? 'complete' : 'warning';
    }

    // Mileage Entries Tab
    if (tabIndex === 2) {
      const hasMileage = employeeData.totalMileageAmount > 0;
      return hasMileage ? 'complete' : 'warning';
    }

    // Daily Descriptions Tab
    if (tabIndex === 3) {
      const hasDescriptions = employeeData.dailyEntries?.some((entry: any) => entry.description);
      return hasDescriptions ? 'complete' : 'warning';
    }

    // Cost Center Travel Tabs
    if (tabIndex >= 4 && tabIndex < 4 + (employeeData.costCenters?.length || 0)) {
      const costCenterIndex = tabIndex - 4;
      const costCenter = employeeData.costCenters[costCenterIndex];
      const hasEntries = employeeData.dailyEntries?.some((entry: any) => 
        entry.costCenter === costCenter
      );
      return hasEntries ? 'complete' : 'warning';
    }

    // Timesheet
    if (tabIndex === employeeData.costCenters?.length + 4) {
      const hasTimeData = employeeData.gaHours > 0 || 
                         employeeData.holidayHours > 0 ||
                         employeeData.ptoHours > 0;
      return hasTimeData ? 'complete' : 'warning';
    }

    // Receipt Management
    if (tabIndex === employeeData.costCenters?.length + 5) {
      const hasReceipts = employeeData.receipts?.length > 0;
      return hasReceipts ? 'complete' : 'warning';
    }

    return undefined;
  };

  // Safety check - ensure tabs array is not empty
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
