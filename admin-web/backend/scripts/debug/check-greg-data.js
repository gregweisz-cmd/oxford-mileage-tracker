const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(DB_PATH);

console.log('Checking data for Greg Weisz...\n');

// Check mileage entries by month
db.all(`
  SELECT 
    strftime('%m', date) as month,
    strftime('%Y', date) as year,
    COUNT(*) as count,
    SUM(miles) as total_miles
  FROM mileage_entries 
  WHERE employeeId = 'greg-weisz-001'
  GROUP BY strftime('%Y', date), strftime('%m', date)
  ORDER BY year DESC, month DESC
`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Mileage entries by month:');
    console.log(JSON.stringify(rows, null, 2));
  }
});

// Check receipts by month
db.all(`
  SELECT 
    strftime('%m', date) as month,
    strftime('%Y', date) as year,
    COUNT(*) as count,
    SUM(amount) as total_amount
  FROM receipts 
  WHERE employeeId = 'greg-weisz-001'
  GROUP BY strftime('%Y', date), strftime('%m', date)
  ORDER BY year DESC, month DESC
`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('\nReceipts by month:');
    console.log(JSON.stringify(rows, null, 2));
  }
});

// Check expense reports
db.all(`
  SELECT month, year, status 
  FROM expense_reports 
  WHERE employeeId = 'greg-weisz-001'
  ORDER BY year DESC, month DESC
`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('\nExpense reports:');
    console.log(JSON.stringify(rows, null, 2));
  }
  
  db.close();
});

