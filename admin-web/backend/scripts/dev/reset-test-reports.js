const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'expense_tracker.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Connected to the SQLite database');
  }
});

// Reset all test reports to 'submitted' status
db.run(
  `UPDATE monthly_reports 
   SET status = 'submitted',
       reviewedAt = NULL,
       reviewedBy = NULL,
       approvedAt = NULL,
       approvedBy = NULL,
       updatedAt = ?
   WHERE id LIKE 'test-report-%'`,
  [new Date().toISOString()],
  function(err) {
    if (err) {
      console.error('❌ Error resetting reports:', err.message);
      process.exit(1);
    } else {
      console.log(`✅ Reset ${this.changes} test reports to 'submitted' status`);
      
      // Clear all revision flags from line items
      db.run(
        `UPDATE mileage_entries SET needsRevision = 0, revisionRequestBy = NULL, revisionRequestedAt = NULL, revisionReason = NULL WHERE employeeId IN (SELECT employeeId FROM monthly_reports WHERE id LIKE 'test-report-%')`,
        (err) => {
          if (err) {
            console.error('❌ Error clearing mileage entry revisions:', err);
          } else {
            console.log('✅ Cleared revision flags from mileage entries');
          }
          
          db.run(
            `UPDATE receipts SET needsRevision = 0, revisionRequestBy = NULL, revisionRequestedAt = NULL, revisionReason = NULL WHERE employeeId IN (SELECT employeeId FROM monthly_reports WHERE id LIKE 'test-report-%')`,
            (err) => {
              if (err) {
                console.error('❌ Error clearing receipt revisions:', err);
              } else {
                console.log('✅ Cleared revision flags from receipts');
              }
              
              db.run(
                `UPDATE time_tracking SET needsRevision = 0, revisionRequestBy = NULL, revisionRequestedAt = NULL, revisionReason = NULL WHERE employeeId IN (SELECT employeeId FROM monthly_reports WHERE id LIKE 'test-report-%')`,
                (err) => {
                  if (err) {
                    console.error('❌ Error clearing time tracking revisions:', err);
                  } else {
                    console.log('✅ Cleared revision flags from time tracking');
                  }
                  
                  db.close((err) => {
                    if (err) {
                      console.error('❌ Error closing database:', err.message);
                    } else {
                      console.log('✅ Database connection closed');
                    }
                    process.exit(0);
                  });
                }
              );
            }
          );
        }
      );
    }
  }
);

