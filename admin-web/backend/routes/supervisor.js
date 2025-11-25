/**
 * Supervisor Management Routes
 * Extracted from server.js for better organization
 * Includes: Getting managed employees, reassigning supervisors
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const websocketService = require('../services/websocketService');
const helpers = require('../utils/helpers');
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

// ===== SUPERVISOR KPIs ENDPOINT =====

/**
 * Get supervisor KPIs (Key Performance Indicators)
 * Returns statistics about team members, pending reports, approvals, and performance metrics
 */
router.get('/api/supervisors/:id/kpis', async (req, res) => {
  const db = dbService.getDb();
  const { id: supervisorId } = req.params;
  
  try {
    // Get all supervised employees (direct + indirect)
    const supervisedEmployeeIds = await dbService.getAllSupervisedEmployees(supervisorId);
    
    // Get team member stats
    const teamMembers = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, isActive FROM employees WHERE id IN (${supervisedEmployeeIds.map(() => '?').join(',')})`,
        supervisedEmployeeIds,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const totalTeamMembers = teamMembers.length;
    const activeTeamMembers = teamMembers.filter(emp => emp.isActive !== 0).length;
    const archivedTeamMembers = totalTeamMembers - activeTeamMembers;

    // Get report stats - pending and needs revision
    const reportStats = await new Promise((resolve, reject) => {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      db.all(
        `SELECT 
          COUNT(CASE WHEN er.status IN ('submitted', 'pending_supervisor') THEN 1 END) as pending,
          COUNT(CASE WHEN er.status = 'needs_revision' THEN 1 END) as needsRevision,
          COUNT(CASE WHEN er.status = 'approved' AND er.approvedBy = ? THEN 1 END) as approvedTotal
        FROM expense_reports er
        LEFT JOIN employees e ON er.employeeId = e.id
        WHERE e.id IN (${supervisedEmployeeIds.map(() => '?').join(',')})
          AND er.status IN ('submitted', 'pending_supervisor', 'needs_revision', 'approved')`,
        [supervisorId, ...supervisedEmployeeIds],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0] || { pending: 0, needsRevision: 0, approvedTotal: 0 });
        }
      );
    });

    // Get approval stats for this month and last month
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const approvals = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          er.month,
          er.year,
          COUNT(*) as count,
          COALESCE(SUM(er.totalExpenses), 0) as totalExpenses
        FROM expense_reports er
        LEFT JOIN employees e ON er.employeeId = e.id
        WHERE e.id IN (${supervisedEmployeeIds.map(() => '?').join(',')})
          AND er.status = 'approved'
          AND er.approvedBy = ?
          AND ((er.month = ? AND er.year = ?) OR (er.month = ? AND er.year = ?))
        GROUP BY er.month, er.year`,
        [...supervisedEmployeeIds, supervisorId, currentMonth, currentYear, lastMonth, lastMonthYear],
        (err, rows) => {
          if (err) reject(err);
          else {
            const thisMonthData = rows.find(r => r.month === currentMonth && r.year === currentYear) || { count: 0, totalExpenses: 0 };
            const lastMonthData = rows.find(r => r.month === lastMonth && r.year === lastMonthYear) || { count: 0, totalExpenses: 0 };
            resolve({
              thisMonth: { count: thisMonthData.count || 0, totalExpenses: thisMonthData.totalExpenses || 0 },
              lastMonth: { count: lastMonthData.count || 0, totalExpenses: lastMonthData.totalExpenses || 0 }
            });
          }
        }
      );
    });

    // Get performance metrics (approval times, approval rate)
    const performance = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          er.submittedAt,
          er.approvedAt,
          er.status
        FROM expense_reports er
        LEFT JOIN employees e ON er.employeeId = e.id
        WHERE e.id IN (${supervisedEmployeeIds.map(() => '?').join(',')})
          AND er.approvedBy = ?
          AND er.submittedAt IS NOT NULL
        ORDER BY er.approvedAt DESC
        LIMIT 100`,
        [...supervisedEmployeeIds, supervisorId],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          if (!rows || rows.length === 0) {
            resolve({
              avgApprovalTimeHours: null,
              fastestApprovalHours: null,
              approvalRate: null,
              totalReviewed: 0
            });
            return;
          }

          const approvedRows = rows.filter(r => r.status === 'approved' && r.approvedAt && r.submittedAt);
          const totalReviewed = rows.length;
          const totalApproved = approvedRows.length;

          if (approvedRows.length === 0) {
            resolve({
              avgApprovalTimeHours: null,
              fastestApprovalHours: null,
              approvalRate: totalReviewed > 0 ? 0 : null,
              totalReviewed
            });
            return;
          }

          // Calculate approval times
          const approvalTimes = approvedRows.map(row => {
            const submitted = new Date(row.submittedAt);
            const approved = new Date(row.approvedAt);
            return (approved - submitted) / (1000 * 60 * 60); // Convert to hours
          });

          const avgApprovalTimeHours = approvalTimes.reduce((sum, time) => sum + time, 0) / approvalTimes.length;
          const fastestApprovalHours = Math.min(...approvalTimes);
          const approvalRate = totalReviewed > 0 ? totalApproved / totalReviewed : null;

          resolve({
            avgApprovalTimeHours,
            fastestApprovalHours,
            approvalRate,
            totalReviewed
          });
        }
      );
    });

    // Get expense trend for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const expenseTrend = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          er.month,
          er.year,
          COUNT(CASE WHEN er.status = 'approved' THEN 1 END) as approved,
          COUNT(CASE WHEN er.status IN ('submitted', 'pending_supervisor') THEN 1 END) as submitted,
          COALESCE(SUM(CASE WHEN er.status = 'approved' THEN er.totalExpenses ELSE 0 END), 0) as totalExpenses
        FROM expense_reports er
        LEFT JOIN employees e ON er.employeeId = e.id
        WHERE e.id IN (${supervisedEmployeeIds.map(() => '?').join(',')})
          AND (er.year > ? OR (er.year = ? AND er.month >= ?))
          AND er.status IN ('submitted', 'pending_supervisor', 'approved')
        GROUP BY er.year, er.month
        ORDER BY er.year ASC, er.month ASC`,
        [...supervisedEmployeeIds, sixMonthsAgo.getFullYear(), sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + 1],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          const trend = (rows || []).map(row => {
            const date = new Date(row.year, row.month - 1);
            return {
              month: `${row.year}-${String(row.month).padStart(2, '0')}`,
              label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
              submitted: row.submitted || 0,
              approved: row.approved || 0,
              totalExpenses: row.totalExpenses || 0
            };
          });

          resolve(trend);
        }
      );
    });

    // Return KPI data matching the frontend interface
    res.json({
      teamMembers: {
        total: totalTeamMembers,
        active: activeTeamMembers,
        archived: archivedTeamMembers
      },
      reportStats: {
        pending: reportStats.pending || 0,
        needsRevision: reportStats.needsRevision || 0,
        approvedTotal: reportStats.approvedTotal || 0
      },
      approvals: {
        thisMonth: approvals.thisMonth,
        lastMonth: approvals.lastMonth
      },
      performance: {
        avgApprovalTimeHours: performance.avgApprovalTimeHours,
        fastestApprovalHours: performance.fastestApprovalHours,
        approvalRate: performance.approvalRate,
        totalReviewed: performance.totalReviewed
      },
      expenseTrend: expenseTrend
    });

  } catch (error) {
    debugError('❌ Error fetching supervisor KPIs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch supervisor KPIs' });
  }
});

// ===== SUPERVISOR PENDING REPORTS ENDPOINT =====

/**
 * Get pending monthly reports for a supervisor
 * Returns reports from the supervisor's team that need their review
 */
router.get('/api/monthly-reports/supervisor/:id/pending', async (req, res) => {
  const db = dbService.getDb();
  const { id: supervisorId } = req.params;
  
  try {
    // Get all supervised employees (direct + indirect)
    const supervisedEmployeeIds = await dbService.getAllSupervisedEmployees(supervisorId);
    
    if (supervisedEmployeeIds.length === 0) {
      res.json([]);
      return;
    }

    // Get pending reports for supervised employees
    db.all(
      `SELECT 
        er.id,
        er.employeeId,
        COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName,
        e.name as employeeFullName,
        e.email as employeeEmail,
        er.month,
        er.year,
        er.status,
        er.submittedAt,
        er.totalExpenses,
        er.reportData,
        er.approvalWorkflow
      FROM expense_reports er
      LEFT JOIN employees e ON er.employeeId = e.id
      WHERE e.id IN (${supervisedEmployeeIds.map(() => '?').join(',')})
        AND er.status IN ('submitted', 'pending_supervisor')
        AND er.currentApproverId = ?
      ORDER BY er.submittedAt DESC, er.year DESC, er.month DESC`,
      [...supervisedEmployeeIds, supervisorId],
      (err, rows) => {
        if (err) {
          debugError('❌ Error fetching pending reports:', err);
          res.status(500).json({ error: err.message });
          return;
        }

        // Parse report data and calculate totals
        const reports = (rows || []).map(row => {
          try {
            row.reportData = JSON.parse(row.reportData || '{}');
            row.approvalWorkflow = helpers.parseJsonSafe(row.approvalWorkflow, []);
          } catch (parseErr) {
            debugError('Error parsing report data:', parseErr);
            row.reportData = {};
            row.approvalWorkflow = [];
          }

          // Calculate totals from report data
          const reportData = row.reportData || {};
          row.totalMiles = reportData.totalMiles || 0;
          row.totalMileageAmount = reportData.totalMileageAmount || 0;
          row.totalHours = reportData.totalHours || 0;
          
          // Ensure totalExpenses is calculated
          if (!row.totalExpenses && reportData.dailyEntries) {
            row.totalExpenses = 0;
            reportData.dailyEntries.forEach(entry => {
              if (entry.receipts) {
                entry.receipts.forEach(receipt => {
                  row.totalExpenses += parseFloat(receipt.amount || 0);
                });
              }
            });
          }

          return row;
        });

        res.json(reports);
      }
    );
  } catch (error) {
    debugError('❌ Error fetching pending reports:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch pending reports' });
  }
});

module.exports = router;

