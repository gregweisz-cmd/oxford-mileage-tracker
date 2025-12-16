/**
 * Fix Aaron Torrence's October 2025 report to have correct approval stage and approver
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../expense_tracker.db');
const db = new sqlite3.Database(dbPath);

const reportId = 'report-mh96jn9ddvinqe2nnqi-2025-10';
const gregId = 'greg-weisz-001';

console.log('🔧 Fixing Aaron Torrence\'s October 2025 report...\n');

// First, get Greg's name
db.get(
  `SELECT name, preferredName FROM employees WHERE id = ?`,
  [gregId],
  (err, greg) => {
    if (err) {
      console.error('❌ Error finding Greg:', err);
      db.close();
      return;
    }

    if (!greg) {
      console.error('❌ Greg Weisz not found');
      db.close();
      return;
    }

    const gregName = greg.preferredName || greg.name || 'Greg Weisz';

    // Update the report
    db.run(
      `UPDATE expense_reports 
       SET currentApprovalStage = 'pending_supervisor',
           currentApproverId = ?,
           currentApproverName = ?,
           updatedAt = datetime('now')
       WHERE id = ?`,
      [gregId, gregName, reportId],
      function(updateErr) {
        if (updateErr) {
          console.error('❌ Error updating report:', updateErr);
          db.close();
          return;
        }

        if (this.changes === 0) {
          console.log('⚠️  Report not found or already updated');
        } else {
          console.log('✅ Report updated successfully!');
          console.log(`   - currentApprovalStage: 'pending_supervisor'`);
          console.log(`   - currentApproverId: '${gregId}'`);
          console.log(`   - currentApproverName: '${gregName}'`);
          console.log('\n💡 The report should now appear in Greg Weisz\'s "Needs Revision" tab');
        }

        // Verify the update
        db.get(
          `SELECT id, status, currentApprovalStage, currentApproverId, currentApproverName 
           FROM expense_reports 
           WHERE id = ?`,
          [reportId],
          (err, report) => {
            if (err) {
              console.error('❌ Error verifying update:', err);
            } else if (report) {
              console.log('\n📋 Verification:');
              console.log(`   Report ID: ${report.id}`);
              console.log(`   Status: ${report.status}`);
              console.log(`   Current Approval Stage: ${report.currentApprovalStage}`);
              console.log(`   Current Approver ID: ${report.currentApproverId}`);
              console.log(`   Current Approver Name: ${report.currentApproverName}`);
            }
            db.close();
          }
        );
      }
    );
  }
);

