/**
 * Load Year of Reports for Demo
 * 
 * This script generates a full year of realistic expense reports, mileage entries,
 * receipts, and time tracking data for multiple employees.
 * 
 * Usage:
 *   node scripts/dev/load-year-of-reports.js
 * 
 * Options:
 *   - You can provide Excel/CSV files in a specific format (see README)
 *   - Or let it auto-generate realistic data for all employees
 * 
 * Generated data includes:
 *   - Monthly reports for past 12 months
 *   - Mileage entries (GPS tracked and manual)
 *   - Receipts with realistic vendors and categories
 *   - Time tracking entries
 *   - Various report statuses (draft, submitted, approved, rejected)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const dbPath = path.join(__dirname, '..', '..', 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

// Configuration
const START_YEAR = 2024;
const END_YEAR = new Date().getFullYear();
const MONTHS_TO_GENERATE = 12; // Past 12 months

// Realistic data pools
const START_LOCATIONS = [
  'Oxford House Main Office',
  'Home Office',
  'Client Office',
  'Field Location',
  'Conference Center',
  'Training Facility'
];

const END_LOCATIONS = [
  'Client Site A',
  'Client Site B',
  'Client Site C',
  'Meeting Location',
  'Vendor Location',
  'Training Site',
  'Office Depot',
  'Gas Station',
  'Restaurant'
];

const PURPOSES = [
  'Client meeting',
  'Site visit',
  'Training session',
  'Conference attendance',
  'Field work',
  'Equipment pickup',
  'Networking event',
  'Client consultation',
  'Project review',
  'Staff meeting',
  'Training delivery',
  'Assessment visit'
];

const VENDORS = [
  'Shell', 'BP', 'Exxon', 'Chevron', 'Walmart',
  'Target', 'Office Depot', 'Staples', 'Amazon',
  'Home Depot', 'Lowe\'s', 'Best Buy', 'CVS',
  'Walgreens', 'Subway', 'McDonald\'s', 'Starbucks',
  'Panera Bread', 'FedEx Office', 'UPS Store'
];

const RECEIPT_CATEGORIES = [
  'Gas', 'Office Supplies', 'Meals', 'Parking', 'Tolls',
  'Hotel', 'Air Travel', 'Ground Transportation', 'Phone/Internet',
  'Shipping/Postage', 'Printing/Copying', 'Training', 'Equipment'
];

const TIME_CATEGORIES = [
  'Regular Hours', 'Overtime', 'Travel Time', 'Training',
  'Administrative', 'Client Services', 'Meetings', 'Project Work'
];

/**
 * Generate a random number between min and max
 */
function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get a random item from an array
 */
function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a date within a month
 */
function randomDateInMonth(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = random(1, daysInMonth);
  return new Date(year, month - 1, day);
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Generate realistic mileage entry
 */
function generateMileageEntry(employeeId, oxfordHouseId, date, odometerStart, costCenters) {
  const miles = random(5, 85);
  const isGpsTracked = Math.random() > 0.4; // 60% GPS tracked
  const startLocation = randomItem(START_LOCATIONS);
  const endLocation = randomItem(END_LOCATIONS);
  const purpose = randomItem(PURPOSES);
  
  // Use employee's cost center (randomly select from their assigned cost centers)
  const costCenter = costCenters && costCenters.length > 0 
    ? randomItem(costCenters) 
    : 'Program Services';
  
  return {
    id: `mileage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    employeeId,
    oxfordHouseId,
    date: formatDate(date),
    odometerReading: odometerStart + miles,
    startLocation,
    endLocation,
    miles,
    purpose,
    notes: Math.random() > 0.7 ? `Notes: ${purpose}` : null,
    hoursWorked: random(1, 8),
    isGpsTracked: isGpsTracked ? 1 : 0,
    costCenter: costCenter,
    startLocationName: startLocation,
    startLocationAddress: `${random(100, 9999)} Main St`,
    startLocationLat: isGpsTracked ? (39.9 + Math.random() * 0.5) : 0,
    startLocationLng: isGpsTracked ? (-83.0 - Math.random() * 0.5) : 0,
    endLocationName: endLocation,
    endLocationAddress: `${random(100, 9999)} Oak Ave`,
    endLocationLat: isGpsTracked ? (39.9 + Math.random() * 0.5) : 0,
    endLocationLng: isGpsTracked ? (-83.0 - Math.random() * 0.5) : 0
  };
}

/**
 * Generate realistic receipt
 */
function generateReceipt(employeeId, date, costCenters) {
  const vendor = randomItem(VENDORS);
  const category = randomItem(RECEIPT_CATEGORIES);
  const amount = parseFloat((Math.random() * 150 + 5).toFixed(2));
  
  let description = `${category} - ${vendor}`;
  if (category === 'Meals') {
    description = `Business meal at ${vendor}`;
  } else if (category === 'Gas') {
    description = `Gas - ${vendor}`;
  } else if (category === 'Office Supplies') {
    description = `Office supplies from ${vendor}`;
  }
  
  // Use employee's cost center (randomly select from their assigned cost centers)
  const costCenter = costCenters && costCenters.length > 0 
    ? randomItem(costCenters) 
    : 'Program Services';
  
  return {
    id: `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    employeeId,
    date: formatDate(date),
    amount,
    vendor,
    category,
    description,
    costCenter: costCenter,
    imageUri: null // Could add test image URIs if needed
  };
}

/**
 * Generate realistic time entry
 */
function generateTimeEntry(employeeId, date, costCenters) {
  const category = randomItem(TIME_CATEGORIES);
  const hours = parseFloat((Math.random() * 8 + 1).toFixed(2));
  
  // Use employee's cost center (randomly select from their assigned cost centers)
  const costCenter = costCenters && costCenters.length > 0 
    ? randomItem(costCenters) 
    : 'Program Services';
  
  return {
    id: `time-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    employeeId,
    date: formatDate(date),
    category,
    hours,
    description: `${category} work`,
    costCenter: costCenter
  };
}

/**
 * Generate monthly report for an employee
 */
async function generateMonthlyReport(employeeId, employeeName, oxfordHouseId, month, year, costCenters) {
  const now = new Date().toISOString();
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Determine report status based on month (older = more likely approved)
  let status = 'draft';
  const monthAge = (END_YEAR * 12 + new Date().getMonth() + 1) - (year * 12 + month);
  
  if (monthAge >= 3) {
    status = Math.random() > 0.1 ? 'approved' : 'submitted';
  } else if (monthAge >= 1) {
    status = Math.random() > 0.4 ? 'submitted' : 'draft';
  } else {
    status = Math.random() > 0.7 ? 'submitted' : 'draft';
  }
  
  // Generate data
  const mileageEntries = [];
  const receipts = [];
  const timeEntries = [];
  
  // Generate 10-20 mileage entries
  const numMileageEntries = random(10, 20);
  let odometerReading = 50000 + random(0, 10000); // Start with varied odometer reading
  
  // Generate entries spread throughout the month (not all on same day)
  const entryDays = [];
  for (let i = 0; i < numMileageEntries; i++) {
    const day = random(1, daysInMonth);
    entryDays.push(day);
  }
  entryDays.sort((a, b) => a - b); // Sort chronologically
  
  for (let i = 0; i < numMileageEntries; i++) {
    const entryDate = new Date(year, month - 1, entryDays[i]);
    const entry = generateMileageEntry(employeeId, oxfordHouseId, entryDate, odometerReading, costCenters);
    // Update odometer reading after this trip
    odometerReading += entry.miles;
    entry.odometerReading = odometerReading;
    // Add some gap between trips
    odometerReading += random(5, 30);
    mileageEntries.push(entry);
  }
  
  // Generate 8-15 receipts, spread throughout month
  const numReceipts = random(8, 15);
  const receiptDays = [];
  for (let i = 0; i < numReceipts; i++) {
    const day = random(1, daysInMonth);
    receiptDays.push(day);
  }
  receiptDays.sort((a, b) => a - b);
  
  for (let i = 0; i < numReceipts; i++) {
    const receiptDate = new Date(year, month - 1, receiptDays[i]);
    receipts.push(generateReceipt(employeeId, receiptDate, costCenters));
  }
  
  // Generate 15-25 time entries, spread throughout month (workdays only)
  const numTimeEntries = random(15, 25);
  for (let i = 0; i < numTimeEntries; i++) {
    // Focus on weekdays (Monday = 1, Friday = 5)
    let day = random(1, daysInMonth);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday), retry if needed
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      day = random(1, daysInMonth);
    }
    const timeDate = new Date(year, month - 1, day);
    timeEntries.push(generateTimeEntry(employeeId, timeDate, costCenters));
  }
  
  // Calculate totals
  const totalMiles = mileageEntries.reduce((sum, e) => sum + e.miles, 0);
  const totalExpenses = receipts.reduce((sum, r) => sum + r.amount, 0);
  const mileageReimbursement = totalMiles * 0.655; // Standard mileage rate
  const totalExpensesAmount = totalExpenses + mileageReimbursement;
  
  // Create monthly report
  const reportId = `report-${employeeId}-${year}-${month}`;
  const submittedAt = status !== 'draft' ? new Date(year, month - 1, random(5, 15)).toISOString() : null;
  const approvedAt = status === 'approved' ? new Date(year, month - 1, random(20, daysInMonth)).toISOString() : null;
  
  // Insert monthly report
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO monthly_reports 
       (id, employeeId, month, year, totalMiles, totalExpenses, status, submittedAt, submittedBy, approvedAt, approvedBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reportId, employeeId, month, year, totalMiles, totalExpensesAmount, status, submittedAt, employeeId, approvedAt, 'finance-approver', now, now],
      function(err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
  
  // Insert mileage entries
  for (const entry of mileageEntries) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO mileage_entries 
         (id, employeeId, oxfordHouseId, date, odometerReading, startLocation, endLocation, miles, purpose, notes, hoursWorked, isGpsTracked, costCenter, startLocationName, startLocationAddress, startLocationLat, startLocationLng, endLocationName, endLocationAddress, endLocationLat, endLocationLng, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [entry.id, entry.employeeId, entry.oxfordHouseId, entry.date, entry.odometerReading, entry.startLocation, entry.endLocation, entry.miles, entry.purpose, entry.notes, entry.hoursWorked, entry.isGpsTracked, entry.costCenter, entry.startLocationName, entry.startLocationAddress, entry.startLocationLat, entry.startLocationLng, entry.endLocationName, entry.endLocationAddress, entry.endLocationLat, entry.endLocationLng, now, now],
        (err) => {
          if (err && !err.message.includes('UNIQUE')) reject(err);
          else resolve();
        }
      );
    });
  }
  
  // Insert receipts
  for (const receipt of receipts) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO receipts 
         (id, employeeId, date, amount, vendor, category, description, costCenter, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [receipt.id, receipt.employeeId, receipt.date, receipt.amount, receipt.vendor, receipt.category, receipt.description, receipt.costCenter, now, now],
        (err) => {
          if (err && !err.message.includes('UNIQUE')) reject(err);
          else resolve();
        }
      );
    });
  }
  
  // Insert time entries
  for (const timeEntry of timeEntries) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO time_tracking 
         (id, employeeId, date, category, hours, description, costCenter, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [timeEntry.id, timeEntry.employeeId, timeEntry.date, timeEntry.category, timeEntry.hours, timeEntry.description, timeEntry.costCenter, now, now],
        (err) => {
          if (err && !err.message.includes('UNIQUE')) reject(err);
          else resolve();
        }
      );
    });
  }
  
  // Also create expense_report entry
  const reportData = {
    totalMileageAmount: mileageReimbursement,
    airRailBus: 0,
    vehicleRentalFuel: receipts.filter(r => r.category === 'Gas').reduce((sum, r) => sum + r.amount, 0),
    parkingTolls: receipts.filter(r => ['Parking', 'Tolls'].includes(r.category)).reduce((sum, r) => sum + r.amount, 0),
    groundTransportation: 0,
    hotelsAirbnb: receipts.filter(r => r.category === 'Hotel').reduce((sum, r) => sum + r.amount, 0),
    perDiem: 0,
    phoneInternetFax: receipts.filter(r => r.category === 'Phone/Internet').reduce((sum, r) => sum + r.amount, 0),
    shippingPostage: receipts.filter(r => r.category === 'Shipping/Postage').reduce((sum, r) => sum + r.amount, 0),
    printingCopying: receipts.filter(r => r.category === 'Printing/Copying').reduce((sum, r) => sum + r.amount, 0),
    officeSupplies: receipts.filter(r => r.category === 'Office Supplies').reduce((sum, r) => sum + r.amount, 0),
    eesReceipt: receipts.filter(r => !['Gas', 'Parking', 'Tolls', 'Hotel', 'Phone/Internet', 'Shipping/Postage', 'Printing/Copying', 'Office Supplies'].includes(r.category)).reduce((sum, r) => sum + r.amount, 0),
    meals: receipts.filter(r => r.category === 'Meals').reduce((sum, r) => sum + r.amount, 0),
    other: 0
  };
  
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO expense_reports 
       (id, employeeId, month, year, reportData, status, submittedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reportId, employeeId, month, year, JSON.stringify(reportData), status, submittedAt, now, now],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
  
  return {
    reportId,
    status,
    totalMiles,
    totalExpenses: totalExpensesAmount,
    mileageEntries: mileageEntries.length,
    receipts: receipts.length,
    timeEntries: timeEntries.length
  };
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting to load year of reports for demo...\n');
  
  try {
    // Get employees with their cost centers (limit to active, non-archived)
    const employees = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, preferredName, oxfordHouseId, selectedCostCenters, defaultCostCenter, costCenters 
         FROM employees 
         WHERE (archived IS NULL OR archived = 0) 
         LIMIT 20`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    console.log(`Found ${employees.length} employees to generate reports for\n`);
    
    if (employees.length === 0) {
      console.log('❌ No employees found. Please ensure employees exist in the database.');
      process.exit(1);
    }
    
    // Process employee cost centers
    const employeesWithCostCenters = employees.map(emp => {
      let costCenters = [];
      
      // Try to parse selectedCostCenters first
      if (emp.selectedCostCenters) {
        try {
          const parsed = typeof emp.selectedCostCenters === 'string' 
            ? JSON.parse(emp.selectedCostCenters) 
            : emp.selectedCostCenters;
          if (Array.isArray(parsed) && parsed.length > 0) {
            costCenters = parsed;
          }
        } catch (e) {
          // If parsing fails, try costCenters
          if (emp.costCenters) {
            try {
              const parsed = typeof emp.costCenters === 'string' 
                ? JSON.parse(emp.costCenters) 
                : emp.costCenters;
              if (Array.isArray(parsed) && parsed.length > 0) {
                costCenters = parsed;
              }
            } catch (e2) {
              // Use default if available
              if (emp.defaultCostCenter) {
                costCenters = [emp.defaultCostCenter];
              }
            }
          }
        }
      } else if (emp.defaultCostCenter) {
        costCenters = [emp.defaultCostCenter];
      }
      
      // Fallback to Program Services if no cost centers found
      if (costCenters.length === 0) {
        costCenters = ['Program Services'];
      }
      
      return {
        ...emp,
        costCenters: costCenters
      };
    });
    
    // Generate reports for each employee for past 12 months
    const currentDate = new Date();
    let totalReports = 0;
    let totalMileage = 0;
    let totalReceipts = 0;
    let totalTimeEntries = 0;
    
    for (const employee of employeesWithCostCenters) {
      console.log(`📊 Generating reports for ${employee.preferredName || employee.name}...`);
      console.log(`   Cost Centers: ${employee.costCenters.join(', ')}`);
      
      for (let monthOffset = MONTHS_TO_GENERATE - 1; monthOffset >= 0; monthOffset--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthOffset, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        // Skip future months
        if (date > currentDate) continue;
        
        try {
          const result = await generateMonthlyReport(
            employee.id, 
            employee.name, 
            employee.oxfordHouseId || 'OH-001',
            month, 
            year,
            employee.costCenters
          );
          totalReports++;
          totalMileage += result.mileageEntries;
          totalReceipts += result.receipts;
          totalTimeEntries += result.timeEntries;
          
          console.log(`  ✅ ${year}-${String(month).padStart(2, '0')}: ${result.status} | ${result.totalMiles} mi | $${result.totalExpenses.toFixed(2)} | ${result.mileageEntries} entries, ${result.receipts} receipts`);
        } catch (error) {
          console.error(`  ❌ Error generating report for ${year}-${month}:`, error.message);
        }
      }
      
      console.log('');
    }
    
    console.log('✅ Generation complete!\n');
    console.log('📈 Summary:');
    console.log(`   • Reports created: ${totalReports}`);
    console.log(`   • Mileage entries: ${totalMileage}`);
    console.log(`   • Receipts: ${totalReceipts}`);
    console.log(`   • Time entries: ${totalTimeEntries}`);
    console.log(`   • Employees: ${employees.length}`);
    console.log(`   • Time period: ${MONTHS_TO_GENERATE} months\n`);
    console.log('🎉 Your demo data is ready!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the script
main();

