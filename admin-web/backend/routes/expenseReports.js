/**
 * Expense Reports Routes
 * Extracted from server.js for better organization
 * Includes: CRUD operations, sync-to-source, approval workflow, history
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const websocketService = require('../services/websocketService');
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
router.post('/api/expense-reports', (req, res) => {
  const { employeeId, month, year, reportData, status } = req.body;
  const db = dbService.getDb();
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const now = new Date().toISOString();

  // Check if report already exists for this employee/month/year
  db.get('SELECT id FROM expense_reports WHERE employeeId = ? AND month = ? AND year = ?', 
    [employeeId, month, year], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (row) {
      // Update existing report
      const updateData = {
        reportData: JSON.stringify(reportData),
        status: status || 'draft',
        updatedAt: now
      };

      if (status === 'submitted') {
        updateData.submittedAt = now;
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
          res.json({ id: row.id, message: 'Expense report updated successfully' });
        }
      );
    } else {
      // Create new report
      const insertData = {
        id,
        employeeId,
        month,
        year,
        reportData: JSON.stringify(reportData),
        status: status || 'draft',
        createdAt: now,
        updatedAt: now
      };

      if (status === 'submitted') {
        insertData.submittedAt = now;
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
  });
});

/**
 * Get expense report by employee, month, and year
 */
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
        res.status(404).json({ error: 'Expense report not found' });
        return;
      }
      
      // Parse the report data JSON
      try {
        row.reportData = JSON.parse(row.reportData);
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
    
    // 2a. Sync daily descriptions from the dedicated dailyDescriptions array (new tab-based approach)
    if (reportData.dailyDescriptions && reportData.dailyDescriptions.length > 0) {
      // Deduplicate by date (keep the last one if duplicates exist)
      const seenDates = new Map();
      const uniqueDescriptions = [];
      for (const desc of reportData.dailyDescriptions) {
        const dateStr = dateHelpers.normalizeDateString(desc.date);
        if (!dateStr) {
          debugWarn(`⚠️ Skipping daily description with invalid date: ${desc.date}`);
          continue;
        }
        // Use date as key to deduplicate
        seenDates.set(dateStr, desc);
      }
      // Convert map values back to array
      for (const desc of seenDates.values()) {
        uniqueDescriptions.push(desc);
      }
      
      debugLog(`🔄 Processing ${uniqueDescriptions.length} unique daily descriptions (${reportData.dailyDescriptions.length} total, ${reportData.dailyDescriptions.length - uniqueDescriptions.length} duplicates removed)`);
      
      for (const desc of uniqueDescriptions) {
        try {
          const dateStr = dateHelpers.normalizeDateString(desc.date);
          if (!dateStr) {
            debugWarn(`⚠️ Skipping daily description with invalid date: ${desc.date}`);
            continue;
          }
          const hasDescription = desc.description && desc.description.trim();
          
          // Always use deterministic ID based on employee and date
          const id = desc.id || `desc-${employeeId}-${dateStr}`;
          const now = new Date().toISOString();
          const stayedOvernightValue = desc.stayedOvernight ? 1 : 0;
          const dayOffValue = desc.dayOff ? 1 : 0;
          
          if (hasDescription || desc.dayOff) {
            // Use INSERT OR REPLACE to handle all cases (new, update, duplicate)
            await new Promise((resolve, reject) => {
              db.run(
                'INSERT OR REPLACE INTO daily_descriptions (id, employeeId, date, description, costCenter, stayedOvernight, dayOff, dayOffType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM daily_descriptions WHERE id = ?), ?), ?)',
                [id, employeeId, dateStr, desc.description || '', desc.costCenter || '', stayedOvernightValue, dayOffValue, desc.dayOffType || null, id, now, now],
                function(insertErr) {
                  if (insertErr) {
                    debugError(`❌ Error upserting daily description for date ${dateStr} (id: ${id}):`, insertErr);
                    reject(insertErr);
                  } else {
                    if (this.changes === 0) {
                      debugLog(`⚠️ No changes for daily description ${dateStr} (id: ${id})`);
                    } else {
                      debugLog(`✅ Upserted daily description for date ${dateStr} (id: ${id})`);
                    }
                    resolve();
                  }
                }
              );
            });
          } else {
            // Delete if empty and not a day off
            await new Promise((resolve, reject) => {
              db.run(
                'DELETE FROM daily_descriptions WHERE employeeId = ? AND date = ?',
                [employeeId, dateStr],
                function(deleteErr) {
                  if (deleteErr) {
                    debugError(`❌ Error deleting daily description for date ${dateStr}:`, deleteErr);
                    reject(deleteErr);
                  } else {
                    if (this.changes > 0) {
                      debugLog(`✅ Deleted empty daily description for date ${dateStr}`);
                    }
                    resolve();
                  }
                }
              );
            });
          }
        } catch (descError) {
          debugError(`❌ Error syncing daily description for date ${desc.date}:`, descError);
          // Continue with next entry instead of failing entire sync
        }
      }
    }
    
    // 2b. Sync time tracking and mileage entries from dailyEntries
    if (reportData.dailyEntries && reportData.dailyEntries.length > 0) {
      const costCenters = reportData.costCenters || [];
      
      for (const entry of reportData.dailyEntries) {
        try {
          // Parse the date to match the format in the database
          const dateStr = dateHelpers.normalizeDateString(entry.date);
          if (!dateStr) {
            debugWarn(`⚠️ Skipping daily entry with invalid date: ${entry.date}`);
            continue;
          }
          
          // Sync cost center hours from dailyEntries to time_tracking table
          // Check for costCenter0Hours, costCenter1Hours, etc.
          for (let i = 0; i < costCenters.length; i++) {
            const costCenterName = costCenters[i];
            const hoursProperty = `costCenter${i}Hours`;
            const hours = entry[hoursProperty] || 0;
            
            if (hours > 0) {
              // Create or update time_tracking entry for this cost center
              await new Promise((resolve, reject) => {
                // Check if entry already exists
                db.get(
                'SELECT id FROM time_tracking WHERE employeeId = ? AND date = ? AND costCenter = ? AND (category IS NULL OR category = "")',
                [employeeId, dateStr, costCenterName],
                (err, row) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  const now = new Date().toISOString();
                  
                  if (row) {
                    // Update existing entry
                    db.run(
                      'UPDATE time_tracking SET hours = ?, updatedAt = ? WHERE id = ?',
                      [hours, now, row.id],
                      (updateErr) => {
                        if (updateErr) reject(updateErr);
                        else {
                          debugLog(`✅ Updated time tracking for ${costCenterName} on ${dateStr}: ${hours} hours`);
                          resolve();
                        }
                      }
                    );
                  } else {
                    // Create new entry - use deterministic ID
                    const id = `time-${employeeId}-${dateStr}-costcenter-${i}`;
                    db.run(
                      'INSERT OR REPLACE INTO time_tracking (id, employeeId, date, category, hours, costCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM time_tracking WHERE id = ?), ?), ?)',
                      [id, employeeId, dateStr, '', hours, costCenterName, id, now, now],
                      (insertErr) => {
                        if (insertErr) {
                          debugError(`❌ Error creating time tracking for ${costCenterName} on ${dateStr}:`, insertErr);
                          reject(insertErr);
                        } else {
                          debugLog(`✅ Created time tracking for ${costCenterName} on ${dateStr}: ${hours} hours`);
                          resolve();
                        }
                      }
                    );
                  }
                }
              );
            });
          }
        }
          
        // Sync category hours (PTO, Holiday, etc.) if they exist
        if (entry.categoryHours && typeof entry.categoryHours === 'object') {
          // Iterate over all category keys in the categoryHours object
          for (const category of Object.keys(entry.categoryHours)) {
            const hours = entry.categoryHours[category] || 0;
            
            if (hours > 0) {
              await new Promise((resolve, reject) => {
                // Check if entry already exists
                db.get(
                  'SELECT id FROM time_tracking WHERE employeeId = ? AND date = ? AND category = ? AND (costCenter IS NULL OR costCenter = "")',
                  [employeeId, dateStr, category],
                  (err, row) => {
                    if (err) {
                      reject(err);
                      return;
                    }
                    
                    const now = new Date().toISOString();
                    
                    if (row) {
                      // Update existing entry
                      db.run(
                        'UPDATE time_tracking SET hours = ?, updatedAt = ? WHERE id = ?',
                        [hours, now, row.id],
                        (updateErr) => {
                          if (updateErr) reject(updateErr);
                          else {
                            debugLog(`✅ Updated time tracking for ${category} on ${dateStr}: ${hours} hours`);
                            resolve();
                          }
                        }
                      );
                    } else {
                      // Create new entry - use deterministic ID
                      const id = `time-${employeeId}-${dateStr}-category-${category}`;
                      db.run(
                        'INSERT OR REPLACE INTO time_tracking (id, employeeId, date, category, hours, costCenter, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM time_tracking WHERE id = ?), ?), ?)',
                        [id, employeeId, dateStr, category, hours, '', id, now, now],
                        (insertErr) => {
                          if (insertErr) {
                            debugError(`❌ Error creating time tracking for ${category} on ${dateStr}:`, insertErr);
                            reject(insertErr);
                          } else {
                            debugLog(`✅ Created time tracking for ${category} on ${dateStr}: ${hours} hours`);
                            resolve();
                          }
                        }
                      );
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
      
      // Sync mileage entries from dailyEntries to mileage_entries table
      for (const entry of reportData.dailyEntries) {
        try {
          // Parse the date to match the format in the database
          const dateStr = dateHelpers.normalizeDateString(entry.date);
          if (!dateStr) {
            debugWarn(`⚠️ Skipping mileage entry with invalid date: ${entry.date}`);
            continue;
          }
          
          // Only sync if there are miles traveled
          if (entry.milesTraveled && entry.milesTraveled > 0) {
            // Find the cost center for this date from dailyDescriptions
            let costCenterForDate = '';
            if (reportData.dailyDescriptions && reportData.dailyDescriptions.length > 0) {
              const descForDate = reportData.dailyDescriptions.find((desc) => {
                const descDateStr = dateHelpers.normalizeDateString(desc.date);
                return descDateStr === dateStr;
              });
              if (descForDate && descForDate.costCenter) {
                costCenterForDate = descForDate.costCenter;
              } else if (reportData.costCenters && reportData.costCenters.length > 0) {
                // Default to first cost center if no specific cost center is set
                costCenterForDate = reportData.costCenters[0];
              }
            } else if (reportData.costCenters && reportData.costCenters.length > 0) {
              // Default to first cost center if no daily descriptions
              costCenterForDate = reportData.costCenters[0];
            }
            
            // Get description from entry or daily description
            let purpose = entry.description || '';
            if (!purpose && reportData.dailyDescriptions) {
              const descForDate = reportData.dailyDescriptions.find((desc) => {
                const descDateStr = dateHelpers.normalizeDateString(desc.date);
                return descDateStr === dateStr;
              });
              if (descForDate && descForDate.description) {
                purpose = descForDate.description;
              }
            }
            
            // Create or update mileage entry
            await new Promise((resolve, reject) => {
              // Check if mileage entry already exists for this date and cost center
              db.get(
                'SELECT id FROM mileage_entries WHERE employeeId = ? AND date = ? AND costCenter = ?',
                [employeeId, dateStr, costCenterForDate],
                (err, row) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  const now = new Date().toISOString();
                  const miles = entry.milesTraveled || 0;
                  const odometerReading = entry.odometerEnd || entry.odometerStart || 0;
                  const startLocation = entry.odometerStart ? `Odometer: ${entry.odometerStart}` : '';
                  const endLocation = entry.odometerEnd ? `Odometer: ${entry.odometerEnd}` : '';
                  
                  if (row) {
                    // Update existing entry
                    db.run(
                      'UPDATE mileage_entries SET miles = ?, odometerReading = ?, startLocation = ?, endLocation = ?, purpose = ?, costCenter = ?, updatedAt = ? WHERE id = ?',
                      [miles, odometerReading, startLocation, endLocation, purpose, costCenterForDate, now, row.id],
                      (updateErr) => {
                        if (updateErr) reject(updateErr);
                        else {
                          debugLog(`✅ Updated mileage entry for ${costCenterForDate} on ${dateStr}: ${miles} miles`);
                          resolve();
                        }
                      }
                    );
                  } else {
                    // Create new entry - use deterministic ID
                    const id = `mileage-${employeeId}-${dateStr}-${costCenterForDate || 'default'}`;
                    // Get oxfordHouseId from employee data
                    db.get('SELECT oxfordHouseId FROM employees WHERE id = ?', [employeeId], (empErr, empRow) => {
                      if (empErr) {
                        debugError(`❌ Error fetching employee for mileage entry:`, empErr);
                        reject(empErr);
                        return;
                      }
                      
                      const oxfordHouseId = empRow?.oxfordHouseId || '';
                      db.run(
                        'INSERT OR REPLACE INTO mileage_entries (id, employeeId, oxfordHouseId, date, odometerReading, startLocation, endLocation, purpose, miles, costCenter, isGpsTracked, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM mileage_entries WHERE id = ?), ?), ?)',
                        [id, employeeId, oxfordHouseId, dateStr, odometerReading, startLocation, endLocation, purpose, miles, costCenterForDate, 0, id, now, now],
                        (insertErr) => {
                          if (insertErr) {
                            debugError(`❌ Error creating mileage entry for ${dateStr}:`, insertErr);
                            reject(insertErr);
                          } else {
                            debugLog(`✅ Created mileage entry for ${costCenterForDate} on ${dateStr}: ${miles} miles`);
                            resolve();
                          }
                        }
                      );
                    });
                  }
                }
              );
            });
          }
        } catch (mileageError) {
          debugError(`❌ Error syncing mileage entry for date ${entry.date}:`, mileageError);
          // Continue with next entry instead of failing entire sync
        }
      }
    }
    
    // 3. Sync receipts
    if (reportData.receipts && reportData.receipts.length > 0) {
      for (const receipt of reportData.receipts) {
        if (receipt.id) {
          // Update existing receipt
          await new Promise((resolve, reject) => {
            db.run(
              `UPDATE receipts 
               SET amount = ?, vendor = ?, category = ?, description = ?, updatedAt = datetime('now')
               WHERE id = ?`,
              [receipt.amount, receipt.vendor, receipt.category, receipt.description || '', receipt.id],
              (err) => {
                if (err) reject(err);
                else {
                  debugLog(`✅ Updated receipt ${receipt.id}`);
                  resolve();
                }
              }
            );
          });
        }
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
    
    res.json({ 
      success: true, 
      message: 'Report data synced successfully to source tables' 
    });
    
  } catch (error) {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack;
    
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
      const workflowInit = await initializeApprovalWorkflow(report);
      updateData.status = workflowInit.currentApprovalStage === 'finance' ? 'pending_finance' : 'pending_supervisor';
      updateData.submittedAt = nowIso;
      updateData.approvalWorkflow = JSON.stringify(workflowInit.workflow);
      updateData.currentApprovalStep = workflowInit.currentApprovalStep;
      updateData.currentApprovalStage = workflowInit.currentApprovalStage;
      updateData.currentApproverId = workflowInit.currentApproverId;
      updateData.currentApproverName = workflowInit.currentApproverName;
      updateData.escalationDueAt = workflowInit.escalationDueAt;
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
 * Handle approval workflow actions (approve, reject, delegate, remind, comment)
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

    const currentStepIndex = Number.isInteger(report.currentApprovalStep)
      ? report.currentApprovalStep
      : parseInt(report.currentApprovalStep || '0', 10) || 0;

    const currentStep = workflow[currentStepIndex];

    const updates = {
      status: report.status,
      currentApprovalStep: currentStepIndex,
      currentApprovalStage: report.currentApprovalStage || '',
      currentApproverId: report.currentApproverId || null,
      currentApproverName: report.currentApproverName || null,
      escalationDueAt: report.escalationDueAt || null,
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
        if (!currentStep) {
          res.status(400).json({ error: 'No active approval step' });
          return;
        }
        if (!approverId) {
          res.status(400).json({ error: 'Approver ID is required' });
          return;
        }

        const allowedApproverIds = new Set();
        if (currentStep.approverId) allowedApproverIds.add(currentStep.approverId);
        if (currentStep.delegatedToId) allowedApproverIds.add(currentStep.delegatedToId);

        if (currentStep.role === 'finance' && (!currentStep.approverId || currentStep.approverId === 'finance-team')) {
          const approver = await dbService.getEmployeeById(approverId);
          if (approver && helpers.isFinancePosition(approver.position)) {
            allowedApproverIds.add(approverId);
            currentStep.approverName = approver.preferredName || approver.name || approverName || 'Finance';
          }
        }

        if (allowedApproverIds.size === 0 && currentStep.role === 'finance') {
          // If finance step without designated approver, allow provided approver if finance
          const approver = await dbService.getEmployeeById(approverId);
          if (approver && helpers.isFinancePosition(approver.position)) {
            allowedApproverIds.add(approverId);
            currentStep.approverName = approver.preferredName || approver.name || approverName || 'Finance';
          }
        }

        if (!allowedApproverIds.has(approverId)) {
          res.status(403).json({ error: 'Approver is not authorized for this step' });
          return;
        }

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

        if (workflow[nextStepIndex]) {
          const nextStep = workflow[nextStepIndex];
          nextStep.status = 'pending';
          nextStep.dueAt = helpers.computeEscalationDueAt(nextStep.role === 'finance' ? constants.FINANCE_ESCALATION_HOURS : constants.SUPERVISOR_ESCALATION_HOURS);

          newStatus = `pending_${nextStep.role}`;
          nextStage = nextStep.role;
          nextApproverId = nextStep.approverId || null;
          nextApproverName = nextStep.approverName || null;
          escalationDueAt = nextStep.dueAt;

          updates.currentApprovalStep = nextStepIndex;
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

        currentStep.status = 'rejected';
        currentStep.actedAt = nowIso;
        currentStep.comments = comments;
        workflow[currentStepIndex] = currentStep;

        updates.status = 'needs_revision';
        updates.currentApprovalStage = 'needs_revision';
        updates.currentApproverId = null;
        updates.currentApproverName = null;
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

module.exports = router;

