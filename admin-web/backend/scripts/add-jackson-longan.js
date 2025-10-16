const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path - use production path for Render deployment
const DB_PATH = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, 'oxford_tracker.db')
  : path.join(__dirname, '../../oxford_tracker.db');

console.log('🔧 Adding Jackson Longan to production database...');

// Connect to database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Connected to the SQLite database');
  }
});

// Jackson Longan account data
const jacksonData = {
  id: 'jackson-longan-001',
  name: 'Jackson Longan',
  preferredName: 'Jackson',
  email: 'jackson.longan@oxfordhouse.org',
  password: 'Jacksonwelcome1',
  oxfordHouseId: 'oxford-house-006',
  position: 'Director of Communication and Information',
  phoneNumber: '(361) 563-1537',
  baseAddress: '425 Pergola St, Yukon, OK 73099',
  costCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
  selectedCostCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
  defaultCostCenter: 'PS-Unfunded',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Check if Jackson already exists
db.get('SELECT * FROM employees WHERE email = ?', [jacksonData.email], (err, existingEmployee) => {
  if (err) {
    console.error('❌ Error checking existing employee:', err);
    process.exit(1);
  }

  if (existingEmployee) {
    console.log('🔄 Jackson Longan already exists, updating...');
    
    // Update existing employee
    const updateQuery = `
      UPDATE employees SET
        name = ?, preferredName = ?, password = ?, oxfordHouseId = ?, 
        position = ?, phoneNumber = ?, baseAddress = ?, costCenters = ?, 
        selectedCostCenters = ?, defaultCostCenter = ?, updatedAt = ?
      WHERE email = ?
    `;
    
    db.run(updateQuery, [
      jacksonData.name, jacksonData.preferredName, jacksonData.password,
      jacksonData.oxfordHouseId, jacksonData.position, jacksonData.phoneNumber,
      jacksonData.baseAddress, jacksonData.costCenters, jacksonData.selectedCostCenters,
      jacksonData.defaultCostCenter, jacksonData.updatedAt, jacksonData.email
    ], function(err) {
      if (err) {
        console.error('❌ Error updating Jackson Longan:', err);
        process.exit(1);
      }
      console.log('✅ Jackson Longan updated successfully');
      console.log('📧 Email:', jacksonData.email);
      console.log('🔑 Password:', jacksonData.password);
      console.log('👤 Position:', jacksonData.position);
      process.exit(0);
    });
  } else {
    console.log('➕ Creating new Jackson Longan account...');
    
    // Insert new employee
    const insertQuery = `
      INSERT INTO employees (
        id, name, preferredName, email, password, oxfordHouseId, position, 
        phoneNumber, baseAddress, costCenters, selectedCostCenters, 
        defaultCostCenter, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(insertQuery, [
      jacksonData.id, jacksonData.name, jacksonData.preferredName, jacksonData.email,
      jacksonData.password, jacksonData.oxfordHouseId, jacksonData.position,
      jacksonData.phoneNumber, jacksonData.baseAddress, jacksonData.costCenters,
      jacksonData.selectedCostCenters, jacksonData.defaultCostCenter,
      jacksonData.createdAt, jacksonData.updatedAt
    ], function(err) {
      if (err) {
        console.error('❌ Error creating Jackson Longan:', err);
        process.exit(1);
      }
      console.log('✅ Jackson Longan created successfully');
      console.log('📧 Email:', jacksonData.email);
      console.log('🔑 Password:', jacksonData.password);
      console.log('👤 Position:', jacksonData.position);
      process.exit(0);
    });
  }
});
