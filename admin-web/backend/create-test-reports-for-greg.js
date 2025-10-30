const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

async function createTestReports() {
  console.log('🧪 Creating test monthly reports for Greg\'s team...\n');

  const now = new Date().toISOString();
  const currentMonth = 10; // October
  const currentYear = 2025;

  // Get specific test employees who report to Greg
  const testEmployees = [
    { id: 'mh96jo4qry67z3hn41', name: 'Jackson Longan' },
    { id: 'mh96jpno84imsnxfupl', name: 'Kathleen Gibson' },
    { id: 'alex-szary-001', name: 'Alex Szary' }
  ];

  console.log(`Creating reports for ${testEmployees.length} employees\n`);

  for (let i = 0; i < testEmployees.length; i++) {
    const employee = testEmployees[i];
    const reportId = `test-report-${Date.now()}-${i}`;
    
    // Calculate random totals
    const totalMiles = Math.floor(Math.random() * 500 + 100);
    const totalExpenses = Math.floor(Math.random() * 2000 + 500);

    console.log(`Creating report for ${employee.name}...`);

    // Create monthly report
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO monthly_reports (id, employeeId, month, year, totalMiles, totalExpenses, status, submittedAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [reportId, employee.id, currentMonth, currentYear, totalMiles, totalExpenses, 'submitted', now, now, now],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    console.log(`  ✅ Report ${reportId} created: ${totalMiles} miles, $${totalExpenses} expenses\n`);
  }

  console.log('✅ All test reports created!\n');
  db.close();
}

createTestReports().catch(console.error);

