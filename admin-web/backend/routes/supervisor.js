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

/**
 * Calculate total expenses from report data
 */
function calculateTotalExpensesFromReportData(reportData) {
  if (!reportData || typeof reportData !== 'object') return 0;
  
  // Handle string JSON
  if (typeof reportData === 'string') {
    try {
      reportData = JSON.parse(reportData);
    } catch (e) {
      return 0;
    }
  }
  
  const {
    totalMileageAmount = 0,
    airRailBus = 0,
    vehicleRentalFuel = 0,
    parkingTolls = 0,
    groundTransportation = 0,
    hotelsAirbnb = 0,
    perDiem = 0,
    phoneInternetFax = 0,
    shippingPostage = 0,
    printingCopying = 0,
    officeSupplies = 0,
    eesReceipt = 0,
    meals = 0,
    other = 0,
  } = reportData;

  return (totalMileageAmount || 0) + (airRailBus || 0) + (vehicleRentalFuel || 0) + (parkingTolls || 0) +
         (groundTransportation || 0) + (hotelsAirbnb || 0) + (perDiem || 0) + (phoneInternetFax || 0) +
         (shippingPostage || 0) + (printingCopying || 0) + (officeSupplies || 0) + (eesReceipt || 0) + (meals || 0) + (other || 0);
}

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
    let supervisedEmployeeIds = [];
    try {
      supervisedEmployeeIds = await dbService.getAllSupervisedEmployees(supervisorId);
      if (!Array.isArray(supervisedEmployeeIds)) {
        supervisedEmployeeIds = [];
      }
    } catch (superviseError) {
      debugError('❌ Error getting supervised employees for KPIs:', superviseError);
      supervisedEmployeeIds = [];
    }
    
    // Handle empty team case
    if (supervisedEmployeeIds.length === 0) {
      return res.json({
        teamMembers: {
          total: 0,
          active: 0,
          archived: 0
        },
        reportStats: {
          pending: 0,
          needsRevision: 0,
          approvedTotal: 0
        },
        approvals: {
          thisMonth: { count: 0, totalExpenses: 0 },
          lastMonth: { count: 0, totalExpenses: 0 }
        },
        performance: {
          avgApprovalTimeHours: null,
          fastestApprovalHours: null,
          approvalRate: null,
          totalReviewed: 0
        },
        expenseTrend: []
      });
    }
    
    // Get team member stats
    const teamMembers = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, archived FROM employees WHERE id IN (${supervisedEmployeeIds.map(() => '?').join(',')})`,
        supervisedEmployeeIds,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const totalTeamMembers = teamMembers.length;
    const activeTeamMembers = teamMembers.filter(emp => !emp.archived || emp.archived === 0).length;
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
          er.reportData
        FROM expense_reports er
        LEFT JOIN employees e ON er.employeeId = e.id
        WHERE e.id IN (${supervisedEmployeeIds.map(() => '?').join(',')})
          AND er.status = 'approved'
          AND er.approvedBy = ?
          AND ((er.month = ? AND er.year = ?) OR (er.month = ? AND er.year = ?))`,
        [...supervisedEmployeeIds, supervisorId, currentMonth, currentYear, lastMonth, lastMonthYear],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Calculate totals from reportData
          let thisMonthCount = 0;
          let thisMonthTotal = 0;
          let lastMonthCount = 0;
          let lastMonthTotal = 0;
          
          (rows || []).forEach(row => {
            const isThisMonth = row.month === currentMonth && row.year === currentYear;
            const isLastMonth = row.month === lastMonth && row.year === lastMonthYear;
            
            let reportData = {};
            try {
              reportData = JSON.parse(row.reportData || '{}');
            } catch (e) {
              reportData = {};
            }
            
            const totalExpenses = calculateTotalExpensesFromReportData(reportData);
            
            if (isThisMonth) {
              thisMonthCount++;
              thisMonthTotal += totalExpenses;
            } else if (isLastMonth) {
              lastMonthCount++;
              lastMonthTotal += totalExpenses;
            }
          });
          
          resolve({
            thisMonth: { count: thisMonthCount, totalExpenses: thisMonthTotal },
            lastMonth: { count: lastMonthCount, totalExpenses: lastMonthTotal }
          });
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
          er.status,
          er.reportData
        FROM expense_reports er
        LEFT JOIN employees e ON er.employeeId = e.id
        WHERE e.id IN (${supervisedEmployeeIds.map(() => '?').join(',')})
          AND (er.year > ? OR (er.year = ? AND er.month >= ?))
          AND er.status IN ('submitted', 'pending_supervisor', 'approved')
        ORDER BY er.year ASC, er.month ASC`,
        [...supervisedEmployeeIds, sixMonthsAgo.getFullYear(), sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + 1],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          // Group by month/year and calculate totals
          const trendMap = new Map();
          
          (rows || []).forEach(row => {
            const monthKey = `${row.year}-${String(row.month).padStart(2, '0')}`;
            
            if (!trendMap.has(monthKey)) {
              const date = new Date(row.year, row.month - 1);
              trendMap.set(monthKey, {
                month: monthKey,
                label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                submitted: 0,
                approved: 0,
                totalExpenses: 0
              });
            }
            
            const trendEntry = trendMap.get(monthKey);
            
            if (row.status === 'approved') {
              trendEntry.approved++;
            } else if (row.status === 'submitted' || row.status === 'pending_supervisor') {
              trendEntry.submitted++;
            }
            
            if (row.status === 'approved') {
              let reportData = {};
              try {
                reportData = JSON.parse(row.reportData || '{}');
              } catch (e) {
                reportData = {};
              }
              trendEntry.totalExpenses += calculateTotalExpensesFromReportData(reportData);
            }
          });

          const trend = Array.from(trendMap.values());
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
    debugError('❌ Error stack:', error.stack);
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
    let supervisedEmployeeIds = [];
    try {
      supervisedEmployeeIds = await dbService.getAllSupervisedEmployees(supervisorId);
      if (!Array.isArray(supervisedEmployeeIds)) {
        supervisedEmployeeIds = [];
      }
    } catch (superviseError) {
      debugError('❌ Error getting supervised employees:', superviseError);
      supervisedEmployeeIds = [];
    }
    
    debugLog(`🔍 Supervisor ${supervisorId} has ${supervisedEmployeeIds.length} supervised employees`);
    
    if (supervisedEmployeeIds.length === 0) {
      res.json([]);
      return;
    }

    // Get pending reports for supervised employees
    // Simplified query - check status and approver, handle NULL columns safely
    // Note: totalExpenses is calculated from reportData, not stored as a column
    const query = `SELECT 
        er.id,
        er.employeeId,
        COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName,
        e.name as employeeFullName,
        e.email as employeeEmail,
        e.supervisorId as employeeSupervisorId,
        er.month,
        er.year,
        er.status,
        er.submittedAt,
        er.reportData,
        er.approvalWorkflow,
        er.currentApprovalStage,
        er.currentApproverId
      FROM expense_reports er
      LEFT JOIN employees e ON er.employeeId = e.id
      WHERE e.id IN (${supervisedEmployeeIds.map(() => '?').join(',')})
        AND (
          er.status IN ('submitted', 'pending_supervisor', 'needs_revision')
        )
      ORDER BY er.submittedAt DESC, er.year DESC, er.month DESC`;
    
    debugLog(`🔍 Executing query for supervisor ${supervisorId} with ${supervisedEmployeeIds.length} employees`);
    
    db.all(
      query,
      supervisedEmployeeIds,
      (err, rows) => {
        if (err) {
          debugError('❌ Error fetching pending reports:', err);
          debugError('❌ Query:', query);
          debugError('❌ Parameters:', [...supervisedEmployeeIds, supervisorId, supervisorId]);
          res.status(500).json({ error: err.message || 'Failed to fetch pending reports' });
          return;
        }

        // Filter reports to only those assigned to this supervisor
        // Also handle reports that need revision
        debugLog(`🔍 Filtering ${rows.length} reports for supervisor ${supervisorId}`);
        
        const filteredRows = (rows || []).filter(row => {
          const status = row.status || '';
          const currentApproverId = row.currentApproverId || '';
          const currentApprovalStage = row.currentApprovalStage || '';
          const employeeSupervisorId = row.employeeSupervisorId || '';
          
          debugLog(`  📋 Report ${row.id}: status=${status}, approver=${currentApproverId}, stage=${currentApprovalStage}, employee=${row.employeeId}, empSupervisor=${employeeSupervisorId}`);
          
          // Include if status is pending and assigned to this supervisor
          if ((status === 'submitted' || status === 'pending_supervisor')) {
            // Check if directly assigned to this supervisor
            if (currentApproverId === supervisorId) {
              debugLog(`  ✅ Including report ${row.id} - pending supervisor approval (assigned)`);
              return true;
            }
            // Fallback: if no currentApproverId but employee's supervisor matches, include it
            if ((!currentApproverId || currentApproverId === '') && employeeSupervisorId === supervisorId) {
              debugLog(`  ✅ Including report ${row.id} - pending supervisor approval (employee's supervisor matches)`);
              return true;
            }
            if (!currentApproverId || currentApproverId === '') {
              debugLog(`  ⚠️  Report ${row.id} has ${status} status but no currentApproverId and employee supervisor doesn't match`);
            }
          }
          
          // Include if needs revision and is in supervisor stage
          if (status === 'needs_revision' && 
              (currentApprovalStage === 'pending_supervisor' || currentApprovalStage.toLowerCase().includes('supervisor'))) {
            if (currentApproverId === supervisorId || employeeSupervisorId === supervisorId) {
              debugLog(`  ✅ Including report ${row.id} - needs revision from supervisor`);
              return true;
            }
          }
          
          return false;
        });
        
        debugLog(`🔍 Filtered to ${filteredRows.length} reports for supervisor ${supervisorId}`);
        
        // Parse report data and calculate totals
        const reports = filteredRows.map(row => {
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
          
          // Calculate totalExpenses from reportData
          row.totalExpenses = calculateTotalExpensesFromReportData(reportData);

          return row;
        });

        res.json(reports);
      }
    );
  } catch (error) {
    debugError('❌ Error fetching pending reports:', error);
    debugError('❌ Error stack:', error.stack);
    res.status(500).json({ error: error.message || 'Failed to fetch pending reports' });
  }
});

module.exports = router;

