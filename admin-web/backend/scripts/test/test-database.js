/**
 * Database Test Script
 * Tests database connection and basic queries
 * Run with: node scripts/test/test-database.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'expense_tracker.db');
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

let passed = 0;
let failed = 0;
const issues = [];

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Test database connection
 */
function testConnection(db) {
  return new Promise((resolve, reject) => {
    db.get('SELECT 1 as test', (err, row) => {
      if (err) {
        log('✗ Database connection failed', 'red');
        failed++;
        issues.push('Database connection failed');
        reject(err);
      } else {
        log('✓ Database connection successful', 'green');
        passed++;
        resolve();
      }
    });
  });
}

/**
 * Test table existence
 */
function testTableExists(db, tableName) {
  return new Promise((resolve) => {
    db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName],
      (err, row) => {
        if (err || !row) {
          log(`✗ Table '${tableName}' does not exist`, 'red');
          failed++;
          issues.push(`Table '${tableName}' missing`);
        } else {
          log(`✓ Table '${tableName}' exists`, 'green');
          passed++;
        }
        resolve();
      }
    );
  });
}

/**
 * Test table row count
 */
function testTableRowCount(db, tableName) {
  return new Promise((resolve) => {
    db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
      if (err) {
        log(`✗ Could not count rows in '${tableName}'`, 'red');
        failed++;
        issues.push(`Cannot count rows in '${tableName}'`);
      } else {
        log(`✓ Table '${tableName}' has ${row.count} rows`, 'green');
        passed++;
      }
      resolve();
    });
  });
}

/**
 * Test foreign key relationships (if data exists)
 */
function testForeignKey(db, childTable, parentTable, fkColumn) {
  return new Promise((resolve) => {
    db.get(
      `SELECT COUNT(*) as count FROM ${childTable} WHERE ${fkColumn} NOT NULL AND ${fkColumn} NOT IN (SELECT id FROM ${parentTable})`,
      (err, row) => {
        if (err) {
          log(`⚠ Could not test FK for ${childTable}.${fkColumn}`, 'yellow');
        } else if (row.count > 0) {
          log(`✗ Foreign key violation: ${childTable}.${fkColumn} has ${row.count} orphaned records`, 'red');
          failed++;
          issues.push(`FK violation: ${childTable}.${fkColumn}`);
        } else {
          log(`✓ Foreign key ${childTable}.${fkColumn} -> ${parentTable}.id is valid`, 'green');
          passed++;
        }
        resolve();
      }
    );
  });
}

/**
 * Run all tests
 */
async function runTests() {
  log('=== Database Tests ===', 'blue');
  log(`Database: ${DB_PATH}\n`, 'blue');

  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      log(`✗ Cannot open database: ${err.message}`, 'red');
      process.exit(1);
    }
  });

  try {
    // Connection test
    await testConnection(db);

    // Test required tables
    log('\n=== Testing Table Existence ===', 'yellow');
    const tables = [
      'employees',
      'mileage_entries',
      'receipts',
      'time_tracking',
      'expense_reports',
      'monthly_reports',
      'weekly_reports',
      'cost_centers',
      'approval_history',
      'daily_descriptions'
    ];

    for (const table of tables) {
      await testTableExists(db, table);
    }

    // Test row counts
    log('\n=== Testing Table Row Counts ===', 'yellow');
    for (const table of tables) {
      await testTableRowCount(db, table);
    }

    // Test foreign keys
    log('\n=== Testing Foreign Key Relationships ===', 'yellow');
    await testForeignKey(db, 'mileage_entries', 'employees', 'employeeId');
    await testForeignKey(db, 'receipts', 'employees', 'employeeId');
    await testForeignKey(db, 'time_tracking', 'employees', 'employeeId');
    await testForeignKey(db, 'expense_reports', 'employees', 'employeeId');
    await testForeignKey(db, 'employees', 'employees', 'supervisorId'); // Self-reference

    // Summary
    log('\n=== Test Summary ===', 'blue');
    log(`Passed: ${passed}`, 'green');
    log(`Failed: ${failed}`, 'red');
    log(`Total: ${passed + failed}`, 'blue');

    if (issues.length > 0) {
      log('\nIssues Found:', 'yellow');
      issues.forEach((issue, i) => {
        log(`${i + 1}. ${issue}`, 'red');
      });
    }

    db.close((err) => {
      if (err) {
        log(`Error closing database: ${err.message}`, 'red');
      }
      process.exit(failed > 0 ? 1 : 0);
    });
  } catch (error) {
    log(`\nFatal Error: ${error.message}`, 'red');
    db.close();
    process.exit(1);
  }
}

// Run tests
runTests();

