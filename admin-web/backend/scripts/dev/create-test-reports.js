const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

async function createTestReports() {
  console.log('🧪 Creating test monthly reports...\n');

  const now = new Date().toISOString();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Get employee IDs
  const employees = await new Promise((resolve, reject) => {
    db.all('SELECT id, name FROM employees LIMIT 4', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  console.log(`Found ${employees.length} employees`);

  for (let i = 0; i < employees.length; i++) {
    const employee = employees[i];
    const reportId = `test-report-${Date.now()}-${i}`;
    
    // Calculate random totals
    const totalMiles = Math.floor(Math.random() * 500 + 100);
    const totalExpenses = Math.floor(Math.random() * 2000 + 500);
    
    // Different statuses
    const statuses = ['draft', 'submitted', 'approved', 'needs_revision'];
    const status = statuses[i % 4];
    
    // Create monthly report
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO monthly_reports (id, employeeId, month, year, totalMiles, totalExpenses, status, submittedAt, submittedBy, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [reportId, employee.id, currentMonth, currentYear, totalMiles, totalExpenses, status, now, 'system', now, now],
        function(err) {
          if (err) {
            console.error(`❌ Error creating report for ${employee.name}:`, err);
            reject(err);
          } else {
            console.log(`✅ Created ${status} report for ${employee.name}: ${totalMiles} miles, $${totalExpenses}`);
            resolve();
          }
        }
      );
    });

    // Create sample mileage entries
    let odometerReading = 50000;
    for (let j = 0; j < 10; j++) {
      const entryDate = new Date(currentYear, currentMonth - 1, Math.floor(Math.random() * 28 + 1));
      const miles = Math.floor(Math.random() * 50 + 10);
      odometerReading += miles;
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO mileage_entries (id, employeeId, oxfordHouseId, date, odometerReading, startLocation, endLocation, miles, purpose, isGpsTracked, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `mileage-${reportId}-${j}`,
            employee.id,
            'OH-001',
            entryDate.toISOString().split('T')[0],
            odometerReading,
            'Office',
            `Client Site ${j + 1}`,
            miles,
            `Meeting with client ${j + 1}`,
            0,
            now,
            now
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Create sample receipts
    const vendors = ['Shell', 'BP', 'Walmart', 'Office Depot', 'Starbucks', 'Amazon'];
    const categories = ['Gas', 'Office Supplies', 'Meals', 'Parking', 'Tolls'];
    
    for (let j = 0; j < 8; j++) {
      const entryDate = new Date(currentYear, currentMonth - 1, Math.floor(Math.random() * 28 + 1));
      const amount = Math.floor(Math.random() * 100 + 5);
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO receipts (id, employeeId, date, amount, vendor, category, description, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `receipt-${reportId}-${j}`,
            employee.id,
            entryDate.toISOString().split('T')[0],
            amount,
            vendors[j % vendors.length],
            categories[j % categories.length],
            `Expense for ${categories[j % categories.length]}`,
            now,
            now
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Create sample time tracking entries
    const timeCategories = ['Field Work', 'Administrative', 'Meetings', 'Training'];
    
    for (let j = 0; j < 15; j++) {
      const entryDate = new Date(currentYear, currentMonth - 1, Math.floor(Math.random() * 28 + 1));
      const hours = Math.floor(Math.random() * 8 + 2);
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO time_tracking (id, employeeId, date, category, hours, description, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `time-${reportId}-${j}`,
            employee.id,
            entryDate.toISOString().split('T')[0],
            timeCategories[j % timeCategories.length],
            hours,
            `${timeCategories[j % timeCategories.length]} hours`,
            now,
            now
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }

  console.log('\n✅ Test reports created successfully!');
  console.log('\nTest data created:');
  console.log('- 4 monthly reports with different statuses');
  console.log('- 40 mileage entries (10 per employee)');
  console.log('- 32 receipts (8 per employee)');
  console.log('- 60 time tracking entries (15 per employee)');
  
  db.close();
}

createTestReports().catch(console.error);

