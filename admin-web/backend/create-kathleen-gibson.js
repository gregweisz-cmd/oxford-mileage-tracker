const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const DB_PATH = path.join(__dirname, '../../oxford_tracker.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH);

// Kathleen Gibson's account details
const kathleenGibson = {
  id: 'kathleen-gibson-001',
  name: 'Kathleen Gibson',
  email: 'kathleen@oxfordhouse.org',
  password: 'Kathleenwelcome1',
  oxfordHouseId: 'oxford-house-001',
  position: 'CEO',
  phoneNumber: '',
  baseAddress: '9016 Mustard Seed Ln, Garner, NC 27529',
  costCenters: JSON.stringify([
    'PS-Unfunded',
    'PS-Funded',
    'Administrative',
    'Training',
    'Direct Care',
    'Travel',
    'Other'
  ]),
  selectedCostCenters: JSON.stringify([
    'PS-Unfunded',
    'PS-Funded',
    'Administrative'
  ]),
  defaultCostCenter: 'PS-Unfunded',
  preferredName: 'Kathleen',
  signature: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

async function createKathleenGibson() {
  return new Promise((resolve, reject) => {
    console.log('👤 Creating Kathleen Gibson account...');
    
    // First, check if the employees table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='employees'", (err, row) => {
      if (err) {
        console.error('❌ Error checking for employees table:', err);
        reject(err);
        return;
      }
      
      if (!row) {
        console.log('📋 Creating employees table...');
        db.run(`
          CREATE TABLE employees (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            oxfordHouseId TEXT NOT NULL,
            position TEXT NOT NULL,
            phoneNumber TEXT DEFAULT '',
            baseAddress TEXT DEFAULT '',
            costCenters TEXT DEFAULT '[]',
            selectedCostCenters TEXT DEFAULT '[]',
            defaultCostCenter TEXT DEFAULT '',
            preferredName TEXT DEFAULT '',
            signature TEXT DEFAULT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
          )
        `, (err) => {
          if (err) {
            console.error('❌ Error creating employees table:', err);
            reject(err);
            return;
          }
          console.log('✅ Employees table created');
          insertEmployee();
        });
      } else {
        console.log('✅ Employees table exists');
        insertEmployee();
      }
    });
    
    function insertEmployee() {
      // Check if Kathleen already exists
      db.get('SELECT id FROM employees WHERE email = ?', [kathleenGibson.email], (err, row) => {
        if (err) {
          console.error('❌ Error checking for existing Kathleen Gibson:', err);
          reject(err);
          return;
        }
        
        if (row) {
          console.log('🔄 Kathleen Gibson already exists, updating...');
          // Update existing account
          db.run(`
            UPDATE employees SET
              name = ?,
              password = ?,
              position = ?,
              phoneNumber = ?,
              baseAddress = ?,
              costCenters = ?,
              selectedCostCenters = ?,
              defaultCostCenter = ?,
              preferredName = ?,
              updatedAt = ?
            WHERE email = ?
          `, [
            kathleenGibson.name,
            kathleenGibson.password,
            kathleenGibson.position,
            kathleenGibson.phoneNumber,
            kathleenGibson.baseAddress,
            kathleenGibson.costCenters,
            kathleenGibson.selectedCostCenters,
            kathleenGibson.defaultCostCenter,
            kathleenGibson.preferredName,
            kathleenGibson.updatedAt,
            kathleenGibson.email
          ], function(err) {
            if (err) {
              console.error('❌ Error updating Kathleen Gibson:', err);
              reject(err);
              return;
            }
            console.log('✅ Kathleen Gibson account updated successfully');
            printAccountDetails();
            resolve();
          });
        } else {
          console.log('🆕 Creating new Kathleen Gibson account...');
          // Insert new account
          db.run(`
            INSERT INTO employees (
              id, name, email, password, oxfordHouseId, position,
              phoneNumber, baseAddress, costCenters, selectedCostCenters,
              defaultCostCenter, preferredName, signature, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            kathleenGibson.id,
            kathleenGibson.name,
            kathleenGibson.email,
            kathleenGibson.password,
            kathleenGibson.oxfordHouseId,
            kathleenGibson.position,
            kathleenGibson.phoneNumber,
            kathleenGibson.baseAddress,
            kathleenGibson.costCenters,
            kathleenGibson.selectedCostCenters,
            kathleenGibson.defaultCostCenter,
            kathleenGibson.preferredName,
            kathleenGibson.signature,
            kathleenGibson.createdAt,
            kathleenGibson.updatedAt
          ], function(err) {
            if (err) {
              console.error('❌ Error creating Kathleen Gibson:', err);
              reject(err);
              return;
            }
            console.log('✅ Kathleen Gibson account created successfully');
            printAccountDetails();
            resolve();
          });
        }
      });
    }
    
    function printAccountDetails() {
      console.log('\n🎉 Kathleen Gibson Account Details:');
      console.log('=====================================');
      console.log(`Employee ID: ${kathleenGibson.id}`);
      console.log(`Name: ${kathleenGibson.name}`);
      console.log(`Preferred Name: ${kathleenGibson.preferredName}`);
      console.log(`Email: ${kathleenGibson.email}`);
      console.log(`Password: ${kathleenGibson.password}`);
      console.log(`Position: ${kathleenGibson.position}`);
      console.log(`Base Address: ${kathleenGibson.baseAddress}`);
      console.log(`Default Cost Center: ${kathleenGibson.defaultCostCenter}`);
      console.log(`Selected Cost Centers: ${kathleenGibson.selectedCostCenters}`);
      console.log('=====================================\n');
    }
  });
}

// Run the script
createKathleenGibson()
  .then(() => {
    console.log('✅ Script completed successfully');
    db.close();
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    db.close();
    process.exit(1);
  });
