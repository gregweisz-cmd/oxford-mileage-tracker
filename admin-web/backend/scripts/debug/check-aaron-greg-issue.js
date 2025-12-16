/**
 * Diagnostic script to check why Aaron Torrence's report isn't showing for Greg Weisz
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking Aaron Torrence\'s report and supervisor assignment...\n');

// Step 1: Find Aaron Torrence
db.get(
  `SELECT id, name, email, supervisorId 
   FROM employees 
   WHERE name LIKE '%Aaron%Torrence%' OR email LIKE '%aaron.torrance%' OR email LIKE '%aaron.torrence%'`,
  (err, aaron) => {
    if (err) {
      console.error('❌ Error finding Aaron:', err);
      db.close();
      return;
    }

    if (!aaron) {
      console.log('❌ Aaron Torrence not found in database');
      console.log('   Searching for similar names...');
      db.all(
        `SELECT id, name, email FROM employees WHERE name LIKE '%Aaron%' OR email LIKE '%aaron%'`,
        (err, similar) => {
          if (err) console.error(err);
          else if (similar && similar.length > 0) {
            console.log('   Found similar employees:');
            similar.forEach(emp => console.log(`     - ${emp.name} (${emp.email})`));
          }
          db.close();
        }
      );
      return;
    }

    console.log('✅ Aaron Torrence Found:');
    console.log(`   ID: ${aaron.id}`);
    console.log(`   Name: ${aaron.name}`);
    console.log(`   Email: ${aaron.email}`);
    console.log(`   Supervisor ID: ${aaron.supervisorId || 'NULL (no supervisor assigned!)'}`);
    console.log('');

    // Step 2: Find Greg Weisz
    db.get(
      `SELECT id, name, email FROM employees WHERE name LIKE '%Greg%Weisz%' OR email LIKE '%greg.weisz%'`,
      (err, greg) => {
        if (err) {
          console.error('❌ Error finding Greg Weisz:', err);
          db.close();
          return;
        }

        if (!greg) {
          console.log('❌ Greg Weisz not found in database');
          db.close();
          return;
        }

        console.log('✅ Greg Weisz Found:');
        console.log(`   ID: ${greg.id}`);
        console.log(`   Name: ${greg.name}`);
        console.log(`   Email: ${greg.email}`);
        console.log('');

        // Step 3: Check supervisor assignment
        if (aaron.supervisorId === greg.id) {
          console.log('✅ Aaron Torrence HAS Greg Weisz as supervisor');
        } else {
          console.log('❌ PROBLEM: Aaron Torrence does NOT have Greg Weisz as supervisor!');
          console.log(`   Current supervisor ID: ${aaron.supervisorId || 'NULL'}`);
          console.log(`   Expected supervisor ID: ${greg.id}`);
          console.log('');
          console.log('💡 SOLUTION: Assign Greg Weisz as Aaron\'s supervisor in Admin Portal → Employee Management');
        }
        console.log('');

        // Step 4: Find recent reports by Aaron
        db.all(
          `SELECT 
            id, 
            employeeId, 
            month, 
            year, 
            status, 
            currentApproverId, 
            currentApprovalStage, 
            submittedAt,
            approvalWorkflow
           FROM expense_reports 
           WHERE employeeId = ?
           ORDER BY submittedAt DESC, year DESC, month DESC
           LIMIT 10`,
          [aaron.id],
          (err, reports) => {
            if (err) {
              console.error('❌ Error fetching reports:', err);
              db.close();
              return;
            }

            console.log(`📊 Recent Reports by Aaron Torrence (${reports.length} found):`);
            if (reports.length === 0) {
              console.log('   ⚠️  No reports found for Aaron Torrence');
            } else {
              reports.forEach((report, index) => {
                console.log(`\n   Report ${index + 1}:`);
                console.log(`   ID: ${report.id}`);
                console.log(`   Period: ${report.month}/${report.year}`);
                console.log(`   Status: ${report.status || 'NULL'}`);
                console.log(`   Current Approver ID: ${report.currentApproverId || 'NULL'}`);
                console.log(`   Current Approval Stage: ${report.currentApprovalStage || 'NULL'}`);
                console.log(`   Submitted At: ${report.submittedAt || 'Not submitted'}`);
                
                // Check if this report should show for Greg
                const shouldShow = (
                  (report.status === 'submitted' || report.status === 'pending_supervisor') &&
                  (report.currentApproverId === greg.id || (!report.currentApproverId && aaron.supervisorId === greg.id))
                );
                
                if (shouldShow) {
                  console.log(`   ✅ This report SHOULD appear for Greg Weisz`);
                } else {
                  console.log(`   ❌ This report will NOT appear for Greg Weisz because:`);
                  if (report.status !== 'submitted' && report.status !== 'pending_supervisor') {
                    console.log(`      - Status is "${report.status}" (needs to be "submitted" or "pending_supervisor")`);
                  }
                  if (report.currentApproverId !== greg.id && aaron.supervisorId !== greg.id) {
                    console.log(`      - Approver mismatch (currentApproverId: ${report.currentApproverId || 'NULL'}, supervisorId: ${aaron.supervisorId || 'NULL'})`);
                  }
                }
                
                if (report.approvalWorkflow) {
                  try {
                    const workflow = JSON.parse(report.approvalWorkflow);
                    if (workflow && workflow.length > 0) {
                      console.log(`   Workflow Steps: ${workflow.length}`);
                      workflow.forEach((step, i) => {
                        const isCurrent = i === 0 && step.status === 'pending';
                        console.log(`     Step ${i}: ${step.role} - ${step.status} (approver: ${step.approverId || 'none'})${isCurrent ? ' ← CURRENT' : ''}`);
                      });
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              });
            }

            console.log('\n📋 SUMMARY:');
            if (aaron.supervisorId !== greg.id) {
              console.log('   ❌ Aaron Torrence needs to be assigned to Greg Weisz as supervisor');
            }
            const pendingReports = reports.filter(r => 
              (r.status === 'submitted' || r.status === 'pending_supervisor') &&
              (r.currentApproverId === greg.id || (!r.currentApproverId && aaron.supervisorId === greg.id))
            );
            if (pendingReports.length === 0 && reports.length > 0) {
              console.log('   ⚠️  Aaron has reports, but none are in pending status for Greg');
            } else if (pendingReports.length > 0) {
              console.log(`   ✅ Found ${pendingReports.length} pending report(s) that should appear for Greg`);
            }

            console.log('\n✅ Diagnostic complete');
            db.close();
          }
        );
      }
    );
  }
);

