/**
 * Script to create expense report records for Greg Weisz for January-April 2025
 * This will aggregate the mileage, receipts, and time tracking data into expense reports
 */

const dbService = require('../../services/dbService');
const { debugLog, debugError } = require('../../debug');

const employeeId = 'greg-weisz-001';
const months = [
  { month: 1, year: 2025 }
];

function generateId(prefix = '') {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

function getNow() {
  return new Date().toISOString();
}

// Get totals for a month
function getMonthTotals(month, year) {
  return new Promise((resolve, reject) => {
    const db = dbService.getDb();
    const monthStr = String(month).padStart(2, '0');
    
    // Get mileage total and unique cost centers
    db.all(`
      SELECT DISTINCT costCenter, COALESCE(SUM(miles), 0) as miles
      FROM mileage_entries
      WHERE employeeId = ? 
      AND (
        (date LIKE '%-%-%' AND strftime('%m', date) = ? AND strftime('%Y', date) = ?)
        OR (date LIKE '%/%/%' AND CAST(SUBSTR(date, 1, 2) AS INTEGER) = ? AND SUBSTR(date, 7) = ?)
      )
      AND costCenter IS NOT NULL
      GROUP BY costCenter
    `, [employeeId, monthStr, String(year), month, String(year).slice(-2)], (err, mileageRows) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Calculate total miles and get unique cost centers
      const totalMiles = mileageRows.reduce((sum, row) => sum + (row.miles || 0), 0);
      const costCenters = mileageRows.map(row => row.costCenter).filter(cc => cc);
      
      // Get receipts total (if receipts table exists)
      db.get(`
        SELECT COALESCE(SUM(amount), 0) as totalReceipts
        FROM receipts
        WHERE employeeId = ?
        AND (
          (date LIKE '%-%-%' AND strftime('%m', date) = ? AND strftime('%Y', date) = ?)
          OR (date LIKE '%/%/%' AND CAST(SUBSTR(date, 1, 2) AS INTEGER) = ? AND SUBSTR(date, 7) = ?)
        )
      `, [employeeId, monthStr, String(year), month, String(year).slice(-2)], (err, receiptRow) => {
        if (err) {
          // If receipts table doesn't exist or error, just use 0
          const mileageAmount = totalMiles * 0.445;
          resolve({
            totalMiles: totalMiles,
            mileageAmount: mileageAmount,
            totalReceipts: 0,
            totalExpenses: mileageAmount,
            costCenters: costCenters
          });
          return;
        }
        
        // Calculate mileage amount (at $0.445 per mile based on the reports)
        const mileageAmount = totalMiles * 0.445;
        const totalExpenses = mileageAmount + (receiptRow?.totalReceipts || 0);
        
        resolve({
          totalMiles: totalMiles,
          mileageAmount: mileageAmount,
          totalReceipts: receiptRow?.totalReceipts || 0,
          totalExpenses: totalExpenses,
          costCenters: costCenters
        });
      });
    });
  });
}

// Create expense report for a month
function createExpenseReport(month, year, totals) {
  return new Promise((resolve, reject) => {
    const db = dbService.getDb();
    const reportId = `report-${employeeId}-${year}-${month}`;
    const now = getNow();
    
    // Check if report already exists
    db.get('SELECT id FROM expense_reports WHERE employeeId = ? AND month = ? AND year = ?', 
      [employeeId, month, year], (err, existing) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (existing) {
          debugLog(`⚠️ Report already exists for ${month}/${year}, updating...`);
          // Update existing report
          const reportData = {
            employeeId: employeeId,
            month: month,
            year: year,
            totalMiles: totals.totalMiles,
            totalMileageAmount: totals.mileageAmount,
            totalReceipts: totals.totalReceipts,
            totalExpenses: totals.totalExpenses,
            costCenters: totals.costCenters || []
          };
          
          db.run(`
            UPDATE expense_reports 
            SET reportData = ?, updatedAt = ?
            WHERE employeeId = ? AND month = ? AND year = ?
          `, [JSON.stringify(reportData), now, employeeId, month, year], (updateErr) => {
            if (updateErr) {
              reject(updateErr);
            } else {
              debugLog(`✅ Updated expense report for ${month}/${year}: ${totals.totalMiles.toFixed(1)} miles, $${totals.totalExpenses.toFixed(2)} total, cost centers: ${(totals.costCenters || []).join(', ')}`);
              resolve();
            }
          });
        } else {
          // Create minimal reportData structure
          const reportData = {
            employeeId: employeeId,
            month: month,
            year: year,
            totalMiles: totals.totalMiles,
            totalMileageAmount: totals.mileageAmount,
            totalReceipts: totals.totalReceipts,
            totalExpenses: totals.totalExpenses,
            costCenters: totals.costCenters || []
          };
          
          db.run(`
            INSERT INTO expense_reports (
              id, employeeId, month, year, reportData, status, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)
          `, [
            reportId,
            employeeId,
            month,
            year,
            JSON.stringify(reportData),
            now,
            now
          ], function(insertErr) {
            if (insertErr) {
              reject(insertErr);
            } else {
              debugLog(`✅ Created expense report for ${month}/${year}: ${totals.totalMiles.toFixed(1)} miles, $${totals.totalExpenses.toFixed(2)} total`);
              resolve();
            }
          });
        }
      });
  });
}

// Main execution
async function main() {
  try {
    await dbService.initDatabase();
    debugLog('🚀 Creating expense report for Greg Weisz (January 2025)...\n');
    
    for (const { month, year } of months) {
      const totals = await getMonthTotals(month, year);
      await createExpenseReport(month, year, totals);
    }
    
    debugLog('\n✅ Expense report created successfully!');
    process.exit(0);
    
  } catch (error) {
    debugError('❌ Error:', error);
    process.exit(1);
  }
}

main();

