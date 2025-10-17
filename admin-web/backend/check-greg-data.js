const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(DB_PATH);

console.log('🔍 Checking Greg Weisz data in backend database...\n');

// Find Greg Weisz employee
db.get(`SELECT * FROM employees WHERE name LIKE '%Greg%Weisz%' OR name LIKE '%Weisz%'`, (err, employee) => {
  if (err) {
    console.error('❌ Error:', err);
    db.close();
    return;
  }
  
  if (!employee) {
    console.log('❌ Greg Weisz not found in employees table');
    console.log('\nAll employees:');
    db.all('SELECT id, name, email FROM employees LIMIT 10', (err, rows) => {
      if (err) console.error(err);
      else console.table(rows);
      db.close();
    });
    return;
  }
  
  console.log('✅ Found employee:', employee.name);
  console.log('   ID:', employee.id);
  console.log('   Email:', employee.email);
  console.log('   Cost Centers:', employee.costCenters);
  console.log('');
  
  const employeeId = employee.id;
  
  // Check mileage entries
  db.all(`SELECT id, date, startLocation, endLocation, miles, isGpsTracked 
          FROM mileage_entries 
          WHERE employeeId = ? 
          ORDER BY date DESC LIMIT 10`, 
    [employeeId], 
    (err, entries) => {
      if (err) {
        console.error('❌ Error fetching mileage entries:', err);
      } else {
        console.log(`\n📊 Mileage Entries for ${employee.name}: ${entries.length} found`);
        if (entries.length > 0) {
          console.table(entries);
        }
      }
      
      // Check receipts
      db.all(`SELECT id, date, vendor, amount, category 
              FROM receipts 
              WHERE employeeId = ? 
              ORDER BY date DESC LIMIT 10`, 
        [employeeId], 
        (err, receipts) => {
          if (err) {
            console.error('❌ Error fetching receipts:', err);
          } else {
            console.log(`\n🧾 Receipts for ${employee.name}: ${receipts.length} found`);
            if (receipts.length > 0) {
              console.table(receipts);
            }
          }
          
          // Check time tracking
          db.all(`SELECT id, date, hours 
                  FROM time_tracking 
                  WHERE employeeId = ? 
                  ORDER BY date DESC LIMIT 10`, 
            [employeeId], 
            (err, timeEntries) => {
              if (err) {
                console.error('❌ Error fetching time tracking:', err);
              } else {
                console.log(`\n⏰ Time Tracking for ${employee.name}: ${timeEntries.length} found`);
                if (timeEntries.length > 0) {
                  console.table(timeEntries);
                }
              }
              
              // Check daily descriptions
              db.all(`SELECT id, date, description 
                      FROM daily_descriptions 
                      WHERE employeeId = ? 
                      ORDER BY date DESC LIMIT 10`, 
                [employeeId], 
                (err, descriptions) => {
                  if (err) {
                    console.error('❌ Error fetching daily descriptions:', err);
                  } else {
                    console.log(`\n📝 Daily Descriptions for ${employee.name}: ${descriptions.length} found`);
                    if (descriptions.length > 0) {
                      console.table(descriptions);
                    }
                  }
                  
                  console.log('\n✅ Diagnostic complete!');
                  db.close();
                }
              );
            }
          );
        }
      );
    }
  );
});

