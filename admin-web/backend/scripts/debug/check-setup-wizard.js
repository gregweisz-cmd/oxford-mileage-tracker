const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
});

console.log('Checking setup wizard columns and values...\n');

// First, check if columns exist
db.all("PRAGMA table_info(employees)", (err, columns) => {
  if (err) {
    console.error('Error getting table info:', err);
    db.close();
    return;
  }
  
  const hasOnboarding = columns.some(col => col.name === 'hasCompletedOnboarding');
  const hasWizard = columns.some(col => col.name === 'hasCompletedSetupWizard');
  
  console.log('Columns exist:');
  console.log(`  hasCompletedOnboarding: ${hasOnboarding}`);
  console.log(`  hasCompletedSetupWizard: ${hasWizard}`);
  console.log('');
  
  // Now check values for all employees
  db.all(`
    SELECT 
      id,
      name,
      email,
      hasCompletedOnboarding,
      hasCompletedSetupWizard,
      typeof(hasCompletedOnboarding) as onboardingType,
      typeof(hasCompletedSetupWizard) as wizardType
    FROM employees
    LIMIT 10
  `, (err, rows) => {
    if (err) {
      console.error('Error querying employees:', err);
      db.close();
      return;
    }
    
    console.log('Employee values:');
    rows.forEach(row => {
      console.log(`  ${row.name} (${row.email}):`);
      console.log(`    hasCompletedOnboarding: ${row.hasCompletedOnboarding} (type: ${row.onboardingType})`);
      console.log(`    hasCompletedSetupWizard: ${row.hasCompletedSetupWizard} (type: ${row.wizardType})`);
      console.log('');
    });
    
    db.close();
  });
});

