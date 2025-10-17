const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'oxford_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking Greg Weisz cost center data...\n');

db.get(
  'SELECT id, name, email, costCenters, selectedCostCenters, defaultCostCenter FROM employees WHERE email LIKE "%greg.weisz%" OR name LIKE "%Greg Weisz%"',
  (err, row) => {
    if (err) {
      console.error('Error:', err);
    } else if (row) {
      console.log('Employee:', row.name);
      console.log('ID:', row.id);
      console.log('Email:', row.email);
      console.log('Cost Centers (raw):', row.costCenters);
      console.log('Selected Cost Centers (raw):', row.selectedCostCenters);
      console.log('Default Cost Center:', row.defaultCostCenter);
      
      // Try to parse cost centers
      try {
        if (row.costCenters) {
          const parsed = JSON.parse(row.costCenters);
          console.log('\nCost Centers (parsed):', parsed);
        }
      } catch (e) {
        console.error('\n❌ Error parsing costCenters:', e.message);
      }
      
      try {
        if (row.selectedCostCenters) {
          const parsed = JSON.parse(row.selectedCostCenters);
          console.log('Selected Cost Centers (parsed):', parsed);
        }
      } catch (e) {
        console.error('❌ Error parsing selectedCostCenters:', e.message);
      }
    } else {
      console.log('❌ Greg Weisz not found in database');
    }
    
    db.close();
  }
);

