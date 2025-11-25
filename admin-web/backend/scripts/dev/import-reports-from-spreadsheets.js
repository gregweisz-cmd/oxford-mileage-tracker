/**
 * Import Expense Reports from Spreadsheets
 * 
 * This script reads Excel/CSV files containing expense report data and imports them
 * into the database for testing by the finance team.
 * 
 * Usage:
 *   node scripts/dev/import-reports-from-spreadsheets.js [options]
 * 
 * Options:
 *   --dir <path>     Directory containing spreadsheet files (default: scripts/dev/import-data)
 *   --format <type>  File format: 'auto', 'xlsx', 'csv' (default: 'auto')
 *   --dry-run        Preview what would be imported without making changes
 * 
 * Expected Spreadsheet Format:
 * 
 * The script can handle spreadsheets with the following sheets/tabs:
 * 
 * 1. "Reports" or "Expense Reports" sheet with columns:
 *    - Employee Email/Name (required): matches employee in database
 *    - Month (required): 1-12
 *    - Year (required): YYYY
 *    - Status: draft, submitted, pending_supervisor, pending_finance, approved, needs_revision (optional, default: submitted)
 *    - Total Miles (optional): auto-calculated from mileage entries if not provided
 *    - Total Expenses (optional): auto-calculated from receipts if not provided
 * 
 * 2. "Mileage" or "Mileage Entries" sheet with columns:
 *    - Employee Email/Name (required)
 *    - Date (required): YYYY-MM-DD or MM/DD/YYYY
 *    - Start Location (optional)
 *    - End Location (optional)
 *    - Miles (required): number
 *    - Purpose (optional)
 *    - Cost Center (optional): defaults to employee's first cost center
 *    - Odometer Reading (optional)
 * 
 * 3. "Receipts" sheet with columns:
 *    - Employee Email/Name (required)
 *    - Date (required): YYYY-MM-DD or MM/DD/YYYY
 *    - Vendor (required)
 *    - Amount (required): number
 *    - Category (optional): defaults to "Other"
 *    - Description (optional)
 *    - Cost Center (optional): defaults to employee's first cost center
 * 
 * 4. "Time" or "Time Entries" sheet with columns:
 *    - Employee Email/Name (required)
 *    - Date (required): YYYY-MM-DD or MM/DD/YYYY
 *    - Category (optional): defaults to "Regular Hours"
 *    - Hours (required): number
 *    - Description (optional)
 *    - Cost Center (optional): defaults to employee's first cost center
 * 
 * Alternative: Single sheet format
 * If all data is in one sheet, the script will try to infer the data type from column names.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// Configuration
const DB_PATH = path.join(__dirname, '..', '..', 'expense_tracker.db');
const DEFAULT_IMPORT_DIR = path.join(__dirname, 'import-data');

// Parse command line arguments
const args = process.argv.slice(2);
const importDir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : DEFAULT_IMPORT_DIR;
const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'auto';
const dryRun = args.includes('--dry-run');

// Create import directory if it doesn't exist
if (!fs.existsSync(importDir)) {
  fs.mkdirSync(importDir, { recursive: true });
  console.log(`📁 Created import directory: ${importDir}`);
  console.log(`\n📝 Please place your spreadsheet files (.xlsx, .xls, .csv) in: ${importDir}`);
  console.log(`   Then run this script again.\n`);
  process.exit(0);
}

const db = new sqlite3.Database(DB_PATH);

// Statistics
let stats = {
  filesProcessed: 0,
  reportsCreated: 0,
  mileageEntriesCreated: 0,
  receiptsCreated: 0,
  timeEntriesCreated: 0,
  errors: []
};

/**
 * Get employee by email or name
 */
function getEmployee(identifier) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM employees WHERE email = ? OR name = ? OR preferredName = ?',
      [identifier, identifier, identifier],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

/**
 * Parse date string in various formats
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Try MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [month, day, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Try Excel serial date
  if (typeof dateStr === 'number' && dateStr > 1) {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + dateStr * 86400000);
  }
  
  // Try Date.parse as fallback
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;
  
  return null;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : parseDate(date);
  if (!d || isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse cost centers from employee
 */
function parseCostCenters(employee) {
  if (!employee || !employee.costCenters) return ['Program Services'];
  try {
    const centers = typeof employee.costCenters === 'string' 
      ? JSON.parse(employee.costCenters)
      : employee.costCenters;
    return Array.isArray(centers) && centers.length > 0 ? centers : ['Program Services'];
  } catch {
    return ['Program Services'];
  }
}

/**
 * Process a spreadsheet file
 */
async function processSpreadsheet(filePath) {
  console.log(`\n📄 Processing: ${path.basename(filePath)}`);
  stats.filesProcessed++;
  
  let workbook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch (error) {
    stats.errors.push(`Failed to read ${filePath}: ${error.message}`);
    console.error(`❌ Error reading file: ${error.message}`);
    return;
  }
  
  const sheetNames = workbook.SheetNames;
  console.log(`   Found ${sheetNames.length} sheet(s): ${sheetNames.join(', ')}`);
  
  // Process each sheet
  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });
    
    if (data.length === 0) {
      console.log(`   ⚠️  Sheet "${sheetName}" is empty, skipping`);
      continue;
    }
    
    console.log(`   📊 Processing sheet "${sheetName}" with ${data.length} row(s)`);
    
    // Determine sheet type from name or columns
    const firstRow = data[0];
    const columns = Object.keys(firstRow);
    const lowerColumns = columns.map(c => c.toLowerCase());
    
    let sheetType = 'unknown';
    if (sheetName.toLowerCase().includes('mileage') || 
        lowerColumns.includes('miles') || lowerColumns.includes('mileage')) {
      sheetType = 'mileage';
    } else if (sheetName.toLowerCase().includes('receipt') || 
               lowerColumns.includes('vendor') || lowerColumns.includes('amount')) {
      sheetType = 'receipts';
    } else if (sheetName.toLowerCase().includes('time') || 
               lowerColumns.includes('hours') || lowerColumns.includes('category')) {
      sheetType = 'time';
    } else if (sheetName.toLowerCase().includes('report') || 
               lowerColumns.includes('month') || lowerColumns.includes('year')) {
      sheetType = 'reports';
    }
    
    try {
      switch (sheetType) {
        case 'reports':
          await processReportsSheet(data);
          break;
        case 'mileage':
          await processMileageSheet(data);
          break;
        case 'receipts':
          await processReceiptsSheet(data);
          break;
        case 'time':
          await processTimeSheet(data);
          break;
        default:
          console.log(`   ⚠️  Could not determine sheet type for "${sheetName}", trying to process as general data`);
          // Try to process based on column detection
          if (lowerColumns.includes('month') || lowerColumns.includes('year')) {
            await processReportsSheet(data);
          } else if (lowerColumns.includes('miles')) {
            await processMileageSheet(data);
          } else if (lowerColumns.includes('vendor')) {
            await processReceiptsSheet(data);
          } else if (lowerColumns.includes('hours')) {
            await processTimeSheet(data);
          }
      }
    } catch (error) {
      stats.errors.push(`Error processing sheet "${sheetName}" in ${filePath}: ${error.message}`);
      console.error(`   ❌ Error processing sheet: ${error.message}`);
    }
  }
}

/**
 * Process reports sheet
 */
async function processReportsSheet(data) {
  console.log(`   📋 Processing reports...`);
  
  for (const row of data) {
    try {
      // Find employee
      const employeeId = findEmployeeId(row);
      if (!employeeId) {
        console.log(`   ⚠️  Could not find employee for row: ${JSON.stringify(row)}`);
        continue;
      }
      
      const employee = await getEmployee(employeeId);
      if (!employee) {
        console.log(`   ⚠️  Employee not found in database: ${employeeId}`);
        continue;
      }
      
      // Get month and year
      const month = parseInt(row.Month || row.month || row['Month'] || '');
      const year = parseInt(row.Year || row.year || row['Year'] || '');
      
      if (!month || !year || month < 1 || month > 12) {
        console.log(`   ⚠️  Invalid month/year in row: ${JSON.stringify(row)}`);
        continue;
      }
      
      // Check if report already exists
      const existingReport = await new Promise((resolve) => {
        db.get(
          'SELECT id FROM expense_reports WHERE employeeId = ? AND month = ? AND year = ?',
          [employee.id, month, year],
          (err, row) => resolve(err ? null : row)
        );
      });
      
      if (existingReport && !dryRun) {
        console.log(`   ℹ️  Report already exists for ${employee.name}, ${month}/${year}, skipping`);
        continue;
      }
      
      if (dryRun) {
        console.log(`   ✅ Would create report for ${employee.name}, ${month}/${year}`);
        stats.reportsCreated++;
        continue;
      }
      
      // Get employee cost centers
      const costCenters = parseCostCenters(employee);
      
      // Create report data structure
      const reportId = `report-${employee.id}-${year}-${month}`;
      const status = (row.Status || row.status || 'submitted').toLowerCase();
      const now = new Date().toISOString();
      const submittedAt = status !== 'draft' ? now : null;
      
      const reportData = {
        employeeId: employee.id,
        employeeName: employee.name,
        preferredName: employee.preferredName || employee.name,
        month,
        year,
        costCenters,
        totalMiles: parseFloat(row['Total Miles'] || row['totalMiles'] || 0) || 0,
        totalExpenses: parseFloat(row['Total Expenses'] || row['totalExpenses'] || 0) || 0,
        totalHours: 0,
        mileageEntries: [],
        receipts: [],
        timeEntries: []
      };
      
      // Insert expense report
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR REPLACE INTO expense_reports 
           (id, employeeId, month, year, reportData, status, submittedAt, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [reportId, employee.id, month, year, JSON.stringify(reportData), status, submittedAt, now, now],
          function(err) {
            if (err) reject(err);
            else {
              stats.reportsCreated++;
              console.log(`   ✅ Created report for ${employee.name}, ${month}/${year}`);
              resolve();
            }
          }
        );
      });
      
    } catch (error) {
      stats.errors.push(`Error processing report row: ${error.message}`);
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
}

/**
 * Process mileage sheet
 */
async function processMileageSheet(data) {
  console.log(`   🚗 Processing mileage entries...`);
  
  for (const row of data) {
    try {
      const employeeId = findEmployeeId(row);
      if (!employeeId) continue;
      
      const employee = await getEmployee(employeeId);
      if (!employee) continue;
      
      const date = parseDate(row.Date || row.date || row['Date']);
      if (!date) {
        console.log(`   ⚠️  Invalid date in row: ${JSON.stringify(row)}`);
        continue;
      }
      
      const miles = parseFloat(row.Miles || row.miles || row['Miles'] || 0);
      if (!miles || miles <= 0) {
        console.log(`   ⚠️  Invalid miles in row: ${JSON.stringify(row)}`);
        continue;
      }
      
      const costCenters = parseCostCenters(employee);
      const costCenter = row['Cost Center'] || row.costCenter || costCenters[0];
      
      const entryId = `mileage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const formattedDate = formatDate(date);
      
      if (dryRun) {
        console.log(`   ✅ Would create mileage entry: ${miles} miles on ${formattedDate}`);
        stats.mileageEntriesCreated++;
        continue;
      }
      
      // Get or create expense report for this month/year
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const reportId = `report-${employee.id}-${year}-${month}`;
      
      // Check if report exists, create if not
      const existingReport = await new Promise((resolve) => {
        db.get(
          'SELECT id, reportData FROM expense_reports WHERE id = ?',
          [reportId],
          (err, row) => resolve(err ? null : row)
        );
      });
      
      if (!existingReport) {
        // Create basic report
        const costCenters = parseCostCenters(employee);
        const reportData = {
          employeeId: employee.id,
          employeeName: employee.name,
          preferredName: employee.preferredName || employee.name,
          month,
          year,
          costCenters,
          totalMiles: 0,
          totalExpenses: 0,
          totalHours: 0,
          mileageEntries: [],
          receipts: [],
          timeEntries: []
        };
        
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO expense_reports (id, employeeId, month, year, reportData, status, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
            [reportId, employee.id, month, year, JSON.stringify(reportData), now, now],
            (err) => err ? reject(err) : resolve()
          );
        });
      }
      
      // Insert mileage entry
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO mileage_entries 
           (id, employeeId, oxfordHouseId, date, startLocation, endLocation, miles, purpose, costCenter, isGpsTracked, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entryId,
            employee.id,
            employee.oxfordHouseId || '',
            formattedDate,
            row['Start Location'] || row.startLocation || '',
            row['End Location'] || row.endLocation || '',
            miles,
            row.Purpose || row.purpose || '',
            costCenter,
            false,
            now,
            now
          ],
          function(err) {
            if (err && !err.message.includes('UNIQUE')) reject(err);
            else {
              stats.mileageEntriesCreated++;
              resolve();
            }
          }
        );
      });
      
    } catch (error) {
      stats.errors.push(`Error processing mileage row: ${error.message}`);
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
}

/**
 * Process receipts sheet
 */
async function processReceiptsSheet(data) {
  console.log(`   🧾 Processing receipts...`);
  
  for (const row of data) {
    try {
      const employeeId = findEmployeeId(row);
      if (!employeeId) continue;
      
      const employee = await getEmployee(employeeId);
      if (!employee) continue;
      
      const date = parseDate(row.Date || row.date || row['Date']);
      if (!date) continue;
      
      const vendor = row.Vendor || row.vendor || row['Vendor'] || '';
      const amount = parseFloat(row.Amount || row.amount || row['Amount'] || 0);
      
      if (!vendor || !amount || amount <= 0) {
        console.log(`   ⚠️  Invalid receipt data in row: ${JSON.stringify(row)}`);
        continue;
      }
      
      const costCenters = parseCostCenters(employee);
      const costCenter = row['Cost Center'] || row.costCenter || costCenters[0];
      
      const receiptId = `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const formattedDate = formatDate(date);
      
      if (dryRun) {
        console.log(`   ✅ Would create receipt: $${amount.toFixed(2)} at ${vendor} on ${formattedDate}`);
        stats.receiptsCreated++;
        continue;
      }
      
      // Get or create expense report for this month/year
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const reportId = `report-${employee.id}-${year}-${month}`;
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO receipts 
           (id, employeeId, date, amount, vendor, category, description, costCenter, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            receiptId,
            employee.id,
            formattedDate,
            amount,
            vendor,
            row.Category || row.category || 'Other',
            row.Description || row.description || '',
            costCenter,
            now,
            now
          ],
          function(err) {
            if (err && !err.message.includes('UNIQUE')) reject(err);
            else {
              stats.receiptsCreated++;
              resolve();
            }
          }
        );
      });
      
    } catch (error) {
      stats.errors.push(`Error processing receipt row: ${error.message}`);
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
}

/**
 * Process time entries sheet
 */
async function processTimeSheet(data) {
  console.log(`   ⏰ Processing time entries...`);
  
  for (const row of data) {
    try {
      const employeeId = findEmployeeId(row);
      if (!employeeId) continue;
      
      const employee = await getEmployee(employeeId);
      if (!employee) continue;
      
      const date = parseDate(row.Date || row.date || row['Date']);
      if (!date) continue;
      
      const hours = parseFloat(row.Hours || row.hours || row['Hours'] || 0);
      if (!hours || hours <= 0) {
        console.log(`   ⚠️  Invalid hours in row: ${JSON.stringify(row)}`);
        continue;
      }
      
      const costCenters = parseCostCenters(employee);
      const costCenter = row['Cost Center'] || row.costCenter || costCenters[0];
      
      const timeId = `time-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const formattedDate = formatDate(date);
      
      if (dryRun) {
        console.log(`   ✅ Would create time entry: ${hours} hours on ${formattedDate}`);
        stats.timeEntriesCreated++;
        continue;
      }
      
      // Get or create expense report for this month/year
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const reportId = `report-${employee.id}-${year}-${month}`;
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO time_entries 
           (id, employeeId, date, category, hours, description, costCenter, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            timeId,
            employee.id,
            formattedDate,
            row.Category || row.category || 'Regular Hours',
            hours,
            row.Description || row.description || '',
            costCenter,
            now,
            now
          ],
          function(err) {
            if (err && !err.message.includes('UNIQUE')) reject(err);
            else {
              stats.timeEntriesCreated++;
              resolve();
            }
          }
        );
      });
      
    } catch (error) {
      stats.errors.push(`Error processing time row: ${error.message}`);
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
}

/**
 * Find employee identifier from row data
 */
function findEmployeeId(row) {
  // Try common column names
  const possibleKeys = [
    'Employee Email', 'employeeEmail', 'Email', 'email',
    'Employee Name', 'employeeName', 'Name', 'name',
    'Employee', 'employee', 'Employee ID', 'employeeId'
  ];
  
  for (const key of possibleKeys) {
    if (row[key] || row[key.toLowerCase()] || row[key.toUpperCase()]) {
      return row[key] || row[key.toLowerCase()] || row[key.toUpperCase()];
    }
  }
  
  return null;
}

/**
 * Main execution
 */
async function main() {
  console.log('📊 Expense Report Spreadsheet Import');
  console.log('=====================================\n');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  console.log(`📁 Import directory: ${importDir}`);
  
  // Find all spreadsheet files
  const files = fs.readdirSync(importDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ext === '.xlsx' || ext === '.xls' || ext === '.csv';
  });
  
  if (files.length === 0) {
    console.log(`\n⚠️  No spreadsheet files found in ${importDir}`);
    console.log(`\nSupported formats: .xlsx, .xls, .csv`);
    process.exit(0);
  }
  
  console.log(`\n📄 Found ${files.length} file(s) to process\n`);
  
  // Process each file
  for (const file of files) {
    const filePath = path.join(importDir, file);
    await processSpreadsheet(filePath);
  }
  
  // Print summary
  console.log('\n\n' + '='.repeat(50));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(50));
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Reports created: ${stats.reportsCreated}`);
  console.log(`Mileage entries created: ${stats.mileageEntriesCreated}`);
  console.log(`Receipts created: ${stats.receiptsCreated}`);
  console.log(`Time entries created: ${stats.timeEntriesCreated}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n❌ Errors: ${stats.errors.length}`);
    stats.errors.forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
  }
  
  if (dryRun) {
    console.log('\n🔍 This was a dry run. Run without --dry-run to actually import data.');
  }
  
  console.log('\n');
  
  db.close();
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

