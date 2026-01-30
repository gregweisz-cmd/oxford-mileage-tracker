/**
 * Seed Service
 * Handles seeding of test accounts and supervisor assignments
 * Extracted from server.js for better organization
 */

const dbService = require('./dbService');
const helpers = require('../utils/helpers');
const { debugLog, debugError } = require('../debug');

/**
 * Seed test accounts into the database
 * Updates existing accounts or creates new ones if they don't exist
 * Creates/updates accounts for: Greg Weisz, Jackson Longan, Kathleen Gibson, Alex Szary
 * @returns {Promise<void>} Resolves when all accounts are processed
 * @throws {Error} If database operations fail
 * 
 * @example
 * await seedService.seedTestAccounts();
 * console.log('Test accounts ready');
 */
/**
 * Wait for employees table to exist (handles startup race on fresh disk)
 */
function waitForEmployeesTable(db, maxWaitMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      db.get('SELECT 1 FROM employees LIMIT 1', [], (err) => {
        if (!err) {
          resolve(true);
          return;
        }
        if (err.message && err.message.includes('no such table')) {
          if (Date.now() - start < maxWaitMs) {
            setTimeout(check, 500);
            return;
          }
          resolve(false);
          return;
        }
        resolve(false);
      });
    }
    check();
  });
}

async function seedTestAccounts() {
  const db = dbService.getDb();
  const ready = await waitForEmployeesTable(db);
  if (!ready) {
    debugLog('⚠️ Database tables not ready yet (e.g. fresh disk); skipping test account seed.');
    return;
  }
  const testAccounts = [
    {
      id: 'greg-weisz-001',
      name: 'Greg Weisz',
      preferredName: 'Greg',
      email: 'greg.weisz@oxfordhouse.org',
      password: 'ImtheBoss5!',
      oxfordHouseId: 'oxford-house-001',
      position: 'Senior Data Analyst/Administrator',
      phoneNumber: '(555) 123-4567',
      baseAddress: '230 Wagner St, Troutman, NC 28166',
      costCenters: JSON.stringify(['Program Services', 'Finance', 'CORPORATE']),
      selectedCostCenters: JSON.stringify(['Program Services', 'Finance', 'CORPORATE']),
      defaultCostCenter: 'Program Services'
    },
    {
      id: 'jackson-longan-001',
      name: 'Jackson Longan',
      preferredName: 'Jackson',
      email: 'jackson.longan@oxfordhouse.org',
      password: 'Jacksonwelcome1',
      oxfordHouseId: 'oxford-house-002',
      position: 'Director of Communication and Information/Administrator',
      phoneNumber: '(555) 345-6789',
      baseAddress: '123 Main St, Oklahoma City, OK 73101',
      costCenters: JSON.stringify(['Program Services', 'OK-SUBG', 'CORPORATE']),
      selectedCostCenters: JSON.stringify(['Program Services', 'OK-SUBG', 'CORPORATE']),
      defaultCostCenter: 'Program Services'
    },
    {
      id: 'kathleen-gibson-001',
      name: 'Kathleen Gibson',
      preferredName: 'Kathleen',
      email: 'kathleen.gibson@oxfordhouse.org',
      password: 'Kathleenwelcome1',
      oxfordHouseId: 'oxford-house-003',
      position: 'CEO/Administrator',
      phoneNumber: '(555) 234-5678',
      baseAddress: '9016 Mustard Seed Ln, Garner, NC 27529',
      costCenters: JSON.stringify(['Program Services', 'Finance', 'CORPORATE']),
      selectedCostCenters: JSON.stringify(['Program Services', 'Finance', 'CORPORATE']),
      defaultCostCenter: 'Program Services'
    },
    {
      id: 'alex-szary-001',
      name: 'Alex Szary',
      preferredName: 'Alex',
      email: 'alex.szary@oxfordhouse.org',
      password: 'Alexwelcome1',
      oxfordHouseId: 'oxford-house-004',
      position: 'Senior Manager of Data and Analytics/Administrator',
      phoneNumber: '(555) 456-7890',
      baseAddress: '456 Oak St, Austin, TX 78701',
      costCenters: JSON.stringify(['Program Services', 'TX-SUBG', 'CORPORATE']),
      selectedCostCenters: JSON.stringify(['Program Services', 'TX-SUBG', 'CORPORATE']),
      defaultCostCenter: 'Program Services'
    }
  ];

  debugLog('👥 Setting up test accounts...');

  for (const account of testAccounts) {
    try {
      // Hash password so auth (bcrypt compare) works
      const hashedPassword = await helpers.hashPassword(account.password);

      // Check if account already exists
      const existingAccount = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM employees WHERE id = ? OR email = ?',
          [account.id, account.email],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      const now = new Date().toISOString();

      if (existingAccount) {
        debugLog(`🔄 ${account.name} already exists, updating...`);
        
        // Update existing account by email (since ID might be different)
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE employees SET 
              name = ?,
              preferredName = ?,
              email = ?,
              password = ?,
              oxfordHouseId = ?,
              position = ?,
              phoneNumber = ?,
              baseAddress = ?,
              costCenters = ?,
              selectedCostCenters = ?,
              defaultCostCenter = ?,
              updatedAt = ?
            WHERE email = ?`,
            [
              account.name,
              account.preferredName,
              account.email,
              hashedPassword,
              account.oxfordHouseId,
              account.position,
              account.phoneNumber,
              account.baseAddress,
              account.costCenters,
              account.selectedCostCenters,
              account.defaultCostCenter,
              now,
              account.email
            ],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      } else {
        debugLog(`➕ Creating new account for ${account.name}...`);
        
        // Insert new account
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO employees (
              id, name, preferredName, email, password, oxfordHouseId, position, 
              phoneNumber, baseAddress, costCenters, selectedCostCenters, 
              defaultCostCenter, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              account.id,
              account.name,
              account.preferredName,
              account.email,
              hashedPassword,
              account.oxfordHouseId,
              account.position,
              account.phoneNumber,
              account.baseAddress,
              account.costCenters,
              account.selectedCostCenters,
              account.defaultCostCenter,
              now,
              now
            ],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
      
      debugLog(`✅ ${account.name} processed successfully`);
    } catch (error) {
      debugError(`❌ Error processing ${account.name}:`, error);
    }
  }

  debugLog('🎉 All test accounts processed!');
}

/**
 * Seed supervisor assignments from supervisor-assignments-module.js
 * Updates employee supervisor relationships if the module exists
 * Safely handles missing module or missing employees
 * @returns {Promise<void>} Resolves when assignments are processed
 * @throws {Error} If database operations fail
 * 
 * @example
 * await seedService.seedSupervisorAssignments();
 * console.log('Supervisor assignments updated');
 */
async function seedSupervisorAssignments() {
  const db = dbService.getDb();
  const ready = await waitForEmployeesTable(db);
  if (!ready) {
    debugLog('⚠️ Database tables not ready yet; skipping supervisor assignment seed.');
    return;
  }
  // Try to load supervisor assignments module
  let SUPERVISOR_ASSIGNMENTS = [];
  
  try {
    // Dynamically require the module if it exists
    const assignmentsModule = require('../supervisor-assignments-module.js');
    SUPERVISOR_ASSIGNMENTS = assignmentsModule.SUPERVISOR_ASSIGNMENTS || [];
  } catch (error) {
    // File doesn't exist yet, that's okay
    debugLog('📝 No supervisor-assignments-module.js found, skipping assignments');
    return;
  }
  
  if (SUPERVISOR_ASSIGNMENTS.length === 0) {
    debugLog('📝 No supervisor assignments to seed');
    return;
  }
  
  debugLog(`👥 Seeding ${SUPERVISOR_ASSIGNMENTS.length} supervisor assignments...`);
  
  const now = new Date().toISOString();
  let successCount = 0;
  let skipCount = 0;
  
  for (const assignment of SUPERVISOR_ASSIGNMENTS) {
    try {
      // Check if employee exists before trying to update
      const employee = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM employees WHERE id = ?', [assignment.id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (!employee) {
        // Employee doesn't exist, skip
        skipCount++;
        continue;
      }
      
      // Update the employee's supervisor
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE employees SET supervisorId = ?, updatedAt = ? WHERE id = ?',
          [assignment.supervisorId, now, assignment.id],
          function(updateErr) {
            if (updateErr) reject(updateErr);
            else resolve();
          }
        );
      });
      
      successCount++;
    } catch (error) {
      debugError(`❌ Error updating supervisor for ${assignment.id}:`, error.message);
    }
  }
  
  debugLog(`✅ Supervisor assignments seeded: ${successCount} updated, ${skipCount} skipped`);
}

module.exports = {
  seedTestAccounts,
  seedSupervisorAssignments
};

