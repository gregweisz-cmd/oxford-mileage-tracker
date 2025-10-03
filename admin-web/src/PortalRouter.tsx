// Portal Router - Switch between Supervisor and Staff interfaces
import React, { useState } from 'react';
import { 
  Typography, 
  AppBar,
  Toolbar,
  Switch,
  FormControlLabel,
} from '@mui/material';

import StaffPortal from './StaffPortal';
import SupervisorEmployeeReport from './AdminEmployeeReport';

const PortalRouter: React.FC = () => {
  const [isSupervisorMode, setIsSupervisorMode] = useState(false);
  
  // Get current month and year
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
  const currentYear = currentDate.getFullYear();

  return (
    <>
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Oxford House Expense System
          </Typography>
          <FormControlLabel
            control={
              <Switch 
                checked={isSupervisorMode} 
                onChange={(e) => setIsSupervisorMode(e.target.checked)}
                color="primary"
              />
            }
            label="Supervisor Mode"
          />
        </Toolbar>
      </AppBar>

      {isSupervisorMode ? (
        <SupervisorEmployeeReport />
      ) : (
        <StaffPortal 
          employeeId="mg71acdmrlh5uvfa50a"
          reportMonth={currentMonth}
          reportYear={currentYear}
        />
      )}
    </>
  );
};

export default PortalRouter;

