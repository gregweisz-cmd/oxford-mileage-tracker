/**
 * Script to load March 2025 expense data for Greg Weisz
 * Run with: node load-greg-march-2025.js
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
      date: formatDate(2025, 3, 3),
      startLocation: 'BA',
      endLocation: 'Gaylord National Harbor (201 Waterfront St Oxon Hill, MD)',
      purpose: 'Staff training - stayed the night',
      odometerStart: 151722,
      odometerEnd: 152119,
      miles: 397,
      hoursWorked: 8,
      costCenter: 'PS-UNFUNDED'
    },
    {
      date: formatDate(2025, 3, 9),
      startLocation: 'Gaylord National Harbor (201 Waterfront St Oxon Hill, MD)',
      endLocation: 'BA',
      purpose: 'Return from staff training',
      odometerStart: 152125,
      odometerEnd: 152522,
      miles: 397,
      hoursWorked: 8,
      costCenter: 'PS-UNFUNDED'
    },
    {
      date: formatDate(2025, 3, 11),
      startLocation: 'BA',
      endLocation: '1712 Cox Ridge Rd Claudville, VA',
      purpose: 'Pick up donations',
      odometerStart: 96412,
      odometerEnd: 96572,
      miles: 160,
      hoursWorked: 8,
      costCenter: 'PS-UNFUNDED'
    },
    {
      date: formatDate(2025, 3, 13),
      startLocation: 'BA',
      endLocation: 'OH Amtrak (6629 Starcrest Dr Charlotte, NC)',
      purpose: 'Drop off',
      odometerStart: 96681,
      odometerEnd: 96766,
      miles: 85,
      hoursWorked: 8,
      costCenter: 'PS-UNFUNDED'
    },
    {
      date: formatDate(2025, 3, 15),
      startLocation: 'BA',
      endLocation: '222 Paradise Hills Circle Mooresville, NC to OH McLelland (338 W McLelland Ave Mooresville, NC)',
      purpose: 'Pick up donations and drop off at OH McLelland',
      odometerStart: 96846,
      odometerEnd: 96872,
      miles: 26,
      hoursWorked: 8,
      costCenter: 'PS-UNFUNDED'
    },
    {
      date: formatDate(2025, 3, 19),
      startLocation: 'BA',
      endLocation: "Coworker's house (673 Sand Hill Rd Asheville, NC)",
      purpose: 'Help with computer/network issues',
      odometerStart: 152530,
      odometerEnd: 152746,
      miles: 216,
      hoursWorked: 8,
      costCenter: 'PS-UNFUNDED'
    },
    {
      date: formatDate(2025, 3, 25),
      startLocation: 'BA',
      endLocation: "Coworker's house (1452 Finsbury Ln High Point, NC)",
      purpose: 'Drop off donations',
      odometerStart: 152841,
      odometerEnd: 152977,
      miles: 136,
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
          entry.odometerStart,
          entry.startLocation,
          entry.endLocation,
          entry.purpose,
          entry.miles,
          `Odometer: ${entry.odometerStart} - ${entry.odometerEnd}`,
          entry.hoursWorked,
          0,
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
    { date: formatDate(2025, 3, 3), hours: 8, description: 'Travel to Gaylord National Harbor for staff training - stayed the night', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 4), hours: 8, description: 'Staff Training - stayed the night', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 5), hours: 8, description: 'Staff Training - stayed the night', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 6), hours: 8, description: 'Staff Training - stayed the night', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 7), hours: 8, description: 'Staff Training - stayed the night', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 8), hours: 8, description: 'Staff Training - stayed the night', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 9), hours: 8, description: 'Return from staff training at Gaylord National Harbor', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 10), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 11), hours: 8, description: 'Travel to pick up donations', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 12), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 13), hours: 8, description: 'Travel to OH Amtrak to drop off', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 14), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 15), hours: 8, description: 'Travel to pick up donations and drop off at OH McLelland', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 18), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 19), hours: 8, description: "Travel to coworker's house to help with computer/network issues", costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 20), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 21), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 24), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 25), hours: 8, description: "Travel to coworker's house to drop off donations", costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 26), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 27), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 28), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 3, 31), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' }
  ];

  return new Promise((resolve, reject) => {
    let completed = 0;
    let errors = [];

    entries.forEach((entry) => {
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
          'Work',
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
      date: formatDate(2025, 3, 27),
      amount: 103.00,
      vendor: 'Spectrum',
      description: 'Spectrum Internet service - March 2025',
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
          '',
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

// Load per diem entries
function loadPerDiem(employeeId) {
  const perDiemDays = [
    { date: formatDate(2025, 3, 3), description: 'Staff training at Gaylord National Harbor - stayed the night' },
    { date: formatDate(2025, 3, 4), description: 'Staff Training - stayed the night' },
    { date: formatDate(2025, 3, 5), description: 'Staff Training - stayed the night' },
    { date: formatDate(2025, 3, 6), description: 'Staff Training - stayed the night' },
    { date: formatDate(2025, 3, 7), description: 'Staff Training - stayed the night' },
    { date: formatDate(2025, 3, 8), description: 'Staff Training - stayed the night' },
    { date: formatDate(2025, 3, 9), description: 'Return from staff training - stayed the night' },
    { date: formatDate(2025, 3, 11), description: 'Travel to pick up donations' },
    { date: formatDate(2025, 3, 19), description: "Travel to coworker's house to help with computer/network issues" },
    { date: formatDate(2025, 3, 25), description: "Travel to coworker's house to drop off donations" }
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
    console.log('🚀 Starting data load for Greg Weisz - March 2025...\n');

    const employee = await findGregWeisz();
    const employeeId = employee.id;
    const oxfordHouseId = employee.oxfordHouseId || 'unknown';

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
    console.log('  - Mileage entries: 7');
    console.log('  - Time tracking entries: 23');
    console.log('  - Receipts: 1');
    console.log('  - Per diem entries: 10');
    console.log('  - Total expenses: $1,083.57');

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

main();

