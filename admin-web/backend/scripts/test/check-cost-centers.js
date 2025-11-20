/**
 * Check Cost Centers in Generated Data
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking cost centers in generated data...\n');

// Check mileage entries
db.all(
  `SELECT DISTINCT costCenter, COUNT(*) as count 
   FROM mileage_entries 
   WHERE id LIKE 'mileage-%' 
   GROUP BY costCenter 
   ORDER BY count DESC 
   LIMIT 20`,
  (err, rows) => {
    if (err) {
      console.error('Error checking mileage entries:', err);
    } else {
      console.log('📊 Mileage Entry Cost Centers:');
      rows.forEach(r => {
        console.log(`   ${r.costCenter || '(null)'}: ${r.count} entries`);
      });
    }
    
    // Check receipts
    db.all(
      `SELECT DISTINCT costCenter, COUNT(*) as count 
       FROM receipts 
       WHERE id LIKE 'receipt-%' 
       GROUP BY costCenter 
       ORDER BY count DESC 
       LIMIT 20`,
      (err2, rows2) => {
        if (err2) {
          console.error('Error checking receipts:', err2);
        } else {
          console.log('\n🧾 Receipt Cost Centers:');
          rows2.forEach(r => {
            console.log(`   ${r.costCenter || '(null)'}: ${r.count} entries`);
          });
        }
        
        // Check time entries
        db.all(
          `SELECT DISTINCT costCenter, COUNT(*) as count 
           FROM time_tracking 
           WHERE id LIKE 'time-%' 
           GROUP BY costCenter 
           ORDER BY count DESC 
           LIMIT 20`,
          (err3, rows3) => {
            if (err3) {
              console.error('Error checking time entries:', err3);
            } else {
              console.log('\n⏰ Time Entry Cost Centers:');
              rows3.forEach(r => {
                console.log(`   ${r.costCenter || '(null)'}: ${r.count} entries`);
              });
            }
            
            // Check specific employees
            db.all(
              `SELECT e.name, e.selectedCostCenters, m.costCenter, COUNT(*) as count
               FROM employees e
               JOIN mileage_entries m ON e.id = m.employeeId
               WHERE m.id LIKE 'mileage-%'
               GROUP BY e.id, m.costCenter
               ORDER BY e.name, count DESC
               LIMIT 30`,
              (err4, rows4) => {
                if (err4) {
                  console.error('Error checking employees:', err4);
                } else {
                  console.log('\n👤 Employee Cost Center Distribution:');
                  
                  // Group by employee
                  const byEmployee = {};
                  rows4.forEach(r => {
                    if (!byEmployee[r.name]) {
                      byEmployee[r.name] = {
                        name: r.name,
                        costCenters: r.selectedCostCenters,
                        entries: []
                      };
                    }
                    byEmployee[r.name].entries.push({
                      costCenter: r.costCenter,
                      count: r.count
                    });
                  });
                  
                  // Show first 5 employees
                  let count = 0;
                  for (const name in byEmployee) {
                    if (count++ >= 5) break;
                    const emp = byEmployee[name];
                    let assignedCC = [];
                    try {
                      assignedCC = emp.costCenters ? JSON.parse(emp.costCenters) : [];
                    } catch (e) {}
                    
                    console.log(`\n   ${emp.name}:`);
                    console.log(`     Assigned: ${assignedCC.join(', ') || 'None'}`);
                    console.log(`     Used in entries:`);
                    emp.entries.forEach(e => {
                      console.log(`       ${e.costCenter}: ${e.count} entries`);
                    });
                  }
                }
                
                db.close();
              }
            );
          }
        );
      }
    );
  }
);

