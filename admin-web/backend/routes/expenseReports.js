/**
 * Expense Reports Routes
 * Extracted from server.js for better organization
 * Includes: CRUD operations, sync-to-source, approval workflow, history
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const websocketService = require('../services/websocketService');
const notificationService = require('../services/notificationService');
const helpers = require('../utils/helpers');
const dateHelpers = require('../utils/dateHelpers');
const constants = require('../utils/constants');
const { debugLog, debugWarn, debugError } = require('../debug');

/**
 * Initialize approval workflow for a report
 */
async function initializeApprovalWorkflow(report) {
  const workflow = [];
  const now = new Date();
  let currentApprovalStage = '';
  let currentApprovalStep = 0;
  let currentApproverId = null;
  let currentApproverName = null;
  let escalationDueAt = null;

  const employee = await dbService.getEmployeeById(report.employeeId);
  let supervisor = null;
  if (employee && employee.supervisorId) {
    supervisor = await dbService.getEmployeeById(employee.supervisorId);
  }

  if (supervisor) {
    const supervisorName = supervisor.preferredName || supervisor.name || 'Supervisor';
    const supervisorStep = {
      step: workflow.length,
      role: 'supervisor',
      approverId: supervisor.id,
      approverName: supervisorName,
      status: 'pending',
      delegatedToId: null,
      delegatedToName: null,
      dueAt: helpers.computeEscalationDueAt(constants.SUPERVISOR_ESCALATION_HOURS),
      actedAt: null,
      comments: '',
      reminders: []
    };
    workflow.push(supervisorStep);
    currentApprovalStage = 'supervisor';
    currentApproverId = supervisor.id;
    currentApproverName = supervisorName;
    escalationDueAt = supervisorStep.dueAt;
  }

  const financeApprovers = await dbService.getFinanceApprovers();
  let financeApproverId = null;
  let financeApproverName = 'Finance Team';

  if (financeApprovers.length === 1) {
    financeApproverId = financeApprovers[0].id;
    financeApproverName = financeApprovers[0].preferredName || financeApprovers[0].name || financeApproverName;
  }

  const financeStep = {
    step: workflow.length,
    role: 'finance',
    approverId: financeApproverId,
    approverName: financeApproverName,
    status: workflow.length === 0 ? 'pending' : 'waiting',
    delegatedToId: null,
    delegatedToName: null,
    dueAt: workflow.length === 0 ? helpers.computeEscalationDueAt(constants.FINANCE_ESCALATION_HOURS) : null,
    actedAt: null,
    comments: '',
    reminders: []
  };

  workflow.push(financeStep);

  if (workflow.length === 1) {
    // No supervisor step; finance is first approver
    currentApprovalStage = 'finance';
    currentApproverId = financeApproverId;
    currentApproverName = financeApproverName;
    escalationDueAt = financeStep.dueAt;
  }

  return {
    workflow,
    currentApprovalStage,
    currentApprovalStep,
    currentApproverId,
    currentApproverName,
    escalationDueAt
  };
}

/**
 * Calculate total expenses from report data
 */
function calculateTotalExpensesFromReportData(reportData) {
  if (!reportData) return 0;
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

  return totalMileageAmount + airRailBus + vehicleRentalFuel + parkingTolls +
         groundTransportation + hotelsAirbnb + perDiem + phoneInternetFax +
         shippingPostage + printingCopying + officeSupplies + eesReceipt + meals + other;
}

// ===== EXPENSE REPORTS ROUTES =====

/**
 * Create or update expense report
 */
router.post('/api/expense-reports', async (req, res) => {
  const { employeeId, month, year, reportData, status } = req.body;
  const db = dbService.getDb();
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();

  try {
    // Check if report already exists for this employee/month/year
    const existingReport = await new Promise((resolve, reject) => {
      db.get('SELECT id, status FROM expense_reports WHERE employeeId = ? AND month = ? AND year = ?', 
        [employeeId, month, year], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingReport) {
      // Update existing report
      let updateData = {
        reportData: JSON.stringify(reportData),
        status: status || 'draft',
        updatedAt: now
      };

      // If submitting, initialize approval workflow
      if (status === 'submitted') {
        const report = { id: existingReport.id, employeeId, month, year };
        debugLog(`📝 Submitting report ${existingReport.id} for employee ${employeeId} via POST`);
        const workflowInit = await initializeApprovalWorkflow(report);
        debugLog(`📝 Workflow initialized: stage=${workflowInit.currentApprovalStage}, approver=${workflowInit.currentApproverId}`);
        
        updateData.status = workflowInit.currentApprovalStage === 'finance' ? 'pending_finance' : 'pending_supervisor';
        updateData.submittedAt = now;
        updateData.approvalWorkflow = JSON.stringify(workflowInit.workflow);
        updateData.currentApprovalStep = workflowInit.currentApprovalStep;
        updateData.currentApprovalStage = workflowInit.currentApprovalStage;
        updateData.currentApproverId = workflowInit.currentApproverId;
        updateData.currentApproverName = workflowInit.currentApproverName;
        updateData.escalationDueAt = workflowInit.escalationDueAt;
        
        // Notify supervisor if applicable
        if (workflowInit.currentApprovalStage === 'supervisor' && workflowInit.currentApproverId) {
          const employee = await dbService.getEmployeeById(employeeId);
          if (employee) {
            notificationService.notifyReportSubmitted(existingReport.id, employeeId, employee.preferredName || employee.name).catch(err => {
              debugError('❌ Error sending notification:', err);
            });
          }
        }
      } else if (status === 'approved') {
        updateData.approvedAt = now;
        updateData.approvedBy = req.body.approvedBy || 'system';
      }

      const updateFields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
      const updateValues = Object.values(updateData);

      db.run(
        `UPDATE expense_reports SET ${updateFields} WHERE employeeId = ? AND month = ? AND year = ?`,
        [...updateValues, employeeId, month, year],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ id: existingReport.id, message: 'Expense report updated successfully' });
        }
      );
    } else {
      // Create new report
      let insertData = {
        id,
        employeeId,
        month,
        year,
        reportData: JSON.stringify(reportData),
        status: status || 'draft',
        createdAt: now,
        updatedAt: now
      };

      // If submitting, initialize approval workflow
      if (status === 'submitted') {
        const report = { id, employeeId, month, year };
        debugLog(`📝 Creating and submitting report ${id} for employee ${employeeId} via POST`);
        const workflowInit = await initializeApprovalWorkflow(report);
        debugLog(`📝 Workflow initialized: stage=${workflowInit.currentApprovalStage}, approver=${workflowInit.currentApproverId}`);
        
        insertData.status = workflowInit.currentApprovalStage === 'finance' ? 'pending_finance' : 'pending_supervisor';
        insertData.submittedAt = now;
        insertData.approvalWorkflow = JSON.stringify(workflowInit.workflow);
        insertData.currentApprovalStep = workflowInit.currentApprovalStep;
        insertData.currentApprovalStage = workflowInit.currentApprovalStage;
        insertData.currentApproverId = workflowInit.currentApproverId;
        insertData.currentApproverName = workflowInit.currentApproverName;
        insertData.escalationDueAt = workflowInit.escalationDueAt;
        
        // Notify supervisor if applicable
        if (workflowInit.currentApprovalStage === 'supervisor' && workflowInit.currentApproverId) {
          const employee = await dbService.getEmployeeById(employeeId);
          if (employee) {
            notificationService.notifyReportSubmitted(id, employeeId, employee.preferredName || employee.name).catch(err => {
              debugError('❌ Error sending notification:', err);
            });
          }
        }
      } else if (status === 'approved') {
        insertData.approvedAt = now;
        insertData.approvedBy = req.body.approvedBy || 'system';
      }

      const insertFields = Object.keys(insertData).join(', ');
      const insertValues = Object.values(insertData);
      const placeholders = insertValues.map(() => '?').join(', ');

      db.run(
        `INSERT INTO expense_reports (${insertFields}) VALUES (${placeholders})`,
        insertValues,
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ id, message: 'Expense report created successfully' });
        }
      );
    }
  } catch (error) {
    debugError('❌ Error in POST /api/expense-reports:', error);
    res.status(500).json({ error: error.message || 'Failed to create/update expense report' });
  }
});

/**
 * Get expense report by employee, month, and year
 */
// Alias endpoint for monthly-reports
// Supports both:
// 1. With query params (employeeId, month, year) - returns single report
// 2. Without query params - returns all reports (for supervisor dashboard)
router.get('/api/monthly-reports', (req, res) => {
  const { employeeId, month, year, status, approverId, stage, teamSupervisorId } = req.query;
  const db = dbService.getDb();
  
  debugLog(`🔍 GET /api/monthly-reports - Query params:`, { employeeId, month, year, status, approverId, stage, teamSupervisorId });
  
  // If query params are provided, return a single report
  if (employeeId && month && year && !teamSupervisorId) {
    db.get(
      'SELECT * FROM expense_reports WHERE employeeId = ? AND month = ? AND year = ?',
      [employeeId, month, year],
      (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (!row) {
          // Return null instead of 404 error - report doesn't exist yet (draft state)
          res.json(null);
          return;
        }
        
        // Parse the report data JSON
        try {
          row.reportData = JSON.parse(row.reportData || '{}');
          row.approvalWorkflow = helpers.parseJsonSafe(row.approvalWorkflow, []);
          res.json(row);
        } catch (parseErr) {
          res.status(500).json({ error: 'Invalid report data format' });
        }
      }
    );
    return;
  }
  
  // Otherwise, return filtered reports (similar to /api/expense-reports)
  let query = `
    SELECT er.*, 
     COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName, 
     e.name as employeeFullName, 
     e.email as employeeEmail, 
     e.supervisorId
     FROM expense_reports er
     LEFT JOIN employees e ON er.employeeId = e.id
  `;
  const params = [];
  const conditions = [];

  if (status) {
    const statusValues = status.toString().split(',').map(s => s.trim()).filter(Boolean);
    if (statusValues.length === 1) {
      conditions.push('er.status = ?');
      params.push(statusValues[0]);
    } else if (statusValues.length > 1) {
      const placeholders = statusValues.map(() => '?').join(',');
      conditions.push(`er.status IN (${placeholders})`);
      params.push(...statusValues);
    }
  }

  if (approverId) {
    conditions.push('er.currentApproverId = ?');
    params.push(approverId);
  }

  if (stage) {
    conditions.push('er.currentApprovalStage = ?');
    params.push(stage);
  }

  if (teamSupervisorId) {
    if (teamSupervisorId === 'unassigned') {
      conditions.push('(e.supervisorId IS NULL OR e.supervisorId = "")');
    } else {
      conditions.push('e.supervisorId = ?');
      params.push(teamSupervisorId);
    }
  }

  if (employeeId) {
    conditions.push('er.employeeId = ?');
    params.push(employeeId);
  }

  if (month && year) {
    conditions.push('er.month = ? AND er.year = ?');
    params.push(parseInt(month, 10), parseInt(year, 10));
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY er.year DESC, er.month DESC, e.name';

  debugLog(`🔍 GET /api/monthly-reports - Query: ${query.substring(0, 200)}...`);
  debugLog(`🔍 GET /api/monthly-reports - Params:`, params);

  db.all(
    query,
    params,
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      debugLog(`✅ GET /api/monthly-reports - Found ${rows ? rows.length : 0} raw reports`);
      
      // Parse the report data JSON for each row
      const reports = (rows || []).map(row => {
        try {
          row.reportData = JSON.parse(row.reportData || '{}');
          row.approvalWorkflow = helpers.parseJsonSafe(row.approvalWorkflow, []);
          
          // Calculate totalExpenses from reportData
          row.totalExpenses = calculateTotalExpensesFromReportData(row.reportData);
          row.totalMiles = row.reportData?.totalMiles || 0;
          row.totalMileageAmount = row.reportData?.totalMileageAmount || 0;
          
          // Add compatibility fields for supervisor dashboard
          row.reviewedBy = row.approvedBy; // For backward compatibility
          
        } catch (parseErr) {
          debugError('Error parsing report data for row:', row.id);
          row.reportData = {};
          row.approvalWorkflow = [];
          row.totalExpenses = 0;
        }
        
        return row;
      });
      
      debugLog(`✅ GET /api/monthly-reports - Returning ${reports.length} parsed reports`);
      res.json(reports);
    }
  );
});

router.get('/api/expense-reports/:employeeId/:month/:year', (req, res) => {
  const { employeeId, month, year } = req.params;
  const db = dbService.getDb();
  
  db.get(
    'SELECT * FROM expense_reports WHERE employeeId = ? AND month = ? AND year = ?',
    [employeeId, month, year],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!row) {
        // Return null instead of 404 - report doesn't exist yet (expected for draft reports)
        res.json(null);
        return;
      }
      
      // Parse the report data JSON
      try {
        row.reportData = JSON.parse(row.reportData || '{}');
        row.approvalWorkflow = helpers.parseJsonSafe(row.approvalWorkflow, []);
        res.json(row);
      } catch (parseErr) {
        res.status(500).json({ error: 'Invalid report data format' });
      }
    }
  );
});

/**
 * Comprehensive save endpoint that syncs web portal changes back to source tables
 */
router.post('/api/expense-reports/sync-to-source', async (req, res) => {
  // Always log so Render shows the request (debugLog is off in production)
  console.log('[sync-to-source] Request received', {
    hasBody: !!req.body,
    employeeId: req.body?.employeeId,
    month: req.body?.month,
    year: req.body?.year,
    hasReportData: !!req.body?.reportData,
    dailyEntriesCount: req.body?.reportData?.dailyEntries?.length ?? 0
  });

  const { employeeId, month, year, reportData } = req.body;
  const db = dbService.getDb();

  // Validate required fields
  if (!employeeId) {
    return res.status(400).json({ error: 'employeeId is required' });
  }
  if (!reportData) {
    return res.status(400).json({ error: 'reportData is required' });
  }

  debugLog('🔄 Syncing report data back to source tables for employee:', employeeId);
  
  try {
    // 1. Update employee profile (signature, personal info)
    if (reportData.employeeSignature || reportData.supervisorSignature) {
      await new Promise((resolve, reject) => {
        const updates = [];
        const values = [];
        
        if (reportData.employeeSignature) {
          updates.push('signature = ?');
          values.push(reportData.employeeSignature);
        }
        
        values.push(employeeId);
        
        const sql = `UPDATE employees SET ${updates.join(', ')}, updatedAt = datetime('now') WHERE id = ?`;
        
        db.run(sql, values, (err) => {
          if (err) reject(err);
          else {
            debugLog('✅ Employee signature updated');
            resolve();
          }
        });
      });
    }
    
    // 2a. Sync daily descriptions - SIMPLE LOGIC: Whatever is in the UI is what gets saved
    // Step 1: Delete ALL descriptions for this month (we'll recreate only what's in the array)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM daily_descriptions WHERE employeeId = ? AND date >= ? AND date <= ?',
        [employeeId, startDate, endDate],
        function(deleteErr) {
          if (deleteErr) {
            debugError(`❌ Error deleting daily descriptions for month:`, deleteErr);
            reject(deleteErr);
          } else {
            debugLog(`🗑️ Deleted ${this.changes} existing daily descriptions for month ${month}/${year}`);
            resolve();
          }
        }
      );
    });
    
    // Step 2: Save ONLY what's in the dailyDescriptions array (exactly what user sees in UI)
    if (reportData.dailyDescriptions && reportData.dailyDescriptions.length > 0) {
      // Deduplicate by date (keep the last one if duplicates exist)
      const seenDates = new Map();
      for (const desc of reportData.dailyDescriptions) {
        const dateStr = dateHelpers.normalizeDateString(desc.date);
        if (!dateStr) {
          debugWarn(`⚠️ Skipping daily description with invalid date: ${desc.date}`);
          continue;
        }
        // Use date as key to deduplicate
        seenDates.set(dateStr, desc);
      }
      
      debugLog(`💾 Saving ${seenDates.size} daily descriptions from UI (exactly what user sees)`);
      
      // Save each description from the array - save exactly what's in the UI
      for (const desc of seenDates.values()) {
        try {
          const dateStr = dateHelpers.normalizeDateString(desc.date);
          if (!dateStr) {
            debugWarn(`⚠️ Skipping daily description with invalid date: ${desc.date}`);
            continue;
          }
          
          const hasDescription = desc.description && desc.description.trim();
          const isDayOff = desc.dayOff || false;
          
          // Only save if it has content OR is a day off (empty descriptions are already deleted in step 1)
          if (hasDescription || isDayOff) {
            const id = desc.id || `desc-${employeeId}-${dateStr}`;
            const now = new Date().toISOString();
            const stayedOvernightValue = desc.stayedOvernight ? 1 : 0;
            const dayOffValue = isDayOff ? 1 : 0;
            
            await new Promise((resolve, reject) => {
              db.run(
                'INSERT INTO daily_descriptions (id, employeeId, date, description, costCenter, stayedOvernight, dayOff, dayOffType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, employeeId, dateStr, desc.description || '', desc.costCenter || '', stayedOvernightValue, dayOffValue, desc.dayOffType || null, now, now],
                function(insertErr) {
                  if (insertErr) {
                    debugError(`❌ Error saving daily description for date ${dateStr}:`, insertErr);
                    reject(insertErr);
                  } else {
                    debugLog(`✅ Saved daily description for date ${dateStr} (exactly as shown in UI)`);
                    resolve();
                  }
                }
              );
            });
          }
          // If empty and not day off, don't save (already deleted in step 1)
        } catch (descError) {
          debugError(`❌ Error saving daily description for date ${desc.date}:`, descError);
          // Continue with next entry instead of failing entire sync
        }
      }
    } else {
      debugLog(`ℹ️ No daily descriptions in array - all descriptions for month ${month}/${year} deleted (empty array = delete all)`);
    }
    
    // 2b. Sync time tracking hours - SIMPLE LOGIC: Whatever is in the UI is what gets saved
    // Step 1: Delete ALL time tracking entries for this month (we'll recreate only what's in dailyEntries)
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM time_tracking WHERE employeeId = ? AND date >= ? AND date <= ?',
        [employeeId, startDate, endDate],
        function(deleteErr) {
          if (deleteErr) {
            debugError(`❌ Error deleting time tracking for month:`, deleteErr);
            reject(deleteErr);
          } else {
            debugLog(`🗑️ Deleted ${this.changes} existing time tracking entries for month ${month}/${year}`);
            resolve();
          }
        }
      );
    });
    
    // Step 2: Save ONLY what's in dailyEntries (exactly what user sees in UI)
    if (reportData.dailyEntries && reportData.dailyEntries.length > 0) {
      const costCenters = reportData.costCenters || [];
      
      for (const entry of reportData.dailyEntries) {
        try {
          const dateStr = dateHelpers.normalizeDateString(entry.date);
          if (!dateStr) {
            debugWarn(`⚠️ Skipping daily entry with invalid date: ${entry.date}`);
            continue;
          }
          
          // Save cost center hours (exactly as shown in UI)
          for (let i = 0; i < costCenters.length; i++) {
            const costCenterName = costCenters[i];
            const hoursProperty = `costCenter${i}Hours`;
            const hours = entry[hoursProperty] || 0;
            
            // Only save if hours > 0 (empty = already deleted in step 1)
            if (hours > 0) {
              const id = `time-${employeeId}-${dateStr}-costcenter-${i}`;
              const now = new Date().toISOString();
              
              await new Promise((resolve, reject) => {
                db.run(
                  'INSERT INTO time_tracking (id, employeeId, date, category, hours, description, costCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [id, employeeId, dateStr, '', hours, '', costCenterName, now, now],
                  (insertErr) => {
                    if (insertErr) {
                      debugError(`❌ Error saving time tracking for ${costCenterName} on ${dateStr}:`, insertErr);
                      reject(insertErr);
                    } else {
                      debugLog(`✅ Saved ${hours} hours for ${costCenterName} on ${dateStr} (exactly as shown in UI)`);
                      resolve();
                    }
                  }
                );
              });
            }
          }
          
          // Save category hours (PTO, Holiday, etc.) - exactly as shown in UI
          if (entry.categoryHours && typeof entry.categoryHours === 'object') {
            for (const category of Object.keys(entry.categoryHours)) {
              const hours = entry.categoryHours[category] || 0;
              
              // Only save if hours > 0 (empty = already deleted in step 1)
              if (hours > 0) {
                const id = `time-${employeeId}-${dateStr}-category-${category}`;
                const now = new Date().toISOString();
                
                await new Promise((resolve, reject) => {
                  db.run(
                    'INSERT INTO time_tracking (id, employeeId, date, category, hours, description, costCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [id, employeeId, dateStr, category, hours, '', '', now, now],
                    (insertErr) => {
                      if (insertErr) {
                        debugError(`❌ Error saving time tracking for ${category} on ${dateStr}:`, insertErr);
                        reject(insertErr);
                      } else {
                        debugLog(`✅ Saved ${hours} hours for ${category} on ${dateStr} (exactly as shown in UI)`);
                        resolve();
                      }
                    }
                  );
                });
              }
            }
          }
        } catch (entryError) {
          debugError(`❌ Error syncing daily entry for date ${entry.date}:`, entryError);
          // Continue with next entry instead of failing entire sync
        }
      }
    } else {
      debugLog(`ℹ️ No daily entries in array - all hours for month ${month}/${year} deleted (empty array = delete all)`);
    }
    
    // NOTE: Mileage entries are NOT synced from dailyEntries
    // Mobile app is the source of truth for mileage entries
    // The web portal should only display mileage, not create/update it
    // This prevents deleted mileage entries from being restored when Save is clicked
    
    // 3. Sync receipts - backend matches what the user sent (same as daily descriptions / time tracking)
    // Per Diem receipts are owned only by the Per Diem tab; header Save must not delete or upsert them.
    // Otherwise unchecking a day in Per Diem then clicking header Save would re-insert the receipt (from stale parent state).
    const allReceipts = reportData.receipts || [];
    const nonPerDiemReceipts = allReceipts.filter((r) => (r.category || '') !== 'Per Diem');
    const receiptIdsToKeep = nonPerDiemReceipts.map((r) => r.id).filter(Boolean);
    await new Promise((resolve, reject) => {
      if (receiptIdsToKeep.length === 0) {
        db.run(
          "DELETE FROM receipts WHERE employeeId = ? AND date >= ? AND date <= ? AND (category IS NULL OR category != 'Per Diem')",
          [employeeId, startDate, endDate],
          function (deleteErr) {
            if (deleteErr) {
              debugError('❌ Error deleting receipts for month:', deleteErr);
              reject(deleteErr);
            } else {
              debugLog(`🗑️ Deleted ${this.changes} non-Per-Diem receipts for month ${month}/${year}`);
              resolve();
            }
          }
        );
      } else {
        const placeholders = receiptIdsToKeep.map(() => '?').join(',');
        db.run(
          `DELETE FROM receipts WHERE employeeId = ? AND date >= ? AND date <= ? AND (category IS NULL OR category != 'Per Diem') AND id NOT IN (${placeholders})`,
          [employeeId, startDate, endDate, ...receiptIdsToKeep],
          function (deleteErr) {
            if (deleteErr) {
              debugError('❌ Error deleting removed receipts:', deleteErr);
              reject(deleteErr);
            } else {
              if (this.changes > 0) {
                debugLog(`🗑️ Deleted ${this.changes} receipt(s) removed by user in UI`);
              }
              resolve();
            }
          }
        );
      }
    });

    // Step 2: Upsert only non-Per-Diem receipts (Per Diem is managed only by the Per Diem tab)
    if (nonPerDiemReceipts.length > 0) {
      for (const receipt of nonPerDiemReceipts) {
        if (!receipt.id) continue;
        const dateStr = dateHelpers.normalizeDateString(receipt.date) || receipt.date;
        const now = new Date().toISOString();
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO receipts (id, employeeId, date, amount, vendor, description, category, imageUri, fileType, costCenter, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'image', ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               employeeId = ?, date = ?, amount = ?, vendor = ?, description = ?, category = ?, updatedAt = ?`,
            [
              receipt.id,
              employeeId,
              dateStr || startDate,
              receipt.amount ?? 0,
              receipt.vendor || '',
              receipt.description || '',
              receipt.category || '',
              receipt.imageUri || '',
              receipt.costCenter || '',
              now,
              now,
              employeeId,
              dateStr || startDate,
              receipt.amount ?? 0,
              receipt.vendor || '',
              receipt.description || '',
              receipt.category || '',
              now
            ],
            (err) => {
              if (err) {
                debugError(`❌ Error upserting receipt ${receipt.id}:`, err);
                reject(err);
              } else {
                debugLog(`✅ Upserted receipt ${receipt.id}`);
                resolve();
              }
            }
          );
        });
      }
    }
    
    // 4. Also save to expense_reports table for persistence
    await new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      
      db.get('SELECT id FROM expense_reports WHERE employeeId = ? AND month = ? AND year = ?', 
        [employeeId, month, year], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          // Update existing report
          db.run(
            `UPDATE expense_reports SET reportData = ?, updatedAt = ? WHERE employeeId = ? AND month = ? AND year = ?`,
            [JSON.stringify(reportData), now, employeeId, month, year],
            (updateErr) => {
              if (updateErr) reject(updateErr);
              else {
                debugLog('✅ Updated expense report in expense_reports table');
                resolve();
              }
            }
          );
        } else {
          // Create new report
          const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
          db.run(
            `INSERT INTO expense_reports (id, employeeId, month, year, reportData, status, createdAt, updatedAt) 
             VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
            [id, employeeId, month, year, JSON.stringify(reportData), now, now],
            (insertErr) => {
              if (insertErr) reject(insertErr);
              else {
                debugLog('✅ Created new expense report in expense_reports table');
                resolve();
              }
            }
          );
        }
      });
    });
    
    // Broadcast data change notification via WebSocket
    websocketService.broadcastToClients({
      type: 'data_updated',
      entity: 'expense_report',
      employeeId: employeeId,
      month: month,
      year: year,
      timestamp: new Date().toISOString()
    });
    
    console.log('[sync-to-source] Success');
    res.json({
      success: true,
      message: 'Report data synced successfully to source tables'
    });

  } catch (error) {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack;

    // Always log to stdout so Render shows it
    console.error('[sync-to-source] ERROR:', errorMessage);
    console.error('[sync-to-source] Stack:', errorStack);

    debugError('❌ Error syncing report data:', errorMessage);
    debugError('❌ Error stack:', errorStack);
    debugError('❌ Report data structure:', {
      hasDailyEntries: !!reportData?.dailyEntries,
      dailyEntriesLength: reportData?.dailyEntries?.length,
      hasDailyDescriptions: !!reportData?.dailyDescriptions,
      dailyDescriptionsLength: reportData?.dailyDescriptions?.length,
      hasCostCenters: !!reportData?.costCenters,
      costCentersLength: reportData?.costCenters?.length,
      employeeId,
      month,
      year,
      reportDataKeys: reportData ? Object.keys(reportData) : []
    });
    
    // Always include error details in development
    res.status(500).json({ 
      error: errorMessage,
      message: 'Failed to sync report data to source tables',
      details: errorStack,
      dataStructure: {
        hasDailyEntries: !!reportData?.dailyEntries,
        dailyEntriesLength: reportData?.dailyEntries?.length,
        hasDailyDescriptions: !!reportData?.dailyDescriptions,
        employeeId,
        month,
        year
      }
    });
  }
});

/**
 * Update summary sheet amounts for an expense report
 */
router.put('/api/expense-reports/:employeeId/:month/:year/summary', async (req, res) => {
  const { employeeId, month, year } = req.params;
  const { reportData } = req.body;
  const db = dbService.getDb();
  const now = new Date().toISOString();

  if (!reportData) {
    return res.status(400).json({ error: 'reportData is required' });
  }

  debugLog(`📝 Updating summary sheet for employee ${employeeId}, ${month}/${year}`);

  try {
    // Check if report exists
    const existingReport = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, reportData FROM expense_reports WHERE employeeId = ? AND month = ? AND year = ?',
        [employeeId, month, year],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    // If report doesn't exist, create it
    if (!existingReport) {
      debugLog(`📝 Creating new expense report for employee ${employeeId}, ${month}/${year}`);
      const reportId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      
      // Create a proper report data structure with the summary data
      const newReportData = {
        employeeId: employeeId,
        month: parseInt(month),
        year: parseInt(year),
        ...reportData, // Include the summary fields from reportData
        receipts: [],
        dailyEntries: [],
        dailyDescriptions: []
      };
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO expense_reports (id, employeeId, month, year, reportData, status, createdAt, updatedAt) 
           VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
          [reportId, employeeId, month, year, JSON.stringify(newReportData), now, now],
          (err) => {
            if (err) {
              debugError('❌ Error creating new expense report:', err);
              reject(err);
            } else {
              debugLog(`✅ Created new expense report ${reportId}`);
              resolve();
            }
          }
        );
      });
      
      return res.json({ id: reportId, message: 'Expense report created and summary updated' });
    }

    // Parse existing report data
    let existingReportData = {};
    try {
      existingReportData = JSON.parse(existingReport.reportData || '{}');
    } catch (parseErr) {
      debugError('Error parsing existing report data:', parseErr);
      existingReportData = {};
    }

    // Merge new summary data with existing report data
    const updatedReportData = {
      ...existingReportData,
      ...reportData,
      // Preserve other fields that shouldn't be overwritten
      receipts: existingReportData.receipts,
      signatureImage: existingReportData.signatureImage,
      supervisorSignature: existingReportData.supervisorSignature,
      dailyEntries: existingReportData.dailyEntries,
    };

    // Update the report
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE expense_reports SET reportData = ?, updatedAt = ? WHERE employeeId = ? AND month = ? AND year = ?',
        [JSON.stringify(updatedReportData), now, employeeId, month, year],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    debugLog(`✅ Summary sheet updated successfully for employee ${employeeId}, ${month}/${year}`);
    res.json({ 
      success: true,
      message: 'Summary sheet updated successfully'
    });
  } catch (error) {
    debugError('❌ Error updating summary sheet:', error);
    res.status(500).json({ error: error.message || 'Failed to update summary sheet' });
  }
});

/**
 * Get all expense reports for an employee
 */
router.get('/api/expense-reports/:employeeId', (req, res) => {
  const { employeeId } = req.params;
  const db = dbService.getDb();
  
  db.all(
    'SELECT * FROM expense_reports WHERE employeeId = ? ORDER BY year DESC, month DESC',
    [employeeId],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Parse the report data JSON for each row
      rows.forEach(row => {
        try {
          row.reportData = JSON.parse(row.reportData);
        } catch (parseErr) {
          debugError('Error parsing report data for row:', row.id);
          row.reportData = {};
        }
      });
      
      res.json(rows);
    }
  );
});

/**
 * Get all expense reports (for admin/supervisor view)
 */
router.get('/api/expense-reports', (req, res) => {
  const { status, month, year, approverId, stage, teamSupervisorId, employeeId } = req.query;
  const db = dbService.getDb();
  
  let query = `
    SELECT er.*, COALESCE(NULLIF(e.preferredName, ''), e.name) as employeeName, e.name as employeeFullName, e.email as employeeEmail, e.supervisorId
    FROM expense_reports er
    LEFT JOIN employees e ON er.employeeId = e.id
  `;
  const params = [];
  const conditions = [];

  if (status) {
    const statusValues = status.toString().split(',').map(s => s.trim()).filter(Boolean);
    if (statusValues.length === 1) {
      conditions.push('er.status = ?');
      params.push(statusValues[0]);
    } else if (statusValues.length > 1) {
      const placeholders = statusValues.map(() => '?').join(',');
      conditions.push(`er.status IN (${placeholders})`);
      params.push(...statusValues);
    }
  }

  if (approverId) {
    conditions.push('er.currentApproverId = ?');
    params.push(approverId);
  }

  if (stage) {
    conditions.push('er.currentApprovalStage = ?');
    params.push(stage);
  }

  if (teamSupervisorId) {
    if (teamSupervisorId === 'unassigned') {
      conditions.push('(e.supervisorId IS NULL OR e.supervisorId = "")');
    } else {
      conditions.push('e.supervisorId = ?');
      params.push(teamSupervisorId);
    }
  }

  if (employeeId) {
    conditions.push('er.employeeId = ?');
    params.push(employeeId);
  }

  if (month && year) {
    conditions.push('er.month = ? AND er.year = ?');
    params.push(parseInt(month, 10), parseInt(year, 10));
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY er.year DESC, er.month DESC, e.name';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Parse the report data JSON for each row
    rows.forEach(row => {
      try {
        row.reportData = JSON.parse(row.reportData);
      } catch (parseErr) {
        debugError('Error parsing report data for row:', row.id);
        row.reportData = {};
      }

      row.approvalWorkflow = helpers.parseJsonSafe(row.approvalWorkflow, []);
      row.totalExpenses = calculateTotalExpensesFromReportData(row.reportData);
      row.totalMiles = row.reportData?.totalMiles ?? row.totalMiles ?? 0;
      row.totalMileageAmount = row.reportData?.totalMileageAmount ?? row.totalMileageAmount ?? 0;
      row.comments = [];
    });
    
    if (rows.length === 0) {
      res.json(rows);
      return;
    }

    const reportIds = rows.map(row => row.id);
    const placeholders = reportIds.map(() => '?').join(',');

    db.all(
      `SELECT id, reportId, supervisorId, supervisorName, comments, timestamp 
       FROM report_approvals 
       WHERE action = 'comment' AND reportId IN (${placeholders})
       ORDER BY timestamp ASC`,
      reportIds,
      (commentsErr, commentRows) => {
        if (commentsErr) {
          debugError('❌ Error fetching report comments:', commentsErr);
          res.status(500).json({ error: commentsErr.message });
          return;
        }

        const commentsMap = new Map();
        commentRows.forEach((comment) => {
          if (!commentsMap.has(comment.reportId)) {
            commentsMap.set(comment.reportId, []);
          }
          commentsMap.get(comment.reportId).push({
            id: comment.id,
            supervisorId: comment.supervisorId,
            supervisorName: comment.supervisorName,
            comment: comment.comments || '',
            createdAt: comment.timestamp,
          });
        });

        rows.forEach((row) => {
          row.comments = commentsMap.get(row.id) || [];
        });

        res.json(rows);
      }
    );
  });
});

/**
 * Get detailed expense report data (for DetailedReportView)
 * Returns full report with mileage, receipts, time tracking, and cost center breakdown
 */
router.get('/api/monthly-reports/:id/detailed', async (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();

  try {
    // Get the report
    const report = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM expense_reports WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!report) {
      res.status(404).json({ error: 'Expense report not found' });
      return;
    }

    // Get employee info
    const employee = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, name, preferredName, email FROM employees WHERE id = ?',
        [report.employeeId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });

    // Parse report data
    const reportData = helpers.parseJsonSafe(report.reportData, {});
    const mileageEntries = Array.isArray(reportData.mileageEntries) ? reportData.mileageEntries : [];
    const receipts = Array.isArray(reportData.receipts) ? reportData.receipts : [];
    const timeTracking = Array.isArray(reportData.timeTracking) ? reportData.timeTracking : [];
    const costCenters = reportData.costCenters || [];

    // Calculate totals
    const totalMiles = mileageEntries.reduce((sum, entry) => sum + (entry.miles || 0), 0);
    const totalExpenses = receipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0) +
      mileageEntries.reduce((sum, entry) => sum + (entry.mileageAmount || 0), 0);
    const totalHours = timeTracking.reduce((sum, entry) => sum + (entry.hours || 0), 0);

    // Build cost center breakdown
    const costCenterMap = new Map();
    
    // Add receipts to cost centers
    receipts.forEach(receipt => {
      const costCenter = receipt.costCenter || 'Unassigned';
      if (!costCenterMap.has(costCenter)) {
        costCenterMap.set(costCenter, { costCenter, receipts: 0, mileage: 0, time: 0, total: 0 });
      }
      const breakdown = costCenterMap.get(costCenter);
      breakdown.receipts += receipt.amount || 0;
      breakdown.total += receipt.amount || 0;
    });

    // Add mileage to cost centers
    mileageEntries.forEach(entry => {
      const costCenter = entry.costCenter || 'Unassigned';
      if (!costCenterMap.has(costCenter)) {
        costCenterMap.set(costCenter, { costCenter, receipts: 0, mileage: 0, time: 0, total: 0 });
      }
      const breakdown = costCenterMap.get(costCenter);
      breakdown.mileage += entry.mileageAmount || 0;
      breakdown.total += entry.mileageAmount || 0;
    });

    // Add time tracking to cost centers
    timeTracking.forEach(entry => {
      const costCenter = entry.costCenter || 'Unassigned';
      if (!costCenterMap.has(costCenter)) {
        costCenterMap.set(costCenter, { costCenter, receipts: 0, mileage: 0, time: 0, total: 0 });
      }
      // Time tracking doesn't have a dollar amount, just hours
      const breakdown = costCenterMap.get(costCenter);
      breakdown.time += entry.hours || 0;
    });

    const costCenterBreakdown = Array.from(costCenterMap.values());

    // Build response
    const response = {
      report: {
        id: report.id,
        employeeId: report.employeeId,
        employeeName: employee?.preferredName || employee?.name || 'Unknown',
        employeeEmail: employee?.email || '',
        month: report.month,
        year: report.year,
        totalMiles,
        totalExpenses,
        status: report.status,
        submittedAt: report.submittedAt || null,
        reviewedAt: report.reviewedAt || null,
      },
      mileageEntries,
      receipts,
      timeTracking,
      costCenterBreakdown,
      summary: {
        totalEntries: mileageEntries.length + receipts.length + timeTracking.length,
        totalMiles,
        totalExpenses,
        totalHours,
        receiptCount: receipts.length,
        mileageCount: mileageEntries.length,
        timeCount: timeTracking.length,
      },
    };

    res.json(response);
  } catch (error) {
    debugError('❌ Error fetching detailed report:', error);
    res.status(500).json({ error: 'Failed to load detailed report' });
  }
});

/**
 * Get expense report history
 */
router.get('/api/expense-reports/:id/history', async (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();

  try {
    const report = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM expense_reports WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!report) {
      res.status(404).json({ error: 'Expense report not found' });
      return;
    }

    const employee = await new Promise((resolve, reject) => {
      db.get('SELECT id, name, preferredName FROM employees WHERE id = ?', [report.employeeId], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });

    const workflowRaw = helpers.parseJsonSafe(report.approvalWorkflow, []);
    const workflow = Array.isArray(workflowRaw)
      ? workflowRaw.map((step, index) => ({
          step: typeof step.step === 'number' ? step.step : index,
          role: step.role || (index === 0 ? 'supervisor' : 'finance'),
          status: step.status || 'pending',
          approverId: step.approverId ?? null,
          approverName: step.approverName ?? null,
          delegatedToId: step.delegatedToId ?? null,
          delegatedToName: step.delegatedToName ?? null,
          dueAt: step.dueAt ?? null,
          actedAt: step.actedAt ?? null,
          comments: step.comments ?? null,
          reminders: Array.isArray(step.reminders) ? step.reminders : [],
        }))
      : [];

    const actionRows = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, action, supervisorId as actorId, supervisorName as actorName, comments, timestamp
         FROM report_approvals
         WHERE reportId = ?
         ORDER BY datetime(timestamp) ASC`,
        [id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const determineActorRole = (actorId) => {
      if (!actorId) return 'system';
      return actorId === report.employeeId ? 'employee' : 'supervisor';
    };

    const historyBase = actionRows.map((row) => ({
      id: row.id,
      action: row.action || 'update',
      actorId: row.actorId || null,
      actorName: row.actorName || null,
      actorRole: determineActorRole(row.actorId),
      timestamp: row.timestamp,
      message: row.comments || '',
    }));

    const syntheticHistory = [];
    if (report.submittedAt) {
      syntheticHistory.push({
        id: `${id}-submitted`,
        action: 'submitted',
        actorId: report.employeeId,
        actorName: employee?.preferredName || employee?.name || 'Employee',
        actorRole: 'employee',
        timestamp: report.submittedAt,
        message: 'Report submitted for approval',
      });
    }

    if (report.approvedAt) {
      syntheticHistory.push({
        id: `${id}-approved`,
        action: 'approved',
        actorId: report.currentApproverId || null,
        actorName: report.approvedBy || report.currentApproverName || 'Supervisor',
        actorRole: report.currentApproverId === report.employeeId ? 'employee' : 'supervisor',
        timestamp: report.approvedAt,
        message: 'Report fully approved',
      });
    }

    const history = [...syntheticHistory, ...historyBase]
      .filter((entry) => entry.timestamp)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const parsedReportData = helpers.parseJsonSafe(report.reportData, {});

    res.json({
      report: {
        id: report.id,
        employeeId: report.employeeId,
        employeeName: employee?.preferredName || employee?.name || null,
        status: report.status,
        submittedAt: report.submittedAt || null,
        approvedAt: report.approvedAt || null,
        currentApprovalStage: report.currentApprovalStage || null,
        currentApprovalStep: Number.isInteger(report.currentApprovalStep)
          ? report.currentApprovalStep
          : parseInt(report.currentApprovalStep || '0', 10) || 0,
        currentApproverId: report.currentApproverId || null,
        currentApproverName: report.currentApproverName || null,
        escalationDueAt: report.escalationDueAt || null,
        month: report.month,
        year: report.year,
        totalExpenses: calculateTotalExpensesFromReportData(parsedReportData),
        totalMiles: parsedReportData?.totalMiles ?? report.totalMiles ?? 0,
        totalHours: parsedReportData?.totalHours ?? 0,
      },
      workflow,
      history,
    });
  } catch (error) {
    debugError('❌ Error fetching expense report history:', error);
    res.status(500).json({ error: 'Failed to load expense report history' });
  }
});

/**
 * Update expense report status (for approval workflow)
 */
router.put('/api/expense-reports/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, approvedBy } = req.body;
  const db = dbService.getDb();
  const nowIso = new Date().toISOString();

  if (!status) {
    res.status(400).json({ error: 'Status is required' });
    return;
  }

  try {
    const report = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM expense_reports WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!report) {
      res.status(404).json({ error: 'Expense report not found' });
      return;
    }

    const updateData = {
      updatedAt: nowIso,
    };

    if (status === 'submitted') {
      debugLog(`📝 Submitting report ${id} for employee ${report.employeeId}`);
      const workflowInit = await initializeApprovalWorkflow(report);
      debugLog(`📝 Workflow initialized: stage=${workflowInit.currentApprovalStage}, approver=${workflowInit.currentApproverId}, approverName=${workflowInit.currentApproverName}`);
      
      updateData.status = workflowInit.currentApprovalStage === 'finance' ? 'pending_finance' : 'pending_supervisor';
      updateData.submittedAt = nowIso;
      updateData.approvalWorkflow = JSON.stringify(workflowInit.workflow);
      updateData.currentApprovalStep = workflowInit.currentApprovalStep;
      updateData.currentApprovalStage = workflowInit.currentApprovalStage;
      updateData.currentApproverId = workflowInit.currentApproverId;
      updateData.currentApproverName = workflowInit.currentApproverName;
      updateData.escalationDueAt = workflowInit.escalationDueAt;
      
      debugLog(`📝 Report ${id} status set to: ${updateData.status}, currentApproverId: ${updateData.currentApproverId}`);
      
      // Notify supervisor (if supervisor exists and is first approver)
      if (workflowInit.currentApprovalStage === 'supervisor' && workflowInit.currentApproverId) {
        const employee = await dbService.getEmployeeById(report.employeeId);
        if (employee) {
          debugLog(`📝 Sending notification to supervisor ${workflowInit.currentApproverId} for report ${id}`);
          notificationService.notifyReportSubmitted(id, report.employeeId, employee.preferredName || employee.name).catch(err => {
            debugError('❌ Error sending notification for report submission:', err);
          });
        }
      }
    } else if (status === 'approved') {
      updateData.status = 'approved';
      updateData.approvedAt = nowIso;
      updateData.approvedBy = approvedBy || 'system';
      updateData.currentApprovalStage = 'completed';
      updateData.currentApproverId = null;
      updateData.currentApproverName = null;
      updateData.escalationDueAt = null;
    } else {
      updateData.status = status;
      if (status === 'needs_revision') {
        updateData.currentApprovalStage = 'needs_revision';
        updateData.currentApproverId = null;
        updateData.currentApproverName = null;
        updateData.escalationDueAt = null;
      }
    }

    const updateFields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const updateValues = Object.values(updateData);

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE expense_reports SET ${updateFields} WHERE id = ?`,
        [...updateValues, id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    const updatedReport = await new Promise((resolve, reject) => {
      db.get(
        `SELECT status, currentApprovalStage, currentApproverId, currentApproverName, submittedAt, approvedAt, escalationDueAt
         FROM expense_reports WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || {});
        }
      );
    });

    res.json({
      message: 'Expense report status updated successfully',
      status: updatedReport.status || status,
      currentApprovalStage: updatedReport.currentApprovalStage || null,
      currentApproverId: updatedReport.currentApproverId || null,
      currentApproverName: updatedReport.currentApproverName || null,
      submittedAt: updatedReport.submittedAt || null,
      approvedAt: updatedReport.approvedAt || null,
      escalationDueAt: updatedReport.escalationDueAt || null,
    });
  } catch (error) {
    debugError('❌ Error updating expense report status:', error);
    res.status(500).json({ error: 'Failed to update expense report status' });
  }
});

/**
 * Handle approval workflow actions (approve, reject, delegate, remind, comment).
 * For finance steps, any employee with finance role or finance-related position may approve
 * (not only the designated approver), so multiple finance users can act on reports.
 */
router.put('/api/expense-reports/:id/approval', async (req, res) => {
  const { id } = req.params;
  const { action, approverId, approverName, comments, delegateId, supervisorCertificationAcknowledged } = req.body;
  const db = dbService.getDb();
  const now = new Date();
  const nowIso = now.toISOString();

  if (!action) {
    res.status(400).json({ error: 'Action is required' });
    return;
  }

  try {
    const report = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM expense_reports WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!report) {
      res.status(404).json({ error: 'Expense report not found' });
      return;
    }

    let workflow = helpers.parseJsonSafe(report.approvalWorkflow, []);
    if (!Array.isArray(workflow)) workflow = [];

    // Initialize updates object early
    let initialCurrentApprovalStage = report.currentApprovalStage || '';
    let initialCurrentApproverId = report.currentApproverId || null;
    let initialCurrentApproverName = report.currentApproverName || null;
    let initialEscalationDueAt = report.escalationDueAt || null;

    // Auto-initialize workflow if it's empty or missing
    if (workflow.length === 0 || !workflow) {
      debugLog(`⚠️  Workflow is empty for report ${id}, auto-initializing...`);
      const workflowInit = await initializeApprovalWorkflow(report);
      workflow = workflowInit.workflow;
      initialCurrentApprovalStage = workflowInit.currentApprovalStage;
      initialCurrentApproverId = workflowInit.currentApproverId;
      initialCurrentApproverName = workflowInit.currentApproverName;
      initialEscalationDueAt = workflowInit.escalationDueAt;
      // Save the initialized workflow immediately
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE expense_reports SET approvalWorkflow = ?, currentApprovalStage = ?, currentApproverId = ?, currentApproverName = ?, escalationDueAt = ? WHERE id = ?',
          [JSON.stringify(workflow), workflowInit.currentApprovalStage, workflowInit.currentApproverId, workflowInit.currentApproverName, workflowInit.escalationDueAt, id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    const currentStepIndex = Number.isInteger(report.currentApprovalStep)
      ? report.currentApprovalStep
      : parseInt(report.currentApprovalStep || '0', 10) || 0;

    let currentStep = workflow[currentStepIndex];
    let resolvedCurrentStepIndex = currentStepIndex;
    
    // If currentStep is missing, try to find the correct step based on currentApprovalStage
    if (!currentStep && workflow.length > 0) {
      const currentStage = initialCurrentApprovalStage || '';
      if (currentStage.includes('supervisor')) {
        currentStep = workflow.find(step => step.role === 'supervisor' && step.status === 'pending');
        if (currentStep) {
          resolvedCurrentStepIndex = workflow.indexOf(currentStep);
        }
      } else if (currentStage.includes('finance')) {
        currentStep = workflow.find(step => step.role === 'finance' && step.status === 'pending');
        if (currentStep) {
          resolvedCurrentStepIndex = workflow.indexOf(currentStep);
        }
      }
      
      // If still no step found, use the first pending step
      if (!currentStep) {
        currentStep = workflow.find(step => step.status === 'pending');
        if (currentStep) {
          resolvedCurrentStepIndex = workflow.indexOf(currentStep);
        }
      }
    }

    const updates = {
      status: report.status,
      currentApprovalStep: resolvedCurrentStepIndex,
      currentApprovalStage: initialCurrentApprovalStage,
      currentApproverId: initialCurrentApproverId,
      currentApproverName: initialCurrentApproverName,
      escalationDueAt: initialEscalationDueAt,
      approvalWorkflow: report.approvalWorkflow,
      updatedAt: nowIso,
    };

    const logAction = (actionType, actorId, actorName, note) => {
      const logId = `approval-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      db.run(
        'INSERT INTO report_approvals (id, reportId, employeeId, supervisorId, supervisorName, action, comments, timestamp, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          logId,
          report.id,
          report.employeeId,
          actorId || '',
          actorName || '',
          actionType,
          note || '',
          nowIso,
          nowIso,
        ],
        (err) => {
          if (err) debugError('❌ Error recording approval log:', err);
        }
      );
    };

    const saveAndRespond = async () => {
      updates.approvalWorkflow = JSON.stringify(workflow);

      await new Promise((resolve, reject) => {
        const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const updateValues = Object.values(updates);
        db.run(
          `UPDATE expense_reports SET ${updateFields} WHERE id = ?`,
          [...updateValues, id],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      res.json({
        message: 'Approval action processed successfully',
        status: updates.status,
        currentApprovalStage: updates.currentApprovalStage,
        currentApproverId: updates.currentApproverId,
        currentApproverName: updates.currentApproverName,
        escalationDueAt: updates.escalationDueAt,
        approvalWorkflow: workflow,
      });
    };

    switch (action) {
      case 'approve': {
        // If no current step, try to find the correct one based on report status and approver
        if (!currentStep) {
          debugLog(`⚠️  No current step found for report ${id}, attempting to find correct step...`);
          debugLog(`   Report status: ${report.status}, currentApprovalStage: ${report.currentApprovalStage}, currentApproverId: ${report.currentApproverId}`);
          debugLog(`   Workflow length: ${workflow.length}, currentStepIndex: ${currentStepIndex}`);
          
          // Try to find a step matching the current approver or status
          if (approverId) {
            currentStep = workflow.find(step => 
              (step.approverId === approverId || step.delegatedToId === approverId) && 
              step.status === 'pending'
            );
            if (currentStep) {
              const stepIndex = workflow.indexOf(currentStep);
              updates.currentApprovalStep = stepIndex;
              debugLog(`✅ Found step at index ${stepIndex} matching approver ${approverId}`);
            }
          }
          
          // If still not found, find any pending step
          if (!currentStep) {
            currentStep = workflow.find(step => step.status === 'pending');
            if (currentStep) {
              const stepIndex = workflow.indexOf(currentStep);
              updates.currentApprovalStep = stepIndex;
              debugLog(`✅ Found pending step at index ${stepIndex}`);
            }
          }
        }
        
        if (!currentStep) {
          debugError(`❌ Cannot find active approval step for report ${id}. Workflow:`, JSON.stringify(workflow, null, 2));
          res.status(400).json({ error: 'No active approval step. The report may need to be resubmitted.' });
          return;
        }
        if (!approverId) {
          res.status(400).json({ error: 'Approver ID is required' });
          return;
        }

        const allowedApproverIds = new Set();
        if (currentStep.approverId) allowedApproverIds.add(currentStep.approverId);
        if (currentStep.delegatedToId) allowedApproverIds.add(currentStep.delegatedToId);

        // For finance step: allow any employee with finance role (not just the designated approver)
        if (currentStep.role === 'finance') {
          const approver = await dbService.getEmployeeById(approverId);
          if (approver && (helpers.isFinanceRole(approver) || helpers.isFinancePosition(approver.position))) {
            allowedApproverIds.add(approverId);
            if (!currentStep.approverName || currentStep.approverName === 'Finance Team') {
              currentStep.approverName = approver.preferredName || approver.name || approverName || 'Finance';
            }
          }
        }

        if (!allowedApproverIds.has(approverId)) {
          const hint = currentStep.role === 'finance'
            ? ' Ensure you are logged in as a finance employee (role or position).'
            : '';
          res.status(403).json({ error: `Approver is not authorized for this step.${hint}` });
          return;
        }

        // Mark step approved and advance workflow

        currentStep.status = 'approved';
        currentStep.actedAt = nowIso;
        currentStep.comments = comments || currentStep.comments || '';
        currentStep.reminders = currentStep.reminders || [];
        currentStep.delegatedToId = null;
        currentStep.delegatedToName = null;
        currentStep.approverId = currentStep.approverId || approverId;
        currentStep.approverName = currentStep.approverName || approverName || 'Supervisor';

        let newStatus = 'approved';
        let nextStage = 'completed';
        let nextApproverId = null;
        let nextApproverName = null;
        let escalationDueAt = null;
        let nextStepIndex = currentStepIndex + 1;

        // Weekly submissions: supervisor approval only — do not send to finance. Only full month submission goes to finance.
        const reportDataParsed = helpers.parseJsonSafe(report.reportData, {});
        const submissionType = reportDataParsed.submissionType || (report.submissionType ? String(report.submissionType) : null);
        const isWeeklyCheckup = submissionType === 'weekly_checkup';

        if (workflow[nextStepIndex]) {
          const nextStep = workflow[nextStepIndex];
          const isSupervisorApprovingAndNextIsFinance = currentStep.role === 'supervisor' && nextStep.role === 'finance';

          if (isSupervisorApprovingAndNextIsFinance && isWeeklyCheckup) {
            // Weekly submission: stop at supervisor approval; do not advance to finance
            nextStepIndex = currentStepIndex;
            updates.approvedAt = nowIso;
            updates.approvedBy = approverName || currentStep.approverName || 'system';
            updates.currentApprovalStep = currentStepIndex;
            debugLog(`📝 Report ${id} is weekly check-up: supervisor approved, not sending to finance.`);
          } else {
            nextStep.status = 'pending';
            nextStep.dueAt = helpers.computeEscalationDueAt(nextStep.role === 'finance' ? constants.FINANCE_ESCALATION_HOURS : constants.SUPERVISOR_ESCALATION_HOURS);

            newStatus = `pending_${nextStep.role}`;
            nextStage = nextStep.role;
            nextApproverId = nextStep.approverId || null;
            nextApproverName = nextStep.approverName || null;
            escalationDueAt = nextStep.dueAt;

            updates.currentApprovalStep = nextStepIndex;

            // Notify next approver (e.g., supervisor approves -> notify finance) only for monthly submissions
            if (nextStage === 'finance' && currentStep.role === 'supervisor') {
              notificationService.notifyFinanceApprovalNeeded(id, approverId, approverName, report.employeeId).catch(err => {
                debugError('❌ Error sending notification to finance:', err);
              });
            }
          }
        } else {
          updates.approvedAt = nowIso;
          updates.approvedBy = approverName || currentStep.approverName || 'system';
          nextStepIndex = currentStepIndex;
        }

        updates.status = newStatus;
        updates.currentApprovalStage = nextStage;
        updates.currentApproverId = nextApproverId;
        updates.currentApproverName = nextApproverName;
        updates.escalationDueAt = escalationDueAt;

        workflow[currentStepIndex] = currentStep;

        // Update reportData with supervisor certification acknowledgment if provided
        if (supervisorCertificationAcknowledged !== undefined) {
          try {
            const reportData = helpers.parseJsonSafe(report.reportData, {});
            reportData.supervisorCertificationAcknowledged = supervisorCertificationAcknowledged;
            
            await new Promise((resolve, reject) => {
              db.run(
                'UPDATE expense_reports SET reportData = ? WHERE id = ?',
                [JSON.stringify(reportData), id],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
          } catch (err) {
            debugWarn('⚠️ Failed to update supervisor certification acknowledgment:', err);
          }
        }

        // Notify employee when report is fully approved (weekly: supervisor only; monthly: after finance)
        if (newStatus === 'approved') {
          const isWeekly = currentStep.role === 'supervisor'; // approved at supervisor = weekly; approved at finance = monthly
          notificationService.notifyEmployeeReportApproved(id, approverId, approverName, report.employeeId, isWeekly).catch(err => {
            debugError('❌ Error notifying employee of approval:', err);
          });
        }

        logAction('approved', approverId, approverName, comments);
        await saveAndRespond();
        return;
      }

      case 'reject': {
        if (!currentStep) {
          res.status(400).json({ error: 'No active approval step to reject' });
          return;
        }
        if (!comments) {
          res.status(400).json({ error: 'Comments are required when rejecting a report' });
          return;
        }

        // Determine target role based on current step
        // If supervisor rejects, goes back to employee
        // If finance rejects, goes back to supervisor
        const targetRole = currentStep.role === 'finance' ? 'supervisor' : 'employee';
        
        currentStep.status = 'rejected';
        currentStep.actedAt = nowIso;
        currentStep.comments = comments;
        workflow[currentStepIndex] = currentStep;

        updates.status = 'needs_revision';
        updates.currentApprovalStage = 'needs_revision';
        
        // Set the approver to the target role's approver (supervisor or employee)
        if (targetRole === 'supervisor') {
          // Finance rejected - goes back to supervisor
          const employee = await dbService.getEmployeeById(report.employeeId);
          if (employee && employee.supervisorId) {
            const supervisor = await dbService.getEmployeeById(employee.supervisorId);
            if (supervisor) {
              updates.currentApproverId = supervisor.id;
              updates.currentApproverName = supervisor.preferredName || supervisor.name || 'Supervisor';
            }
          }
        } else {
          // Supervisor rejected - goes back to employee
          updates.currentApproverId = report.employeeId;
          const employee = await dbService.getEmployeeById(report.employeeId);
          if (employee) {
            updates.currentApproverName = employee.preferredName || employee.name || 'Employee';
          }
        }
        
        updates.escalationDueAt = null;

        logAction('rejected', approverId || currentStep.approverId, approverName || currentStep.approverName, comments);
        await saveAndRespond();
        return;
      }

      case 'delegate': {
        if (!currentStep) {
          res.status(400).json({ error: 'No active approval step to delegate' });
          return;
        }
        if (!delegateId) {
          res.status(400).json({ error: 'Delegate ID is required' });
          return;
        }

        const delegate = await dbService.getEmployeeById(delegateId);
        if (!delegate) {
          res.status(404).json({ error: 'Delegate not found' });
          return;
        }

        const delegateName = delegate.preferredName || delegate.name || 'Delegate';
        currentStep.delegatedToId = delegateId;
        currentStep.delegatedToName = delegateName;
        currentStep.status = 'pending';
        currentStep.delegatedAt = nowIso;
        currentStep.reminders = currentStep.reminders || [];
        workflow[currentStepIndex] = currentStep;

        updates.currentApproverId = delegateId;
        updates.currentApproverName = delegateName;
        updates.escalationDueAt = helpers.computeEscalationDueAt(currentStep.role === 'finance' ? constants.FINANCE_ESCALATION_HOURS : constants.SUPERVISOR_ESCALATION_HOURS);

        logAction('delegated', approverId || currentStep.approverId, approverName || currentStep.approverName, `Delegated to ${delegateName}`);
        await saveAndRespond();
        return;
      }

      case 'remind': {
        if (!currentStep) {
          res.status(400).json({ error: 'No active approval step to remind' });
          return;
        }

        currentStep.reminders = currentStep.reminders || [];
        currentStep.reminders.push({ sentAt: nowIso, sentBy: approverId || currentStep.approverId || null });
        currentStep.lastReminderAt = nowIso;
        workflow[currentStepIndex] = currentStep;

        updates.escalationDueAt = helpers.computeEscalationDueAt(currentStep.role === 'finance' ? constants.FINANCE_ESCALATION_HOURS : constants.SUPERVISOR_ESCALATION_HOURS);

        logAction('reminder', approverId || currentStep.approverId, approverName || currentStep.approverName, comments || 'Reminder sent');
        await saveAndRespond();
        return;
      }

      case 'request_revision_to_supervisor': {
        // Finance requests revision - send back to supervisor
        if (currentStep && currentStep.role !== 'finance') {
          res.status(400).json({ error: 'This action is only available for finance approvers' });
          return;
        }
        if (!comments) {
          res.status(400).json({ error: 'Comments are required when requesting revision' });
          return;
        }

        if (currentStep) {
          currentStep.status = 'revision_requested';
          currentStep.actedAt = nowIso;
          currentStep.comments = comments;
          workflow[currentStepIndex] = currentStep;
        }

        // Find supervisor step in workflow and reset it
        const supervisorStepIndex = workflow.findIndex(step => step.role === 'supervisor');
        let supervisorStep = null;
        
        // Get supervisor
        const employee = await dbService.getEmployeeById(report.employeeId);
        if (employee && employee.supervisorId) {
          const supervisor = await dbService.getEmployeeById(employee.supervisorId);
          if (supervisor) {
            const supervisorName = supervisor.preferredName || supervisor.name || 'Supervisor';
            
            // If supervisor step exists, reset it to pending
            if (supervisorStepIndex !== -1) {
              supervisorStep = workflow[supervisorStepIndex];
              supervisorStep.status = 'pending';
              supervisorStep.comments = comments || supervisorStep.comments || '';
              supervisorStep.dueAt = helpers.computeEscalationDueAt(constants.SUPERVISOR_ESCALATION_HOURS);
              workflow[supervisorStepIndex] = supervisorStep;
            }
            
            updates.currentApproverId = supervisor.id;
            updates.currentApproverName = supervisorName;
            updates.currentApprovalStep = supervisorStepIndex !== -1 ? supervisorStepIndex : 0;
          } else {
            updates.currentApproverId = null;
            updates.currentApproverName = null;
            updates.currentApprovalStep = supervisorStepIndex !== -1 ? supervisorStepIndex : 0;
          }
        } else {
          updates.currentApproverId = null;
          updates.currentApproverName = null;
          updates.currentApprovalStep = supervisorStepIndex !== -1 ? supervisorStepIndex : 0;
        }

        // Set status and send back to supervisor
        updates.status = 'needs_revision';
        updates.currentApprovalStage = 'pending_supervisor';
        updates.escalationDueAt = (supervisorStep && supervisorStep.dueAt) || null;

        // Notify supervisor that finance requested revision
        if (employee && employee.supervisorId) {
          notificationService.notifyFinanceRevisionRequest(id, approverId, approverName, report.employeeId).catch(err => {
            debugError('❌ Error sending notification to supervisor:', err);
          });
        }

        logAction('request_revision_to_supervisor', approverId, approverName, comments);
        await saveAndRespond();
        return;
      }

      case 'request_revision_to_employee': {
        // Supervisor requests revision - send back to employee
        if (currentStep && currentStep.role !== 'supervisor') {
          res.status(400).json({ error: 'This action is only available for supervisor approvers' });
          return;
        }
        if (!comments) {
          res.status(400).json({ error: 'Comments are required when requesting revision' });
          return;
        }

        if (currentStep) {
          currentStep.status = 'revision_requested';
          currentStep.actedAt = nowIso;
          currentStep.comments = comments;
          workflow[currentStepIndex] = currentStep;
        }

        // Process selected items for item-specific revisions
        const selectedItems = req.body.selectedItems || {};
        const selectedMileage = selectedItems.mileage || [];
        const selectedReceipts = selectedItems.receipts || [];
        const selectedTimeTracking = selectedItems.timeTracking || [];

        // Create revision notes for selected items
        if (selectedMileage.length > 0 || selectedReceipts.length > 0 || selectedTimeTracking.length > 0) {
          const employee = await dbService.getEmployeeById(report.employeeId);
          const requestorId = approverId || supervisorId || '';
          const requestorName = approverName || supervisorName || 'Supervisor';

          // Process mileage entries (format: mileage-{index})
          for (const itemId of selectedMileage) {
            const index = parseInt(itemId.replace('mileage-', ''), 10);
            if (!isNaN(index)) {
              const noteId = `rev-note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
              await new Promise((resolve, reject) => {
                db.run(
                  `INSERT INTO report_revision_notes 
                   (id, reportId, employeeId, requestedBy, requestedByName, requestedByRole, targetRole, category, itemId, itemType, notes, resolved, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                  [noteId, id, report.employeeId, requestorId, requestorName, 'supervisor', 'employee', 'mileage', index.toString(), 'mileage', comments, nowIso, nowIso],
                  (err) => {
                    if (err) reject(err);
                    else resolve();
                  }
                );
              });
            }
          }

          // Process receipts (format: receipt-{receiptId})
          for (const itemId of selectedReceipts) {
            const receiptId = itemId.replace('receipt-', '');
            if (receiptId) {
              const noteId = `rev-note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
              await new Promise((resolve, reject) => {
                db.run(
                  `INSERT INTO report_revision_notes 
                   (id, reportId, employeeId, requestedBy, requestedByName, requestedByRole, targetRole, category, itemId, itemType, notes, resolved, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                  [noteId, id, report.employeeId, requestorId, requestorName, 'supervisor', 'employee', 'receipt', receiptId, 'receipt', comments, nowIso, nowIso],
                  (err) => {
                    if (err) reject(err);
                    else resolve();
                  }
                );
              });

              // Mark receipt as needing revision
              await new Promise((resolve, reject) => {
                db.run(
                  'UPDATE receipts SET needsRevision = 1, revisionReason = ? WHERE id = ?',
                  [comments, receiptId],
                  (err) => {
                    if (err) reject(err);
                    else resolve();
                  }
                );
              });
            }
          }

          // Process time tracking entries (format: time-{index} or mileage-{index} since they share the same daily entry)
          // Note: Time tracking entries are in the same daily entry row as mileage, so they share the same index
          const processedTimeIndices = new Set();
          for (const itemId of selectedTimeTracking) {
            let timeIndex = null;
            if (itemId.startsWith('time-')) {
              timeIndex = itemId.replace('time-', '');
            } else if (itemId.startsWith('mileage-')) {
              // Time tracking may share the same index as mileage in the daily entries table
              timeIndex = itemId.replace('mileage-', '');
            }
            
            if (timeIndex && !processedTimeIndices.has(timeIndex)) {
              processedTimeIndices.add(timeIndex);
              const noteId = `rev-note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
              await new Promise((resolve, reject) => {
                db.run(
                  `INSERT INTO report_revision_notes 
                   (id, reportId, employeeId, requestedBy, requestedByName, requestedByRole, targetRole, category, itemId, itemType, notes, resolved, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                  [noteId, id, report.employeeId, requestorId, requestorName, 'supervisor', 'employee', 'time', timeIndex, 'time', comments, nowIso, nowIso],
                  (err) => {
                    if (err) reject(err);
                    else resolve();
                  }
                );
              });
            }
          }
          
          // Also create time tracking revision notes for mileage entries that were selected
          // (since daily entries contain both mileage and time tracking in the same row)
          for (const itemId of selectedMileage) {
            const index = itemId.replace('mileage-', '');
            if (index && !processedTimeIndices.has(index)) {
              // Create a revision note for time tracking on the same day
              const noteId = `rev-note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
              await new Promise((resolve, reject) => {
                db.run(
                  `INSERT INTO report_revision_notes 
                   (id, reportId, employeeId, requestedBy, requestedByName, requestedByRole, targetRole, category, itemId, itemType, notes, resolved, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                  [noteId, id, report.employeeId, requestorId, requestorName, 'supervisor', 'employee', 'time', index, 'time', comments, nowIso, nowIso],
                  (err) => {
                    if (err) reject(err);
                    else resolve();
                  }
                );
              });
            }
          }

          debugLog(`✅ Created revision notes for ${selectedMileage.length} mileage entries, ${selectedReceipts.length} receipts, ${selectedTimeTracking.length} time entries`);
        }

        // Set status and send back to employee
        updates.status = 'needs_revision';
        updates.currentApprovalStage = 'needs_revision';
        updates.currentApproverId = report.employeeId;
        const employee = await dbService.getEmployeeById(report.employeeId);
        if (employee) {
          updates.currentApproverName = employee.preferredName || employee.name || 'Employee';
        }
        updates.escalationDueAt = null;

        // Notify employee that supervisor requested revision
        notificationService.notifySupervisorRevisionRequest(id, approverId || supervisorId || '', approverName || supervisorName || '', report.employeeId).catch(err => {
          debugError('❌ Error sending notification to employee:', err);
        });

        logAction('request_revision_to_employee', approverId, approverName, comments);
        await saveAndRespond();
        return;
      }

      case 'resubmit_to_finance': {
        // Supervisor resubmits to finance after making changes
        // Check if report is in needs_revision status with pending_supervisor stage
        const isPendingSupervisor = report.status === 'needs_revision' && 
          (report.currentApprovalStage === 'pending_supervisor' || 
           (report.currentApprovalStage || '').toLowerCase().includes('supervisor'));
        
        // Find supervisor step in workflow
        const supervisorStepIndex = workflow.findIndex(step => step.role === 'supervisor');
        const supervisorStep = supervisorStepIndex !== -1 ? workflow[supervisorStepIndex] : null;
        
        if (!supervisorStep && !isPendingSupervisor) {
          res.status(400).json({ error: 'This action is only available when report is with supervisor' });
          return;
        }
        if (!comments) {
          res.status(400).json({ error: 'Comments are required when resubmitting (e.g., "Changes made per finance feedback")' });
          return;
        }

        // Use supervisor step if found, otherwise use current step
        const stepToApprove = supervisorStep || currentStep;
        if (!stepToApprove) {
          res.status(400).json({ error: 'Cannot find supervisor step in workflow' });
          return;
        }
        
        const stepIndexToUpdate = supervisorStepIndex !== -1 ? supervisorStepIndex : currentStepIndex;

        // Mark supervisor step as approved and move to finance
        stepToApprove.status = 'approved';
        stepToApprove.actedAt = nowIso;
        stepToApprove.comments = comments || stepToApprove.comments || '';
        workflow[stepIndexToUpdate] = stepToApprove;

        // Find finance step in workflow
        const financeStepIndex = workflow.findIndex(step => step.role === 'finance');
        if (financeStepIndex === -1) {
          res.status(400).json({ error: 'No finance step found in workflow' });
          return;
        }

        const financeStep = workflow[financeStepIndex];
        financeStep.status = 'pending';
        financeStep.dueAt = helpers.computeEscalationDueAt(constants.FINANCE_ESCALATION_HOURS);
        workflow[financeStepIndex] = financeStep;

        updates.status = 'pending_finance';
        updates.currentApprovalStage = 'finance';
        updates.currentApprovalStep = financeStepIndex;
        updates.currentApproverId = financeStep.approverId || null;
        updates.currentApproverName = financeStep.approverName || 'Finance Team';
        updates.escalationDueAt = financeStep.dueAt;

        // Notify finance that supervisor resubmitted
        notificationService.notifyFinanceApprovalNeeded(id, approverId || supervisorId || '', approverName || supervisorName || '', report.employeeId).catch(err => {
          debugError('❌ Error sending notification to finance:', err);
        });

        logAction('resubmit_to_finance', approverId, approverName, comments);
        await saveAndRespond();
        return;
      }

      case 'comment': {
        const commentText = typeof comments === 'string' ? comments.trim() : '';
        if (!commentText) {
          res.status(400).json({ error: 'Comment text is required' });
          return;
        }

        if (currentStep) {
          const existingComments = Array.isArray(currentStep.commentHistory)
            ? currentStep.commentHistory
            : currentStep.comments
              ? [currentStep.comments]
              : [];
          const updatedComments = [...existingComments, commentText];
          currentStep.commentHistory = updatedComments;
          currentStep.comments = updatedComments.join('\n');
          workflow[currentStepIndex] = currentStep;
        }

        logAction('comment', approverId || currentStep?.approverId, approverName || currentStep?.approverName, commentText);
        await saveAndRespond();
        return;
      }

      default:
        res.status(400).json({ error: `Unsupported approval action: ${action}` });
        return;
    }
  } catch (error) {
    debugError('❌ Error processing approval action:', error);
    res.status(500).json({ error: 'Failed to process approval action' });
  }
});

/**
 * Delete expense report
 */
router.delete('/api/expense-reports/:id', (req, res) => {
  const { id } = req.params;
  const db = dbService.getDb();
  
  db.run('DELETE FROM expense_reports WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Expense report deleted successfully' });
  });
});

/**
 * Add revision note to a specific item in a report
 * POST /api/expense-reports/:id/revision-notes
 * Body: { category, itemId, itemType, notes, requestedBy, requestedByName, requestedByRole, targetRole }
 */
router.post('/api/expense-reports/:id/revision-notes', async (req, res) => {
  const { id } = req.params;
  const { category, itemId, itemType, notes, requestedBy, requestedByName, requestedByRole, targetRole } = req.body;
  const db = dbService.getDb();
  const now = new Date().toISOString();
  const noteId = `rev-note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  if (!category || !itemType || !notes || !requestedBy || !requestedByName || !requestedByRole || !targetRole) {
    res.status(400).json({ error: 'Missing required fields: category, itemType, notes, requestedBy, requestedByName, requestedByRole, targetRole' });
    return;
  }

  try {
    // Verify report exists
    const report = await new Promise((resolve, reject) => {
      db.get('SELECT employeeId FROM expense_reports WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!report) {
      res.status(404).json({ error: 'Expense report not found' });
      return;
    }

    // Insert revision note
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO report_revision_notes 
         (id, reportId, employeeId, requestedBy, requestedByName, requestedByRole, targetRole, category, itemId, itemType, notes, resolved, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [noteId, id, report.employeeId, requestedBy, requestedByName, requestedByRole, targetRole, category, itemId || null, itemType, notes, now, now],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    debugLog(`✅ Added revision note ${noteId} for report ${id}`);
    res.json({ 
      id: noteId, 
      message: 'Revision note added successfully',
      noteId,
      reportId: id
    });

  } catch (error) {
    debugError('❌ Error adding revision note:', error);
    res.status(500).json({ error: 'Failed to add revision note', details: error.message });
  }
});

/**
 * Get revision notes for a report
 * GET /api/expense-reports/:id/revision-notes
 */
router.get('/api/expense-reports/:id/revision-notes', (req, res) => {
  const { id } = req.params;
  const { resolved } = req.query;
  const db = dbService.getDb();

  let query = 'SELECT * FROM report_revision_notes WHERE reportId = ?';
  const params = [id];

  if (resolved !== undefined) {
    query += ' AND resolved = ?';
    params.push(resolved === 'true' ? 1 : 0);
  }

  query += ' ORDER BY createdAt DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      debugError('❌ Error fetching revision notes:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows || []);
  });
});

/**
 * Resolve a revision note
 * PUT /api/expense-reports/:id/revision-notes/:noteId/resolve
 * Body: { resolvedBy }
 */
router.put('/api/expense-reports/:id/revision-notes/:noteId/resolve', async (req, res) => {
  const { id, noteId } = req.params;
  const { resolvedBy } = req.body;
  const db = dbService.getDb();
  const now = new Date().toISOString();

  try {
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE report_revision_notes SET resolved = 1, resolvedBy = ?, resolvedAt = ?, updatedAt = ? WHERE id = ? AND reportId = ?',
        [resolvedBy || 'system', now, now, noteId, id],
        function(err) {
          if (err) reject(err);
          else {
            if (this.changes === 0) {
              reject(new Error('Revision note not found'));
            } else {
              resolve();
            }
          }
        }
      );
    });

    debugLog(`✅ Resolved revision note ${noteId} for report ${id}`);
    res.json({ message: 'Revision note resolved successfully' });

  } catch (error) {
    debugError('❌ Error resolving revision note:', error);
    res.status(500).json({ error: 'Failed to resolve revision note', details: error.message });
  }
});

module.exports = router;

