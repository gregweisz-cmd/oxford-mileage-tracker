/**
 * Script to load January 2025 expense data for Greg Weisz
 * Run with: node load-greg-january-2025.js
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
      date: formatDate(2025, 1, 6),
      startLocation: 'BA',
      endLocation: 'OH Jirah (209 S Trenton St Gastonia, NC)',
      purpose: 'Help setup new computer for house',
      odometerStart: 92755,
      odometerEnd: 92856,
      miles: 101,
      hoursWorked: 8,
      costCenter: 'PS-UNFUNDED'
    },
    {
      date: formatDate(2025, 1, 10),
      startLocation: 'BA',
      endLocation: "Coworker's house (2061 Jamestown Rd Morganton, NC)",
      purpose: 'Work on data project',
      odometerStart: 93911,
      odometerEnd: 94021,
      miles: 110,
      hoursWorked: 8,
      costCenter: 'PS-UNFUNDED'
    },
    {
      date: formatDate(2025, 1, 22),
      startLocation: 'BA',
      endLocation: "Coworker's house (673 Sand Hill Rd Asheville, NC)",
      purpose: 'Drop off',
      odometerStart: 94136,
      odometerEnd: 94352,
      miles: 216,
      hoursWorked: 8,
      costCenter: 'PS-UNFUNDED'
    },
    {
      date: formatDate(2025, 1, 29),
      startLocation: 'BA',
      endLocation: 'OH Violet (205 Davis Dr Morganton, NC)',
      purpose: 'Help move house out',
      odometerStart: 94685,
      odometerEnd: 94785,
      miles: 100,
      hoursWorked: 8,
      costCenter: 'PS-UNFUNDED'
    },
    {
      date: formatDate(2025, 1, 31),
      startLocation: 'BA',
      endLocation: '10 Federal Storage #1087-2806 N Cannon Blvd Kannapolis, NC to OH Timber Lake (1519 Marlwood Cir Charlotte, NC)',
      purpose: 'Help load donations to OH Timber Lake and unload donations',
      odometerStart: 94826,
      odometerEnd: 94930,
      miles: 104,
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
    { date: formatDate(2025, 1, 2), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 3), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 6), hours: 8, description: 'Travel to OH Jirah to help setup new computer', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 7), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 8), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 9), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 10), hours: 8, description: "Travel to coworker's house to work on data project", costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 13), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 14), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 15), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 16), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 17), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 21), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 22), hours: 8, description: "Travel to coworker's house to drop off", costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 23), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 24), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 28), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 29), hours: 8, description: 'Travel to OH Violet to help move house out', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 30), hours: 8, description: 'Work from home office: Zoom calls, emails and phone calls', costCenter: 'PS-UNFUNDED' },
    { date: formatDate(2025, 1, 31), hours: 8, description: 'Travel to storage and OH Timber Lake to help with donations', costCenter: 'PS-UNFUNDED' }
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
      date: formatDate(2025, 1, 27), // Auto Pay date
      amount: 102.99,
      vendor: 'Spectrum',
      description: 'Spectrum Internet service - January 2025',
      category: 'Phone / Internet / Fax',
      costCenter: 'PS-UNFUNDED'
    },
    {
      date: formatDate(2025, 1, 31),
      amount: 117.06,
      vendor: 'Amazon',
      description: 'ROYY Laptop Screen Extender Dual Monitor - 14" Portable Monitor',
      category: 'Supplies',
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
    formatDate(2025, 1, 6),
    formatDate(2025, 1, 10),
    formatDate(2025, 1, 22),
    formatDate(2025, 1, 29),
    formatDate(2025, 1, 31)
  ];

  return new Promise((resolve, reject) => {
    let completed = 0;
    let errors = [];

    perDiemDays.forEach((date) => {
      const id = generateId('perdiem-');
      const now = getNow();

      db.run(
        `INSERT INTO receipts (
          id, employeeId, date, amount, vendor, description, category, imageUri, costCenter, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          employeeId,
          date,
          35.00,
          'Per Diem',
          'Meals while traveling - $35 max/day',
          'Per Diem',
          '',
          'PS-UNFUNDED',
          now,
          now
        ],
        function(err) {
          if (err) {
            console.error(`❌ Error inserting per diem for ${date}:`, err);
            errors.push(err);
          } else {
            console.log(`✅ Inserted per diem: ${date} - $35.00`);
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
    console.log('🚀 Starting data load for Greg Weisz - January 2025...\n');

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
    console.log('  - Mileage entries: 5');
    console.log('  - Time tracking entries: 20');
    console.log('  - Receipts: 2');
    console.log('  - Per diem entries: 5');
    console.log('  - Total expenses: $675.85');

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

