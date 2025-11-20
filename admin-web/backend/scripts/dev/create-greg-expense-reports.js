/**
 * Script to create expense report records for Greg Weisz for January-April 2025
 * This will aggregate the mileage, receipts, and time tracking data into expense reports
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(DB_PATH);

const employeeId = 'greg-weisz-001';
const months = [
  { month: 1, year: 2025 },
  { month: 2, year: 2025 },
  { month: 3, year: 2025 },
  { month: 4, year: 2025 }
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
    const monthStr = String(month).padStart(2, '0');
    
    // Get mileage total
    db.get(`
      SELECT COALESCE(SUM(miles), 0) as totalMiles
      FROM mileage_entries
      WHERE employeeId = ? 
      AND strftime('%m', date) = ?
      AND strftime('%Y', date) = ?
    `, [employeeId, monthStr, String(year)], (err, mileageRow) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Get receipts total
      db.get(`
        SELECT COALESCE(SUM(amount), 0) as totalReceipts
        FROM receipts
        WHERE employeeId = ?
        AND strftime('%m', date) = ?
        AND strftime('%Y', date) = ?
      `, [employeeId, monthStr, String(year)], (err, receiptRow) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Calculate mileage amount (at $0.445 per mile based on the reports)
        const mileageAmount = (mileageRow.totalMiles || 0) * 0.445;
        const totalExpenses = mileageAmount + (receiptRow.totalReceipts || 0);
        
        resolve({
          totalMiles: mileageRow.totalMiles || 0,
          mileageAmount: mileageAmount,
          totalReceipts: receiptRow.totalReceipts || 0,
          totalExpenses: totalExpenses
        });
      });
    });
  });
}

// Create expense report for a month
function createExpenseReport(month, year, totals) {
  return new Promise((resolve, reject) => {
    const reportId = generateId('report-');
    const now = getNow();
    
    // Create minimal reportData structure
    const reportData = {
      totalMiles: totals.totalMiles,
      totalMileageAmount: totals.mileageAmount,
      totalReceipts: totals.totalReceipts,
      totalExpenses: totals.totalExpenses
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
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        console.log(`✅ Created expense report for ${month}/${year}: ${totals.totalMiles.toFixed(1)} miles, $${totals.totalExpenses.toFixed(2)} total`);
        resolve();
      }
    });
  });
}

// Main execution
async function main() {
  try {
    console.log('🚀 Creating expense reports for Greg Weisz (January-April 2025)...\n');
    
    for (const { month, year } of months) {
      const totals = await getMonthTotals(month, year);
      await createExpenseReport(month, year, totals);
    }
    
    console.log('\n✅ All expense reports created successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    db.close();
  }
}

main();

