const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path
const dbPath = path.join(__dirname, '..', '..', 'oxford_tracker.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to database');
});

// Create Per Diem rule for Program Services
const ruleId = Date.now().toString(36) + Math.random().toString(36).substr(2);
const now = new Date().toISOString();

const ruleData = {
  id: ruleId,
  costCenter: 'Program Services',
  maxAmount: 25,
  minHours: 8,
  minMiles: 100,
  minDistanceFromBase: 50,
  description: 'Program Services Per Diem Rule',
  useActualAmount: 1,
  createdAt: now,
  updatedAt: now
};

console.log('📝 Creating Per Diem rule for Program Services:', ruleData);

db.run(
  'INSERT OR REPLACE INTO per_diem_rules (id, costCenter, maxAmount, minHours, minMiles, minDistanceFromBase, description, useActualAmount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  [
    ruleData.id,
    ruleData.costCenter,
    ruleData.maxAmount,
    ruleData.minHours,
    ruleData.minMiles,
    ruleData.minDistanceFromBase,
    ruleData.description,
    ruleData.useActualAmount,
    ruleData.createdAt,
    ruleData.updatedAt
  ],
  function(err) {
    if (err) {
      console.error('❌ Error creating rule:', err.message);
    } else {
      console.log(`✅ Per Diem rule created successfully for ${ruleData.costCenter}`);
    }
    
    // Close database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('🔒 Database connection closed');
      }
    });
  }
);
