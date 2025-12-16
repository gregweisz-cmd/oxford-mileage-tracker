/**
 * Diagnostic script to check Aaron Torrance's report and supervisor assignment
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking Aaron Torrance\'s supervisor and reports...\n');

// Check Aaron Torrance's supervisor
db.get(
  `SELECT id, name, email, supervisorId 
   FROM employees 
   WHERE name LIKE '%Aaron%Torrance%' OR email LIKE '%aaron.torrance%'`,
  (err, employee) => {
    if (err) {
      console.error('❌ Error:', err);
      db.close();
      return;
    }

    if (!employee) {
      console.log('❌ Aaron Torrance not found in database');
      db.close();
      return;
    }

    console.log('👤 Employee Found:');
    console.log(`   ID: ${employee.id}`);
    console.log(`   Name: ${employee.name}`);
    console.log(`   Email: ${employee.email}`);
    console.log(`   Supervisor ID: ${employee.supervisorId || 'NULL (no supervisor assigned)'}`);
    console.log('');

    // Check Greg Weisz's ID
    db.get(
      `SELECT id, name, email FROM employees WHERE name LIKE '%Greg%Weisz%' OR email LIKE '%greg.weisz%'`,
      (err, greg) => {
        if (err) {
          console.error('❌ Error finding Greg Weisz:', err);
          db.close();
          return;
        }

        if (greg) {
          console.log('👤 Greg Weisz Found:');
          console.log(`   ID: ${greg.id}`);
          console.log(`   Name: ${greg.name}`);
          console.log(`   Email: ${greg.email}`);
          console.log('');

          if (employee.supervisorId === greg.id) {
            console.log('✅ Aaron Torrance has Greg Weisz as supervisor');
          } else {
            console.log('❌ Aaron Torrance does NOT have Greg Weisz as supervisor');
            console.log(`   Current supervisor ID: ${employee.supervisorId || 'NULL'}`);
            console.log(`   Expected supervisor ID: ${greg.id}`);
          }
        } else {
          console.log('⚠️  Greg Weisz not found in database');
        }

        console.log('');

        // Check recent reports by Aaron
        db.all(
          `SELECT id, employeeId, month, year, status, currentApproverId, currentApprovalStage, submittedAt, approvalWorkflow
           FROM expense_reports 
           WHERE employeeId = ?
           ORDER BY submittedAt DESC 
           LIMIT 5`,
          [employee.id],
          (err, reports) => {
            if (err) {
              console.error('❌ Error fetching reports:', err);
              db.close();
              return;
            }

            console.log(`📊 Recent Reports by Aaron Torrance (${reports.length} found):`);
            if (reports.length === 0) {
              console.log('   No reports found');
            } else {
              reports.forEach((report, index) => {
                console.log(`\n   Report ${index + 1}:`);
                console.log(`   ID: ${report.id}`);
                console.log(`   Month/Year: ${report.month}/${report.year}`);
                console.log(`   Status: ${report.status}`);
                console.log(`   Current Approver ID: ${report.currentApproverId || 'NULL'}`);
                console.log(`   Current Approval Stage: ${report.currentApprovalStage || 'NULL'}`);
                console.log(`   Submitted At: ${report.submittedAt || 'Not submitted'}`);
                
                if (report.approvalWorkflow) {
                  try {
                    const workflow = JSON.parse(report.approvalWorkflow);
                    console.log(`   Workflow Steps: ${workflow.length}`);
                    workflow.forEach((step, i) => {
                      console.log(`     Step ${i}: ${step.role} - ${step.status} (approver: ${step.approverId || 'none'})`);
                    });
                  } catch (e) {
                    console.log(`   Workflow: ${report.approvalWorkflow}`);
                  }
                }
              });
            }

            console.log('\n✅ Diagnostic complete');
            db.close();
          }
        );
      }
    );
  }
);

