import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Menu,
  MenuItem,
  Chip,
  // Avatar, // Currently unused
  Divider,
  ListItemIcon,
  ListItemText,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  AdminPanelSettings,
  SupervisorAccount,
  Person,
  ArrowDropDown,
  Logout,
  AccountBalance,
  Description,
  // Settings, // Currently unused
} from '@mui/icons-material';
import OxfordHouseLogo from './OxfordHouseLogo';
import { getEmployeeDisplayName } from '../utils/employeeUtils';

interface PortalSwitcherProps {
  currentUser: any;
  currentPortal: 'admin' | 'supervisor' | 'staff' | 'finance' | 'contracts';
  onPortalChange: (portal: 'admin' | 'supervisor' | 'staff' | 'finance' | 'contracts') => void;
  onLogout: () => void;
}

const PortalSwitcher: React.FC<PortalSwitcherProps> = ({
  currentUser,
  currentPortal,
  onPortalChange,
  onLogout,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handlePortalSelect = async (portal: 'admin' | 'supervisor' | 'staff' | 'finance' | 'contracts') => {
    onPortalChange(portal);
    handleClose();
    
    // Save as default portal preference
    if (currentUser?.id) {
      try {
        const { apiGet, apiPut } = await import('../services/rateLimitedApi');
        let preferences: any = {};
        
        try {
          preferences = await apiGet(`/api/dashboard-preferences/${currentUser.id}`);
        } catch (error) {
          // If preferences don't exist, start with empty object
          preferences = {};
        }
        
        // Update preferences with default portal
        preferences.defaultPortal = portal;
        
        console.log('💾 Saving default portal preference:', { userId: currentUser.id, portal, preferences });
        
        try {
          await apiPut(`/api/dashboard-preferences/${currentUser.id}`, preferences);
          console.log('✅ Default portal preference saved successfully');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('❌ Failed to save default portal preference:', errorMessage);
          
          // Show user-friendly error for rate limiting
          if (errorMessage.includes('429') || errorMessage.includes('Rate limit')) {
            console.warn('Rate limited - preference will be saved on next attempt');
          }
        }
      } catch (error) {
        console.error('Error saving default portal preference:', error);
      }
    }
  };

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = () => {
    setLogoutDialogOpen(false);
    onLogout();
  };

  const handleLogoutCancel = () => {
    setLogoutDialogOpen(false);
  };

  // Helper function to get personalized Staff Portal name
  const getPersonalizedStaffPortalName = (): string => {
    if (!currentUser) return "User's Portal";
    
    const displayName = getEmployeeDisplayName(currentUser);
    
    // If we have a preferred name or can extract first name, use it
    if (displayName && displayName !== currentUser.name) {
      // Use preferred name directly
      const firstName = displayName.split(' ')[0];
      return `${firstName}'s Portal`;
    }
    
    // Fall back to first name from full name
    if (currentUser.name) {
      const firstName = currentUser.name.split(' ')[0];
      return `${firstName}'s Portal`;
    }
    
    return "User's Portal";
  };

  // Determine which portals the user has access to based on their role
  // IMPORTANT: Role field takes priority over position field
  const getAvailablePortals = () => {
    const role = currentUser?.role?.toLowerCase() || '';
    const position = currentUser?.position?.toLowerCase() || '';
    const personalizedStaffName = getPersonalizedStaffPortalName();
    const availablePortals: Array<{
      id: 'admin' | 'supervisor' | 'staff' | 'finance' | 'contracts';
      name: string;
      icon: React.ReactNode;
      description: string;
    }> = [];

    const hasAdminRole = role.includes('admin') || role.includes('ceo');
    const hasFinanceRole = role.includes('finance') || role.includes('accounting');
    const hasContractsRole = role.includes('contracts');
    const hasSupervisorRole = role.includes('supervisor') || role.includes('director') || role.includes('manager');

    // Admin/CEO users can access all portals
    // Check role first (explicit role assignment takes priority)
    if (hasAdminRole) {
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
          id: 'contracts',
          name: 'Contracts Portal',
          icon: <Description />,
          description: 'Review expense reports for quarterly audit'
        },
        {
          id: 'supervisor',
          name: 'Supervisor Portal',
          icon: <SupervisorAccount />,
          description: 'Review team reports and approve expenses'
        },
        {
          id: 'staff',
          name: personalizedStaffName,
          icon: <Person />,
          description: 'Manage your own expense reports and mileage'
        }
      );
    }
    // Finance users can access finance and staff portals
    // Check role first (explicit role assignment takes priority)
    else if (hasFinanceRole) {
      availablePortals.push(
        {
          id: 'finance',
          name: 'Finance Portal',
          icon: <AccountBalance />,
          description: 'Review, export, and print expense reports'
        },
        {
          id: 'staff',
          name: personalizedStaffName,
          icon: <Person />,
          description: 'Manage your own expense reports and mileage'
        }
      );
    }
    // Contracts users can access contracts and staff portals
    else if (hasContractsRole) {
      availablePortals.push(
        {
          id: 'contracts',
          name: 'Contracts Portal',
          icon: <Description />,
          description: 'Review expense reports for quarterly audit'
        },
        {
          id: 'staff',
          name: personalizedStaffName,
          icon: <Person />,
          description: 'Manage your own expense reports and mileage'
        }
      );
    }
    // Supervisor/Director/Manager users can access supervisor and staff portals
    // Check role first (explicit role assignment takes priority)
    else if (hasSupervisorRole) {
      availablePortals.push(
        {
          id: 'supervisor',
          name: 'Supervisor Portal',
          icon: <SupervisorAccount />,
          description: 'Review team reports and approve expenses'
        },
        {
          id: 'staff',
          name: personalizedStaffName,
          icon: <Person />,
          description: 'Manage your own expense reports and mileage'
        }
      );
    }
    // Fallback: If role is not set or is 'employee', check position
    else if (!role || role === 'employee') {
      // Check position for role detection (fallback)
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
            name: personalizedStaffName,
            icon: <Person />,
            description: 'Manage your own expense reports and mileage'
          }
        );
      } else if (position.includes('finance') || position.includes('accounting')) {
        availablePortals.push(
          {
            id: 'finance',
            name: 'Finance Portal',
            icon: <AccountBalance />,
            description: 'Review, export, and print expense reports'
          },
          {
            id: 'staff',
            name: personalizedStaffName,
            icon: <Person />,
            description: 'Manage your own expense reports and mileage'
          }
        );
      } else if (position.includes('contracts')) {
        availablePortals.push(
          {
            id: 'contracts',
            name: 'Contracts Portal',
            icon: <Description />,
            description: 'Review expense reports for quarterly audit'
          },
          {
            id: 'staff',
            name: personalizedStaffName,
            icon: <Person />,
            description: 'Manage your own expense reports and mileage'
          }
        );
      } else if (position.includes('supervisor') || position.includes('director') || position.includes('regional manager') || position.includes('manager')) {
        availablePortals.push(
          {
            id: 'supervisor',
            name: 'Supervisor Portal',
            icon: <SupervisorAccount />,
            description: 'Review team reports and approve expenses'
          },
          {
            id: 'staff',
            name: personalizedStaffName,
            icon: <Person />,
            description: 'Manage your own expense reports and mileage'
          }
        );
      }
      // If no position match, return empty (staff only, no dropdown)
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
            <Button
              color="inherit"
              onClick={handleLogoutClick}
              startIcon={<Logout />}
              sx={{ color: 'white', textTransform: 'none' }}
            >
              Log out
            </Button>
          </Box>
        </Toolbar>
        <Dialog
          open={logoutDialogOpen}
          onClose={handleLogoutCancel}
          aria-labelledby="logout-dialog-title"
          aria-describedby="logout-dialog-description"
        >
          <DialogTitle id="logout-dialog-title">Log Out</DialogTitle>
          <DialogContent>
            <DialogContentText id="logout-dialog-description">
              Are you sure you want to log out?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleLogoutCancel} color="primary">
              Cancel
            </Button>
            <Button onClick={handleLogoutConfirm} color="primary" variant="contained" autoFocus>
              Log Out
            </Button>
          </DialogActions>
        </Dialog>
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
          <Button
            color="inherit"
            onClick={handleLogoutClick}
            startIcon={<Logout />}
            sx={{ color: 'white', textTransform: 'none' }}
          >
            Log out
          </Button>
        </Box>

        {/* Logout Confirmation Dialog */}
        <Dialog
          open={logoutDialogOpen}
          onClose={handleLogoutCancel}
          aria-labelledby="logout-dialog-title"
          aria-describedby="logout-dialog-description"
        >
          <DialogTitle id="logout-dialog-title">Log Out</DialogTitle>
          <DialogContent>
            <DialogContentText id="logout-dialog-description">
              Are you sure you want to log out?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleLogoutCancel} color="primary">
              Cancel
            </Button>
            <Button onClick={handleLogoutConfirm} color="primary" variant="contained" autoFocus>
              Log Out
            </Button>
          </DialogActions>
        </Dialog>

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
