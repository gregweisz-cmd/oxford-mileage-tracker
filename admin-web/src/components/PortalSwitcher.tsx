import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  // Avatar, // Currently unused
  Divider,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  AdminPanelSettings,
  SupervisorAccount,
  Person,
  ArrowDropDown,
  Logout,
  AccountBalance,
  // Settings, // Currently unused
} from '@mui/icons-material';
import OxfordHouseLogo from './OxfordHouseLogo';

interface PortalSwitcherProps {
  currentUser: any;
  currentPortal: 'admin' | 'supervisor' | 'staff' | 'finance';
  onPortalChange: (portal: 'admin' | 'supervisor' | 'staff' | 'finance') => void;
  onLogout: () => void;
}

const PortalSwitcher: React.FC<PortalSwitcherProps> = ({
  currentUser,
  currentPortal,
  onPortalChange,
  onLogout,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handlePortalSelect = (portal: 'admin' | 'supervisor' | 'staff' | 'finance') => {
    onPortalChange(portal);
    handleClose();
  };

  // Determine which portals the user has access to based on their role
  const getAvailablePortals = () => {
    const position = currentUser?.position?.toLowerCase() || '';
    const availablePortals: Array<{
      id: 'admin' | 'supervisor' | 'staff' | 'finance';
      name: string;
      icon: React.ReactNode;
      description: string;
    }> = [];

    // Admin/CEO users can access all portals
    if (position.includes('admin') || position.includes('ceo')) {
      availablePortals.push(
        {
          id: 'admin',
          name: 'Admin Portal',
          icon: <AdminPanelSettings />,
          description: 'Manage employees, cost centers, and system settings'
        },
        {
          id: 'finance',
          name: 'Finance Portal',
          icon: <AccountBalance />,
          description: 'Review, export, and print expense reports'
        },
        {
          id: 'supervisor',
          name: 'Supervisor Portal',
          icon: <SupervisorAccount />,
          description: 'Review team reports and approve expenses'
        },
        {
          id: 'staff',
          name: 'Staff Portal',
          icon: <Person />,
          description: 'Manage your own expense reports and mileage'
        }
      );
    }
    // Finance users can access finance and staff portals
    else if (position.includes('finance') || position.includes('accounting')) {
      availablePortals.push(
        {
          id: 'finance',
          name: 'Finance Portal',
          icon: <AccountBalance />,
          description: 'Review, export, and print expense reports'
        },
        {
          id: 'staff',
          name: 'Staff Portal',
          icon: <Person />,
          description: 'Manage your own expense reports and mileage'
        }
      );
    }
    // Supervisor/Director users can access supervisor and staff portals
    else if (position.includes('supervisor') || position.includes('director')) {
      availablePortals.push(
        {
          id: 'supervisor',
          name: 'Supervisor Portal',
          icon: <SupervisorAccount />,
          description: 'Review team reports and approve expenses'
        },
        {
          id: 'staff',
          name: 'Staff Portal',
          icon: <Person />,
          description: 'Manage your own expense reports and mileage'
        }
      );
    }
    // Staff users only see staff portal (no dropdown)
    else {
      return [];
    }

    return availablePortals;
  };

  const availablePortals = getAvailablePortals();
  const currentPortalInfo = availablePortals.find(p => p.id === currentPortal);

  // If user only has access to one portal, don't show the switcher
  if (availablePortals.length <= 1) {
    return (
      <AppBar position="static" sx={{ bgcolor: '#666666' }}>
        <Toolbar>
          <OxfordHouseLogo size={32} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, ml: 2 }}>
            Oxford House Expense Tracker
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={currentUser?.name || 'User'}
              color="secondary"
              variant="outlined"
              sx={{ color: 'white', borderColor: 'white' }}
            />
            <IconButton color="inherit" onClick={onLogout}>
              <Logout />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
    );
  }

  return (
    <AppBar position="static" sx={{ bgcolor: '#666666' }}>
      <Toolbar>
        <OxfordHouseLogo size={32} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, ml: 2 }}>
          Oxford House Mileage Tracker
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Portal Switcher */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
              },
            }}
            onClick={handleClick}
          >
            {currentPortalInfo?.icon}
            <Typography variant="body1" sx={{ ml: 1, color: 'white' }}>
              {currentPortalInfo?.name}
            </Typography>
            <ArrowDropDown sx={{ color: 'white' }} />
          </Box>

          {/* User Info */}
          <Chip
            label={currentUser?.name || 'User'}
            color="secondary"
            variant="outlined"
            sx={{ color: 'white', borderColor: 'white' }}
          />
          
          {/* Logout Button */}
          <IconButton color="inherit" onClick={onLogout}>
            <Logout />
          </IconButton>
        </Box>

        {/* Portal Selection Menu */}
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          PaperProps={{
            sx: {
              minWidth: 300,
              mt: 1,
            },
          }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Switch Portal
            </Typography>
          </Box>
          <Divider />
          
          {availablePortals.map((portal) => (
            <MenuItem
              key={portal.id}
              onClick={() => handlePortalSelect(portal.id)}
              selected={portal.id === currentPortal}
              sx={{
                py: 2,
                px: 2,
              }}
            >
              <ListItemIcon>
                {portal.icon}
              </ListItemIcon>
              <ListItemText
                primary={portal.name}
                secondary={portal.description}
              />
              {portal.id === currentPortal && (
                <Chip
                  label="Current"
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
            </MenuItem>
          ))}
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default PortalSwitcher;
