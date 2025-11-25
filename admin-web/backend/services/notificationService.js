/**
 * Notification Service
 * Handles creating and managing notifications
 */

const dbService = require('./dbService');
const emailService = require('./emailService');
const { debugLog, debugWarn, debugError } = require('../debug');

/**
 * Create a notification and optionally send email
 * @param {Object} options - Notification options
 * @param {string} options.recipientId - Employee ID of the notification recipient
 * @param {string} options.recipientRole - Role of recipient ('employee', 'supervisor', 'finance', 'admin')
 * @param {string} options.type - Notification type (e.g., 'report_submitted', 'revision_requested', 'sunday_reminder')
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {string} [options.reportId] - Related expense report ID (optional)
 * @param {string} [options.employeeId] - Related employee ID (optional)
 * @param {string} [options.employeeName] - Related employee name (optional)
 * @param {string} [options.actorId] - ID of the person who triggered the notification (optional)
 * @param {string} [options.actorName] - Name of the person who triggered the notification (optional)
 * @param {string} [options.actorRole] - Role of the actor (optional)
 * @param {boolean} [options.sendEmail=true] - Whether to send email notification (default: true)
 * @param {boolean} [options.isDismissible=true] - Whether notification can be dismissed (default: true)
 * @param {Object} [options.metadata] - Additional metadata (optional)
 * @returns {Promise<string|null>} Notification ID if created successfully, null otherwise
 */
async function createNotification({
  recipientId,
  recipientRole,
  type,
  title,
  message,
  reportId = null,
  employeeId = null,
  employeeName = null,
  actorId = null,
  actorName = null,
  actorRole = null,
  sendEmail: shouldSendEmail = true,
  isDismissible = true,
  metadata = null,
}) {
  if (!recipientId || !recipientRole || !type || !title || !message) {
    debugError('❌ Missing required fields for notification creation');
    return null;
  }

  const db = dbService.getDb();
  const notificationId = `notif-${Date.now().toString(36)}-${Math.random().toString(36).substr(2)}`;
  const now = new Date().toISOString();

  try {
    // Get recipient employee for email
    const recipient = await dbService.getEmployeeById(recipientId);
    
    // Get related employee if provided
    let relatedEmployee = null;
    if (employeeId) {
      relatedEmployee = await dbService.getEmployeeById(employeeId);
    }

    // Get actor employee if provided
    let actor = null;
    if (actorId) {
      actor = await dbService.getEmployeeById(actorId);
    }

    // Create notification in database
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO notifications (
          id, recipientId, recipientRole, type, title, message,
          reportId, employeeId, employeeName, actorId, actorName, actorRole,
          isRead, isDismissible, createdAt, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [
          notificationId,
          recipientId,
          recipientRole,
          type,
          title,
          message,
          reportId,
          employeeId,
          employeeName || (relatedEmployee ? (relatedEmployee.preferredName || relatedEmployee.name) : null),
          actorId,
          actorName || (actor ? (actor.preferredName || actor.name) : null),
          actorRole,
          isDismissible ? 1 : 0,
          now,
          metadata ? JSON.stringify(metadata) : null,
        ],
        function(err) {
          if (err) {
            debugError('❌ Error creating notification:', err);
            reject(err);
          } else {
            debugLog(`✅ Created notification ${notificationId} for ${recipientId}`);
            resolve();
          }
        }
      );
    });

    // Send email notification if requested and recipient has email
    if (shouldSendEmail && recipient && recipient.email) {
      // Get report if provided
      let report = null;
      if (reportId) {
        report = await new Promise((resolve) => {
          db.get('SELECT id, employeeId, month, year FROM expense_reports WHERE id = ?', [reportId], (err, row) => {
            if (err) {
              debugWarn('⚠️ Error fetching report for email notification:', err);
              resolve(null);
            } else {
              resolve(row);
            }
          });
        });
      }

      await emailService.sendNotificationEmail({
        recipient,
        type,
        title,
        message,
        report,
        actor: actor || (actorId && actorName ? { id: actorId, name: actorName } : null),
      });
    }

    return notificationId;
  } catch (error) {
    debugError('❌ Error in createNotification:', error);
    return null;
  }
}

/**
 * Create notification for expense report submission
 * Notifies supervisor when employee submits report
 */
async function notifyReportSubmitted(reportId, employeeId, employeeName) {
  try {
    const db = dbService.getDb();
    const employee = await dbService.getEmployeeById(employeeId);
    
    if (!employee || !employee.supervisorId) {
      debugLog('⚠️ Employee has no supervisor, skipping notification');
      return null;
    }

    const supervisor = await dbService.getEmployeeById(employee.supervisorId);
    if (!supervisor) {
      debugWarn('⚠️ Supervisor not found for notification');
      return null;
    }

    const report = await new Promise((resolve) => {
      db.get('SELECT id, month, year FROM expense_reports WHERE id = ?', [reportId], (err, row) => {
        if (err) resolve(null);
        else resolve(row);
      });
    });

    const monthName = report ? new Date(report.year, report.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

    return await createNotification({
      recipientId: supervisor.id,
      recipientRole: supervisor.role || 'supervisor',
      type: 'report_submitted',
      title: `Expense Report Submitted${monthName ? ` - ${monthName}` : ''}`,
      message: `${employeeName || employee.preferredName || employee.name} has submitted an expense report${monthName ? ` for ${monthName}` : ''} for your review.`,
      reportId,
      employeeId,
      employeeName: employeeName || employee.preferredName || employee.name,
      actorId: employeeId,
      actorName: employeeName || employee.preferredName || employee.name,
      actorRole: 'employee',
      sendEmail: true,
    });
  } catch (error) {
    debugError('❌ Error notifying report submission:', error);
    return null;
  }
}

/**
 * Create notification when Finance requests revision from Supervisor
 */
async function notifyFinanceRevisionRequest(reportId, financeId, financeName, employeeId) {
  try {
    const db = dbService.getDb();
    const employee = await dbService.getEmployeeById(employeeId);
    
    if (!employee || !employee.supervisorId) {
      debugLog('⚠️ Employee has no supervisor, skipping notification');
      return null;
    }

    const supervisor = await dbService.getEmployeeById(employee.supervisorId);
    if (!supervisor) {
      debugWarn('⚠️ Supervisor not found for notification');
      return null;
    }

    const report = await new Promise((resolve) => {
      db.get('SELECT id, month, year FROM expense_reports WHERE id = ?', [reportId], (err, row) => {
        if (err) resolve(null);
        else resolve(row);
      });
    });

    const monthName = report ? new Date(report.year, report.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

    return await createNotification({
      recipientId: supervisor.id,
      recipientRole: supervisor.role || 'supervisor',
      type: 'revision_requested',
      title: `Revision Requested${monthName ? ` - ${monthName}` : ''}`,
      message: `Finance has requested revisions to the expense report${monthName ? ` for ${monthName}` : ''} for ${employee.preferredName || employee.name}.`,
      reportId,
      employeeId,
      employeeName: employee.preferredName || employee.name,
      actorId: financeId,
      actorName: financeName,
      actorRole: 'finance',
      sendEmail: true,
    });
  } catch (error) {
    debugError('❌ Error notifying finance revision request:', error);
    return null;
  }
}

/**
 * Create notification when Supervisor requests revision from Employee
 */
async function notifySupervisorRevisionRequest(reportId, supervisorId, supervisorName, employeeId) {
  try {
    const db = dbService.getDb();
    const employee = await dbService.getEmployeeById(employeeId);
    const supervisor = await dbService.getEmployeeById(supervisorId);
    
    if (!employee) {
      debugWarn('⚠️ Employee not found for notification');
      return null;
    }

    const report = await new Promise((resolve) => {
      db.get('SELECT id, month, year FROM expense_reports WHERE id = ?', [reportId], (err, row) => {
        if (err) resolve(null);
        else resolve(row);
      });
    });

    const monthName = report ? new Date(report.year, report.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

    return await createNotification({
      recipientId: employeeId,
      recipientRole: employee.role || 'employee',
      type: 'revision_requested',
      title: `Revision Requested${monthName ? ` - ${monthName}` : ''}`,
      message: `${supervisorName || supervisor?.preferredName || supervisor?.name || 'Your supervisor'} has requested revisions to your expense report${monthName ? ` for ${monthName}` : ''}.`,
      reportId,
      employeeId,
      employeeName: employee.preferredName || employee.name,
      actorId: supervisorId,
      actorName: supervisorName || supervisor?.preferredName || supervisor?.name,
      actorRole: 'supervisor',
      sendEmail: true,
    });
  } catch (error) {
    debugError('❌ Error notifying supervisor revision request:', error);
    return null;
  }
}

/**
 * Create notification when Supervisor approves and sends to Finance
 */
async function notifyFinanceApprovalNeeded(reportId, supervisorId, supervisorName, employeeId) {
  try {
    const db = dbService.getDb();
    const employee = await dbService.getEmployeeById(employeeId);
    
    // Get all finance approvers
    const financeApprovers = await dbService.getFinanceApprovers();
    
    if (financeApprovers.length === 0) {
      debugWarn('⚠️ No finance approvers found for notification');
      return null;
    }

    const report = await new Promise((resolve) => {
      db.get('SELECT id, month, year FROM expense_reports WHERE id = ?', [reportId], (err, row) => {
        if (err) resolve(null);
        else resolve(row);
      });
    });

    const monthName = report ? new Date(report.year, report.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

    // Notify all finance approvers
    const notificationIds = [];
    for (const financeApprover of financeApprovers) {
      const notificationId = await createNotification({
        recipientId: financeApprover.id,
        recipientRole: financeApprover.role || 'finance',
        type: 'approval_needed',
        title: `Expense Report Ready for Review${monthName ? ` - ${monthName}` : ''}`,
        message: `${employee?.preferredName || employee?.name || 'An employee'}'s expense report${monthName ? ` for ${monthName}` : ''} has been approved by their supervisor and is ready for finance review.`,
        reportId,
        employeeId,
        employeeName: employee?.preferredName || employee?.name,
        actorId: supervisorId,
        actorName: supervisorName,
        actorRole: 'supervisor',
        sendEmail: true,
      });
      if (notificationId) {
        notificationIds.push(notificationId);
      }
    }

    return notificationIds;
  } catch (error) {
    debugError('❌ Error notifying finance approval needed:', error);
    return null;
  }
}

/**
 * Create Sunday reminder notification for employees
 */
async function notifySundayReminder(employeeId) {
  try {
    const db = dbService.getDb();
    const employee = await dbService.getEmployeeById(employeeId);
    
    if (!employee) {
      debugWarn('⚠️ Employee not found for Sunday reminder');
      return null;
    }

    // Check if employee has Sunday reminders enabled
    if (employee.sundayReminderEnabled === 0) {
      debugLog(`⚠️ Sunday reminders disabled for employee ${employeeId}`);
      return null;
    }

    return await createNotification({
      recipientId: employeeId,
      recipientRole: employee.role || 'employee',
      type: 'sunday_reminder',
      title: 'Reminder: Submit Your Expense Report',
      message: 'This is a friendly reminder to submit your expense report for the week. Please log in to complete your expenses.',
      reportId: null,
      employeeId: null,
      employeeName: null,
      actorId: null,
      actorName: 'System',
      actorRole: 'system',
      sendEmail: true,
      isDismissible: true,
      metadata: { reminderType: 'sunday_weekly' },
    });
  } catch (error) {
    debugError('❌ Error creating Sunday reminder:', error);
    return null;
  }
}

module.exports = {
  createNotification,
  notifyReportSubmitted,
  notifyFinanceRevisionRequest,
  notifySupervisorRevisionRequest,
  notifyFinanceApprovalNeeded,
  notifySundayReminder,
};

