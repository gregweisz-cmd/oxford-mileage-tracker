const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(DB_PATH);

console.log('🔍 Checking ALL mileage entries in backend database...\n');

// Get all mileage entries with employee info
db.all(`
  SELECT 
    m.id,
    m.employeeId,
    e.name as employeeName,
    m.date,
    m.startLocation,
    m.endLocation,
    m.miles,
    m.isGpsTracked,
    m.createdAt
  FROM mileage_entries m
  LEFT JOIN employees e ON m.employeeId = e.id
  ORDER BY m.createdAt DESC
  LIMIT 20
`, (err, entries) => {
  if (err) {
    console.error('❌ Error:', err);
    db.close();
    return;
  }
  
  console.log(`📊 Total Recent Mileage Entries: ${entries.length}\n`);
  
  if (entries.length > 0) {
    console.table(entries);
    
    // Group by employee
    const byEmployee = {};
    entries.forEach(entry => {
      const empId = entry.employeeId;
      if (!byEmployee[empId]) {
        byEmployee[empId] = {
          employeeId: empId,
          name: entry.employeeName || 'Unknown',
          count: 0
        };
      }
      byEmployee[empId].count++;
    });
    
    console.log('\n📊 Entries by Employee:');
    console.table(Object.values(byEmployee));
  } else {
    console.log('❌ No mileage entries found in database\n');
    
    // Check if there are ANY entries at all
    db.get('SELECT COUNT(*) as count FROM mileage_entries', (err, result) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log(`Total entries in database: ${result.count}`);
      }
      
      // List all employees
      db.all('SELECT id, name, email FROM employees ORDER BY name LIMIT 10', (err, employees) => {
        if (err) {
          console.error('Error:', err);
        } else {
          console.log('\n👥 Sample Employees in Database:');
          console.table(employees);
        }
        db.close();
      });
    });
  }
});

