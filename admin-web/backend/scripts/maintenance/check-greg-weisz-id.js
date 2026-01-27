/**
 * Script to check all Greg Weisz employee records and their associated data
 */

const dbService = require('../../services/dbService');
const path = require('path');

// Initialize database
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../../oxford_tracker.db');
dbService.initDatabase(dbPath);

const db = dbService.getDb();

console.log('🔍 Checking Greg Weisz employee records...\n');

// Find all employees with "Greg" or "Weisz" in the name
db.all(
  `SELECT id, name, email, createdAt, updatedAt FROM employees 
   WHERE LOWER(name) LIKE '%greg%' OR LOWER(name) LIKE '%weisz%'
   ORDER BY createdAt`,
  [],
  (err, employees) => {
    if (err) {
      console.error('❌ Error fetching employees:', err);
      process.exit(1);
    }
    
    if (employees.length === 0) {
      console.log('❌ No employees found with "Greg" or "Weisz" in the name\n');
      process.exit(0);
    }
    
    console.log(`Found ${employees.length} employee record(s):\n`);
    
    employees.forEach((emp, index) => {
      console.log(`${index + 1}. Name: ${emp.name}`);
      console.log(`   ID: ${emp.id}`);
      console.log(`   Email: ${emp.email || '(no email)'}`);
      console.log(`   Created: ${emp.createdAt}`);
      console.log(`   Updated: ${emp.updatedAt}`);
      
      // Check for data associated with this ID
      db.all(
        `SELECT 
          (SELECT COUNT(*) FROM mileage_entries WHERE employeeId = ?) as mileage_count,
          (SELECT COUNT(*) FROM receipts WHERE employeeId = ?) as receipts_count,
          (SELECT COUNT(*) FROM time_tracking WHERE employeeId = ?) as time_count,
          (SELECT COUNT(*) FROM daily_descriptions WHERE employeeId = ?) as descriptions_count
        `,
        [emp.id, emp.id, emp.id, emp.id],
        (err, counts) => {
          if (!err && counts && counts.length > 0) {
            const data = counts[0];
            console.log(`   Data: ${data.mileage_count} mileage entries, ${data.receipts_count} receipts, ${data.time_count} time entries, ${data.descriptions_count} descriptions`);
            
            // Check for recent time tracking entries (January 2026)
            db.all(
              `SELECT date, category, hours, costCenter, id 
               FROM time_tracking 
               WHERE employeeId = ? 
               AND date >= '2026-01-01' 
               AND date < '2026-02-01'
               ORDER BY date, category`,
              [emp.id],
              (err, timeEntries) => {
                if (!err && timeEntries && timeEntries.length > 0) {
                  console.log(`   Recent time entries (Jan 2026): ${timeEntries.length}`);
                  // Group by date
                  const byDate = {};
                  timeEntries.forEach(entry => {
                    const date = entry.date.split('T')[0];
                    if (!byDate[date]) byDate[date] = [];
                    byDate[date].push(entry);
                  });
                  
                  Object.keys(byDate).sort().forEach(date => {
                    const entries = byDate[date];
                    const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);
                    console.log(`      ${date}: ${entries.length} entries, ${totalHours} total hours`);
                    entries.forEach(e => {
                      console.log(`         - ${e.category || '(no category)'}: ${e.hours} hours (ID: ${e.id})`);
                    });
                  });
                }
              }
            );
          }
          console.log('');
        }
      );
    });
    
    // Wait a bit for async queries to complete
    setTimeout(() => {
      console.log('\n💡 If you see multiple Greg Weisz records:');
      console.log('   - Check which ID the mobile app is using');
      console.log('   - Check which ID the web portal is using');
      console.log('   - They should match!');
      process.exit(0);
    }, 2000);
  }
);
