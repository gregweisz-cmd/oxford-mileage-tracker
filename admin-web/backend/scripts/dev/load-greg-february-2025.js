/**
 * Script to load February 2025 expense data for Greg Weisz
 * Run with: node load-greg-february-2025.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const DB_PATH = path.join(__dirname, 'expense_tracker.db');

// Helper function to generate unique IDs
function generateId(prefix = '') {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to format date as YYYY-MM-DD
function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Helper function to get current timestamp
function getNow() {
  return new Date().toISOString();
}

// Open database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

// Find Greg Weisz's employee ID
function findGregWeisz() {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT id, name, email, oxfordHouseId FROM employees WHERE name LIKE '%Greg%Weisz%' OR name LIKE '%Weisz%Greg%' OR email LIKE '%weisz%'",
      (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          reject(new Error('Greg Weisz not found in database'));
        } else {
          console.log(`✅ Found employee: ${row.name} (ID: ${row.id})`);
          resolve(row);
        }
      }
    );
  });
}

// Load mileage entries
function loadMileageEntries(employeeId, oxfordHouseId) {
  const entries = [
    {
      date: formatDate(2025, 2, 13),
      startLocation: 'BA',
      endLocation: 'OH Paramount (1048 Paramount Cir Gastonia, NC)',
      purpose: 'Work with coworker on project',
      odometerStart: 94952,
      odometerEnd: 95055,
      miles: 103,
      hoursWorked: 8,
      costCenter: 'PS-UNFUNDED'
    },
    {
      date: formatDate(2025, 2, 18),
      startLocation: 'BA',
      endLocation: "Coworker's house (2061 Jamestown Rd Morganton, NC 28655)",
      purpose: 'Training with coworker',
      odometerStart: 95113,
      odometerEnd: 95223,
      miles: 110,
      hoursWorked: 8,
      costCenter: 'PS-UNFUNDED'
    },
    {
      date: formatDate(2025, 2, 21),
      startLocation: 'BA',
      endLocation: "Coworker's house (673 Sand Hill Rd Asheville, NC)",
      purpose: 'Drop off',
      odometerStart: 95459,
      odometerEnd: 95675,
      miles: 216,
      hoursWorked: 8,
      costCenter: 'PS-UNFUNDED'
    }
  ];

  return new Promise((resolve, reject) => {
    let completed = 0;
    let errors = [];

    entries.forEach((entry) => {
      const id = generateId('mile-');
      const now = getNow();

      db.run(
        `INSERT INTO mileage_entries (
          id, employeeId, oxfordHouseId, date, odometerReading, startLocation, endLocation,
          purpose, miles, notes, hoursWorked, isGpsTracked, costCenter, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          employeeId,
          oxfordHouseId,
          entry.date,
          entry.odometerStart, // Using start as the odometer reading
          entry.startLocation,
          entry.endLocation,
          entry.purpose,
          entry.miles,
          `Odometer: ${entry.odometerStart} - ${entry.odometerEnd}`,
          entry.hoursWorked,
          0, // isGpsTracked
          entry.costCenter,
          now,
          now
        ],
        function(err) {
          if (err) {
            console.error(`❌ Error inserting mileage entry for ${entry.date}:`, err);
            errors.push(err);
          } else {
            console.log(`✅ Inserted mileage entry: ${entry.date} - ${entry.miles} miles`);
          }
          completed++;
          if (completed === entries.length) {
            if (errors.length > 0) {
              reject(new Error(`Failed to insert ${errors.length} mileage entries`));
            } else {
              resolve();
            }
          }
        }
      );
    });
  });
}

// Load time tracking entries
function loadTimeTracking(employeeId) {
  const entries = [
    { date: formatDate(2025, 2, 3), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 4), hours: 8, description: 'Flew to Portland, OR for Oregon State Convention - stayed the night', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 5), hours: 8, description: 'Zoom calls, emails, phone calls and Oregon State Convention prep - stayed the night', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 6), hours: 8, description: 'Zoom calls, emails, phone calls and Oregon State Convention prep - stayed the night', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 7), hours: 8, description: 'Zoom calls, emails, phone calls and Oregon State Convention - stayed the night', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 8), hours: 8, description: 'Zoom calls, emails, phone calls and Oregon State Convention - stayed the night', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 9), hours: 8, description: 'Flew home from Oregon', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 10), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 11), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 12), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 13), hours: 8, description: 'Travel to OH Paramount to work with coworker on project', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 14), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 17), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 18), hours: 8, description: "Travel to coworker's house for training with coworker", costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 19), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 20), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 21), hours: 8, description: "Travel to coworker's house to drop off", costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 24), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 25), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 26), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 27), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 2, 28), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' }
  ];

  return new Promise((resolve, reject) => {
    let completed = 0;
    let errors = [];

    entries.forEach((entry) => {
      // Generate deterministic ID based on unique combination
      const uniqueKey = `${employeeId}-${entry.date}-${entry.costCenter || ''}`;
      const id = Buffer.from(uniqueKey).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
      const now = getNow();

      db.run(
        `INSERT OR REPLACE INTO time_tracking (
          id, employeeId, date, category, hours, description, costCenter, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM time_tracking WHERE id = ?), ?), ?)`,
        [
          id,
          employeeId,
          entry.date,
          'Work', // Default category
          entry.hours,
          entry.description,
          entry.costCenter,
          id,
          now,
          now
        ],
        function(err) {
          if (err) {
            console.error(`❌ Error inserting time tracking for ${entry.date}:`, err);
            errors.push(err);
          } else {
            console.log(`✅ Inserted time tracking: ${entry.date} - ${entry.hours} hours`);
          }
          completed++;
          if (completed === entries.length) {
            if (errors.length > 0) {
              reject(new Error(`Failed to insert ${errors.length} time tracking entries`));
            } else {
              resolve();
            }
          }
        }
      );
    });
  });
}

// Load receipts
function loadReceipts(employeeId) {
  const receipts = [
    {
      date: formatDate(2025, 2, 27), // Auto Pay date
      amount: 103.00,
      vendor: 'Spectrum',
      description: 'Spectrum Internet service - February 2025',
      category: 'Phone / Internet / Fax',
      costCenter: 'PS-UNFUNDED'
    }
  ];

  return new Promise((resolve, reject) => {
    let completed = 0;
    let errors = [];

    receipts.forEach((receipt) => {
      const id = generateId('receipt-');
      const now = getNow();

      db.run(
        `INSERT INTO receipts (
          id, employeeId, date, amount, vendor, description, category, imageUri, costCenter, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          employeeId,
          receipt.date,
          receipt.amount,
          receipt.vendor,
          receipt.description,
          receipt.category,
          '', // No image URI for now
          receipt.costCenter,
          now,
          now
        ],
        function(err) {
          if (err) {
            console.error(`❌ Error inserting receipt for ${receipt.date}:`, err);
            errors.push(err);
          } else {
            console.log(`✅ Inserted receipt: ${receipt.vendor} - $${receipt.amount}`);
          }
          completed++;
          if (completed === receipts.length) {
            if (errors.length > 0) {
              reject(new Error(`Failed to insert ${errors.length} receipts`));
            } else {
              resolve();
            }
          }
        }
      );
    });
  });
}

// Load per diem entries (as receipts with Per Diem category)
function loadPerDiem(employeeId) {
  const perDiemDays = [
    { date: formatDate(2025, 2, 4), description: 'Oregon State Convention - stayed the night' },
    { date: formatDate(2025, 2, 5), description: 'Oregon State Convention prep - stayed the night' },
    { date: formatDate(2025, 2, 6), description: 'Oregon State Convention prep - stayed the night' },
    { date: formatDate(2025, 2, 7), description: 'Oregon State Convention - stayed the night' },
    { date: formatDate(2025, 2, 8), description: 'Oregon State Convention - stayed the night' },
    { date: formatDate(2025, 2, 13), description: 'Travel to OH Paramount' },
    { date: formatDate(2025, 2, 18), description: "Travel to coworker's house for training" },
    { date: formatDate(2025, 2, 21), description: "Travel to coworker's house to drop off" }
  ];

  return new Promise((resolve, reject) => {
    let completed = 0;
    let errors = [];

    perDiemDays.forEach((entry) => {
      const id = generateId('perdiem-');
      const now = getNow();

      db.run(
        `INSERT INTO receipts (
          id, employeeId, date, amount, vendor, description, category, imageUri, costCenter, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          employeeId,
          entry.date,
          35.00,
          'Per Diem',
          entry.description + ' - $35 max/day',
          'Per Diem',
          '',
          'PS-UNFUNDED',
          now,
          now
        ],
        function(err) {
          if (err) {
            console.error(`❌ Error inserting per diem for ${entry.date}:`, err);
            errors.push(err);
          } else {
            console.log(`✅ Inserted per diem: ${entry.date} - $35.00`);
          }
          completed++;
          if (completed === perDiemDays.length) {
            if (errors.length > 0) {
              reject(new Error(`Failed to insert ${errors.length} per diem entries`));
            } else {
              resolve();
            }
          }
        }
      );
    });
  });
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting data load for Greg Weisz - February 2025...\n');

    // Find Greg Weisz
    const employee = await findGregWeisz();
    const employeeId = employee.id;
    const oxfordHouseId = employee.oxfordHouseId || 'unknown';

    // Load all data
    console.log('\n📊 Loading mileage entries...');
    await loadMileageEntries(employeeId, oxfordHouseId);

    console.log('\n⏰ Loading time tracking entries...');
    await loadTimeTracking(employeeId);

    console.log('\n🧾 Loading receipts...');
    await loadReceipts(employeeId);

    console.log('\n🍽️ Loading per diem entries...');
    await loadPerDiem(employeeId);

    console.log('\n✅ All data loaded successfully!');
    console.log('\nSummary:');
    console.log('  - Mileage entries: 3');
    console.log('  - Time tracking entries: 22');
    console.log('  - Receipts: 1');
    console.log('  - Per diem entries: 8');
    console.log('  - Total expenses: $608.91');

  } catch (error) {
    console.error('❌ Error loading data:', error);
    process.exit(1);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err);
      } else {
        console.log('\n✅ Database connection closed');
      }
      process.exit(0);
    });
  }
}

// Run the script
main();

