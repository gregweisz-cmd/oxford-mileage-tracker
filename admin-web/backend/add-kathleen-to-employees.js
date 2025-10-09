const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path (same as server.js)
const DB_PATH = path.join(__dirname, '..', '..', 'oxford_tracker.db');

// Connect to database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Failed to connect to database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to the SQLite database');
});

// Kathleen Gibson's account details (matching what was created in create-kathleen-gibson.js)
const kathleenGibson = {
  id: 'kathleen-gibson-001',
  name: 'Kathleen Gibson',
  preferredName: 'Kathleen',
  email: 'kathleen.gibson@oxfordhouse.org',
  password: 'Kathleenwelcome1',
  oxfordHouseId: 'oxford-house-001',
  position: 'CEO',
  phoneNumber: '',
  baseAddress: '9016 Mustard Seed Ln, Garner, NC 27529',
  costCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
  selectedCostCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
  defaultCostCenter: 'PS-Unfunded',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

console.log('👤 Adding Kathleen Gibson to employees...');

// Check if Kathleen already exists
db.get(
  'SELECT id FROM employees WHERE id = ? OR email = ?',
  [kathleenGibson.id, kathleenGibson.email],
  (err, row) => {
    if (err) {
      console.error('❌ Error checking for existing employee:', err);
      db.close();
      process.exit(1);
    }

    if (row) {
      console.log('🔄 Kathleen Gibson already exists, updating...');
      
      // Update existing employee
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
        WHERE id = ?`,
        [
          kathleenGibson.name,
          kathleenGibson.preferredName,
          kathleenGibson.email,
          kathleenGibson.password,
          kathleenGibson.oxfordHouseId,
          kathleenGibson.position,
          kathleenGibson.phoneNumber,
          kathleenGibson.baseAddress,
          kathleenGibson.costCenters,
          kathleenGibson.selectedCostCenters,
          kathleenGibson.defaultCostCenter,
          kathleenGibson.updatedAt,
          kathleenGibson.id
        ],
        (err) => {
          if (err) {
            console.error('❌ Error updating Kathleen Gibson:', err);
            db.close();
            process.exit(1);
          }
          
          console.log('✅ Kathleen Gibson updated successfully');
          printAccountDetails();
        }
      );
    } else {
      console.log('➕ Creating new Kathleen Gibson account...');
      
      // Insert new employee
      db.run(
        `INSERT INTO employees (
          id, name, preferredName, email, password, oxfordHouseId, position, 
          phoneNumber, baseAddress, costCenters, selectedCostCenters, 
          defaultCostCenter, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          kathleenGibson.id,
          kathleenGibson.name,
          kathleenGibson.preferredName,
          kathleenGibson.email,
          kathleenGibson.password,
          kathleenGibson.oxfordHouseId,
          kathleenGibson.position,
          kathleenGibson.phoneNumber,
          kathleenGibson.baseAddress,
          kathleenGibson.costCenters,
          kathleenGibson.selectedCostCenters,
          kathleenGibson.defaultCostCenter,
          kathleenGibson.createdAt,
          kathleenGibson.updatedAt
        ],
        (err) => {
          if (err) {
            console.error('❌ Error creating Kathleen Gibson:', err);
            db.close();
            process.exit(1);
          }
          
          console.log('✅ Kathleen Gibson created successfully');
          printAccountDetails();
        }
      );
    }
  }
);

function printAccountDetails() {
  console.log('\n🎉 Kathleen Gibson Account Details:');
  console.log('=====================================');
  console.log('Employee ID:', kathleenGibson.id);
  console.log('Name:', kathleenGibson.name);
  console.log('Preferred Name:', kathleenGibson.preferredName);
  console.log('Email:', kathleenGibson.email);
  console.log('Password:', kathleenGibson.password);
  console.log('Position:', kathleenGibson.position);
  console.log('Base Address:', kathleenGibson.baseAddress);
  console.log('Default Cost Center:', kathleenGibson.defaultCostCenter);
  console.log('Selected Cost Centers:', JSON.parse(kathleenGibson.selectedCostCenters));
  console.log('=====================================\n');
  console.log('✅ Kathleen can now be selected from "Select from existing employees" on the mobile app login screen');
  console.log('✅ Script completed successfully\n');
  
  db.close();
}

