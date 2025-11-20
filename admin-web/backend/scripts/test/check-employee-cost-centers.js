/**
 * Check Employee Cost Center Assignments
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking employee cost center assignments...\n');

db.all(
  `SELECT name, selectedCostCenters, defaultCostCenter, costCenters 
   FROM employees 
   WHERE (archived IS NULL OR archived = 0)
   LIMIT 10`,
  (err, rows) => {
    if (err) {
      console.error('Error:', err);
      db.close();
      return;
    }
    
    rows.forEach(emp => {
      let selected = [];
      let available = [];
      
      try {
        selected = emp.selectedCostCenters ? JSON.parse(emp.selectedCostCenters) : [];
      } catch (e) {}
      
      try {
        available = emp.costCenters ? JSON.parse(emp.costCenters) : [];
      } catch (e) {}
      
      console.log(`${emp.name}:`);
      console.log(`  Selected Cost Centers: ${selected.length > 0 ? selected.join(', ') : 'None'}`);
      console.log(`  Available Cost Centers: ${available.length > 0 ? available.join(', ') : 'None'}`);
      console.log(`  Default: ${emp.defaultCostCenter || 'None'}`);
      console.log('');
    });
    
    db.close();
  }
);

