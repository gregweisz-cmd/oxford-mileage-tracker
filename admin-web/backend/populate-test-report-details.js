const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('expense_tracker.db');

async function populateReportDetails() {
  console.log('📝 Adding line-item data to test reports...\n');

  const now = new Date().toISOString();
  
  // Get the test reports we just created
  const reports = await new Promise((resolve, reject) => {
    db.all(
      `SELECT mr.id, mr.employeeId, mr.month, mr.year, e.name 
       FROM monthly_reports mr 
       JOIN employees e ON mr.employeeId = e.id 
       WHERE mr.id LIKE 'test-report-1761575123%'`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

  console.log(`Found ${reports.length} test reports\n`);

  for (const report of reports) {
    console.log(`Adding data for ${report.name} (${report.year}/${report.month})`);
    
    const year = report.year;
    const month = report.month;

    // Create 10-15 random dates in the month
    const days = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let i = 0; i < Math.floor(Math.random() * 5 + 10); i++) {
      const day = Math.floor(Math.random() * daysInMonth + 1);
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push(date);
    }
    
    const uniqueDays = [...new Set(days)].sort();

    // Add mileage entries (about 8-12)
    const mileageCount = Math.floor(Math.random() * 4 + 8);
    for (let i = 0; i < mileageCount; i++) {
      const date = uniqueDays[Math.floor(Math.random() * uniqueDays.length)];
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO mileage_entries (id, employeeId, oxfordHouseId, date, odometerReading, startLocation, endLocation, miles, purpose, isGpsTracked, costCenter, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `mileage-${report.id}-${i}`,
            report.employeeId,
            'OH-001',
            date,
            Math.floor(Math.random() * 50000 + 100000),
            'Office',
            `Client Site ${i + 1}`,
            (Math.random() * 50 + 5).toFixed(1),
            `Meeting with client ${i + 1}`,
            i % 3 === 0 ? 1 : 0,
            'Program Services',
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

    // Add receipts (about 6-10)
    const receiptCount = Math.floor(Math.random() * 4 + 6);
    for (let i = 0; i < receiptCount; i++) {
      const date = uniqueDays[Math.floor(Math.random() * uniqueDays.length)];
      const vendors = ['Shell', 'Exxon', 'Starbucks', 'Office Depot', 'Amazon', 'Uber'];
      const categories = ['Gas', 'Meals', 'Office Supplies', 'Transportation', 'Other'];
      const amount = (Math.random() * 100 + 5).toFixed(2);
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO receipts (id, employeeId, date, amount, vendor, category, description, costCenter, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `receipt-${report.id}-${i}`,
            report.employeeId,
            date,
            amount,
            vendors[Math.floor(Math.random() * vendors.length)],
            categories[Math.floor(Math.random() * categories.length)],
            `Expense ${i + 1}`,
            'Program Services',
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

    // Add time entries (about 12-20)
    const timeCount = Math.floor(Math.random() * 8 + 12);
    for (let i = 0; i < timeCount; i++) {
      const date = uniqueDays[Math.floor(Math.random() * uniqueDays.length)];
      const categories = ['Client Services', 'Administration', 'Training', 'Travel', 'Meetings'];
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO time_tracking (id, employeeId, date, category, hours, description, costCenter, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `time-${report.id}-${i}`,
            report.employeeId,
            date,
            categories[Math.floor(Math.random() * categories.length)],
            (Math.random() * 6 + 2).toFixed(1),
            `Work session ${i + 1}`,
            'Program Services',
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

    console.log(`  ✅ Added ${mileageCount} mileage, ${receiptCount} receipts, ${timeCount} time entries\n`);
  }

  console.log('✅ All test report details populated!');
  db.close();
}

populateReportDetails().catch(console.error);

