const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('../../oxford_tracker.db');

console.log('Starting employee deduplication...');

// First, show current count
db.get('SELECT COUNT(*) as count FROM employees', (err, row) => {
  if (err) {
    console.error('Error getting count:', err);
    return;
  }
  console.log('Current employee count:', row.count);
  
  // Run deduplication by name
  db.run(`
    DELETE FROM employees 
    WHERE id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY LOWER(TRIM(name))
          ORDER BY 
            CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END DESC,
            CASE WHEN phoneNumber IS NOT NULL AND phoneNumber != '' THEN 1 ELSE 0 END DESC,
            CASE WHEN baseAddress IS NOT NULL AND baseAddress != '' THEN 1 ELSE 0 END DESC,
            updatedAt DESC
        ) as rn
        FROM employees
      ) WHERE rn = 1
    )
  `, (err) => {
    if (err) {
      console.error('Error during deduplication:', err);
    } else {
      console.log('Deduplication completed');
      
      // Show new count
      db.get('SELECT COUNT(*) as count FROM employees', (countErr, row) => {
        if (!countErr) {
          console.log('Employee count after deduplication:', row.count);
        }
        db.close();
      });
    }
  });
});
