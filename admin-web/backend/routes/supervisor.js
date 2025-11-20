/**
 * Supervisor Management Routes
 * Extracted from server.js for better organization
 * Includes: Getting managed employees, reassigning supervisors
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const websocketService = require('../services/websocketService');
const { debugLog, debugWarn, debugError } = require('../debug');

// ===== SUPERVISOR REASSIGNMENT API ENDPOINTS =====

// Get all supervised employees for an RM or Admin to manage
router.get('/api/supervisor/:supervisorId/managed-employees', async (req, res) => {
  const db = dbService.getDb();
  const { supervisorId } = req.params;
  
  try {
    // Get all supervised employees (direct + indirect)
    const supervisedEmployeeIds = await dbService.getAllSupervisedEmployees(supervisorId);
    
    if (supervisedEmployeeIds.length === 0) {
      res.json([]);
      return;
    }

    const placeholders = supervisedEmployeeIds.map(() => '?').join(',');
    
    db.all(
      `SELECT id, name, email, position, supervisorId FROM employees WHERE id IN (${placeholders}) ORDER BY position, name`,
      supervisedEmployeeIds,
      (err, employees) => {
        if (err) {
          debugError('❌ Error fetching managed employees:', err);
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(employees);
      }
    );
  } catch (error) {
    debugError('❌ Error fetching managed employees:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reassign supervisor for an employee (RM/Admin only)
router.put('/api/supervisor/reassign', async (req, res) => {
  const db = dbService.getDb();
  const { requestedByUserId, employeeId, newSupervisorId } = req.body;
  
  if (!requestedByUserId || !employeeId || newSupervisorId === undefined) {
    return res.status(400).json({ error: 'requestedByUserId, employeeId, and newSupervisorId are required' });
  }

  const now = new Date().toISOString();

  // Check if requesting user is an RM or Admin
  db.get(
    'SELECT position FROM employees WHERE id = ?',
    [requestedByUserId],
    (err, requester) => {
      if (err) {
        debugError('❌ Error checking requester role:', err);
        res.status(500).json({ error: 'Failed to verify permissions' });
        return;
      }

      if (!requester) {
        return res.status(404).json({ error: 'Requester not found' });
      }

      const isRM = requester.position && requester.position.toLowerCase().includes('regional manager');
      const isAdmin = requester.position && requester.position.toLowerCase().includes('admin');
      
      if (!isRM && !isAdmin) {
        return res.status(403).json({ error: 'Only Regional Managers and Admins can reassign supervisors' });
      }

      // Verify that the employee is supervised by the requester (RM only)
      if (isRM && !isAdmin) {
        dbService.getAllSupervisedEmployees(requestedByUserId)
          .then(supervisedIds => {
            if (!supervisedIds.includes(employeeId)) {
              return res.status(403).json({ error: 'You can only reassign supervisors for employees you supervise' });
            }
            
            // Proceed with reassignment
            performReassignment(employeeId, newSupervisorId, now, res);
          })
          .catch(error => {
            debugError('❌ Error checking supervision:', error);
            res.status(500).json({ error: 'Failed to verify supervision' });
          });
      } else {
        // Admin can reassign anyone
        performReassignment(employeeId, newSupervisorId, now, res);
      }
    }
  );

  function performReassignment(empId, newSupId, timestamp, response) {
    // Check if newSupervisorId is valid (allow null to remove supervisor)
    if (newSupId !== null) {
      db.get(
        'SELECT id FROM employees WHERE id = ?',
        [newSupId],
        (checkErr, supervisor) => {
          if (checkErr) {
            debugError('❌ Error checking new supervisor:', checkErr);
            response.status(500).json({ error: 'Failed to verify new supervisor' });
            return;
          }

          if (!supervisor) {
            return response.status(404).json({ error: 'New supervisor not found' });
          }

          updateSupervisor(empId, newSupId, timestamp, response);
        }
      );
    } else {
      // Removing supervisor
      updateSupervisor(empId, null, timestamp, response);
    }
  }

  function updateSupervisor(empId, newSupId, timestamp, response) {
    db.run(
      'UPDATE employees SET supervisorId = ?, updatedAt = ? WHERE id = ?',
      [newSupId, timestamp, empId],
      function(updateErr) {
        if (updateErr) {
          debugError('❌ Error updating supervisor:', updateErr);
          response.status(500).json({ error: 'Failed to update supervisor' });
          return;
        }

        if (this.changes === 0) {
          return response.status(404).json({ error: 'Employee not found' });
        }

        debugLog(`✅ Supervisor reassigned: ${empId} → ${newSupId || 'none'}`);
        
        // Broadcast the change
        websocketService.handleDataChangeNotification({
          type: 'employee',
          action: 'update',
          data: { id: empId, supervisorId: newSupId },
          timestamp: new Date(),
          employeeId: null
        });
        
        response.json({ 
          success: true, 
          message: 'Supervisor reassigned successfully',
          employeeId: empId,
          newSupervisorId: newSupId
        });
      }
    );
  }
});

module.exports = router;

