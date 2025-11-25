/**
 * Add Demo Notifications Script
 * Creates sample notifications for testing the notification system
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbService = require('../../services/dbService');
const notificationService = require('../../services/notificationService');

const DB_PATH = path.join(__dirname, '../../expense_tracker.db');

async function addDemoNotifications() {
  console.log('🚀 Starting demo notifications creation...');

  try {
    // Initialize database
    await dbService.initDatabase();
    const db = dbService.getDb();

    // Get all employees to create notifications for
    const employees = await new Promise((resolve, reject) => {
      db.all('SELECT id, name, preferredName, email, role FROM employees WHERE (archived IS NULL OR archived = 0) LIMIT 20', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    console.log(`📊 Found ${employees.length} employees`);

    if (employees.length === 0) {
      console.log('⚠️ No employees found. Please ensure the database has employee data.');
      return;
    }

    // Find employees by role
    const employeeUsers = employees.filter(e => (e.role || 'employee') === 'employee');
    const supervisors = employees.filter(e => (e.role || 'supervisor') === 'supervisor' || (e.role || 'employee') === 'supervisor');
    const financeUsers = employees.filter(e => (e.role || 'finance') === 'finance');
    const admins = employees.filter(e => (e.role || 'admin') === 'admin');

    console.log(`👥 Roles breakdown:`);
    console.log(`   Employees: ${employeeUsers.length}`);
    console.log(`   Supervisors: ${supervisors.length}`);
    console.log(`   Finance: ${financeUsers.length}`);
    console.log(`   Admins: ${admins.length}`);

    const notificationsCreated = [];

    // Create notifications for employees
    if (employeeUsers.length > 0) {
      const employee = employeeUsers[0];
      
      // Sunday reminder notification
      const sundayNotif = await notificationService.createNotification({
        recipientId: employee.id,
        recipientRole: 'employee',
        type: 'sunday_reminder',
        title: 'Reminder: Submit Your Expense Report',
        message: 'This is a friendly reminder to submit your expense report for the week. Please log in to complete your expenses.',
        sendEmail: false, // Don't send emails for demo
        isDismissible: true,
      });
      if (sundayNotif) notificationsCreated.push({ type: 'sunday_reminder', recipient: employee.name, id: sundayNotif });

      // Revision requested notification
      if (supervisors.length > 0) {
        const supervisor = supervisors[0];
        const revisionNotif = await notificationService.createNotification({
          recipientId: employee.id,
          recipientRole: 'employee',
          type: 'revision_requested',
          title: 'Revision Requested - December 2024',
          message: `${supervisor.preferredName || supervisor.name} has requested revisions to your expense report for December 2024. Please review the comments and make the necessary changes.`,
          reportId: null,
          employeeId: employee.id,
          employeeName: employee.preferredName || employee.name,
          actorId: supervisor.id,
          actorName: supervisor.preferredName || supervisor.name,
          actorRole: 'supervisor',
          sendEmail: false,
        });
        if (revisionNotif) notificationsCreated.push({ type: 'revision_requested', recipient: employee.name, id: revisionNotif });
      }
    }

    // Create notifications for supervisors
    if (supervisors.length > 0 && employeeUsers.length > 0) {
      const supervisor = supervisors[0];
      const employee = employeeUsers[0];

      // Report submitted notification
      const submittedNotif = await notificationService.createNotification({
        recipientId: supervisor.id,
        recipientRole: supervisor.role || 'supervisor',
        type: 'report_submitted',
        title: 'Expense Report Submitted - December 2024',
        message: `${employee.preferredName || employee.name} has submitted an expense report for December 2024 for your review.`,
        reportId: null,
        employeeId: employee.id,
        employeeName: employee.preferredName || employee.name,
        actorId: employee.id,
        actorName: employee.preferredName || employee.name,
        actorRole: 'employee',
        sendEmail: false,
      });
      if (submittedNotif) notificationsCreated.push({ type: 'report_submitted', recipient: supervisor.name, id: submittedNotif });

      // Finance revision request notification
      if (financeUsers.length > 0) {
        const financeUser = financeUsers[0];
        const financeRevisionNotif = await notificationService.createNotification({
          recipientId: supervisor.id,
          recipientRole: supervisor.role || 'supervisor',
          type: 'revision_requested',
          title: 'Revision Requested - December 2024',
          message: `Finance has requested revisions to the expense report for December 2024 for ${employee.preferredName || employee.name}.`,
          reportId: null,
          employeeId: employee.id,
          employeeName: employee.preferredName || employee.name,
          actorId: financeUser.id,
          actorName: financeUser.preferredName || financeUser.name,
          actorRole: 'finance',
          sendEmail: false,
        });
        if (financeRevisionNotif) notificationsCreated.push({ type: 'finance_revision_request', recipient: supervisor.name, id: financeRevisionNotif });
      }
    }

    // Create notifications for finance users
    if (financeUsers.length > 0 && supervisors.length > 0 && employeeUsers.length > 0) {
      const financeUser = financeUsers[0];
      const supervisor = supervisors[0];
      const employee = employeeUsers[0];

      // Approval needed notification
      const approvalNotif = await notificationService.createNotification({
        recipientId: financeUser.id,
        recipientRole: financeUser.role || 'finance',
        type: 'approval_needed',
        title: 'Expense Report Ready for Review - December 2024',
        message: `${employee.preferredName || employee.name}'s expense report for December 2024 has been approved by their supervisor and is ready for finance review.`,
        reportId: null,
        employeeId: employee.id,
        employeeName: employee.preferredName || employee.name,
        actorId: supervisor.id,
        actorName: supervisor.preferredName || supervisor.name,
        actorRole: 'supervisor',
        sendEmail: false,
      });
      if (approvalNotif) notificationsCreated.push({ type: 'approval_needed', recipient: financeUser.name, id: approvalNotif });
    }

    // Create notifications for admins
    if (admins.length > 0) {
      const admin = admins[0];

      // System notification
      const systemNotif = await notificationService.createNotification({
        recipientId: admin.id,
        recipientRole: admin.role || 'admin',
        type: 'system_notification',
        title: 'System Update Available',
        message: 'A new system update is available. Please review the release notes and schedule maintenance if needed.',
        sendEmail: false,
        isDismissible: true,
      });
      if (systemNotif) notificationsCreated.push({ type: 'system_notification', recipient: admin.name, id: systemNotif });
    }

    console.log('\n✅ Demo notifications created:');
    notificationsCreated.forEach(notif => {
      console.log(`   - ${notif.type} for ${notif.recipient} (ID: ${notif.id})`);
    });

    console.log(`\n✅ Created ${notificationsCreated.length} demo notifications successfully!`);
    console.log('💡 Note: Email notifications were disabled for demo purposes.');
    console.log('💡 Log in to each portal to see the notifications!');

  } catch (error) {
    console.error('❌ Error creating demo notifications:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the script
addDemoNotifications();

