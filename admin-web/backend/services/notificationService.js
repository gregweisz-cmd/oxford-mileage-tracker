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
/**
 * Notify the first approver (senior staff or supervisor) when an employee submits a report.
 * @param {string} reportId - Expense report ID
 * @param {string} employeeId - Submitting employee ID
 * @param {string} employeeName - Submitting employee name
 * @param {string} [firstApproverId] - If provided, notify this user; otherwise notify employee's supervisor
 */
async function notifyReportSubmitted(reportId, employeeId, employeeName, firstApproverId = null) {
  try {
    const db = dbService.getDb();
    const employee = await dbService.getEmployeeById(employeeId);
    let recipient = null;

    if (firstApproverId) {
      recipient = await dbService.getEmployeeById(firstApproverId);
    }
    if (!recipient && employee && employee.supervisorId) {
      recipient = await dbService.getEmployeeById(employee.supervisorId);
    }

    if (!recipient) {
      debugLog('⚠️ No first approver or supervisor found, skipping notification');
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
      recipientId: recipient.id,
      recipientRole: recipient.role || 'supervisor',
      type: 'report_submitted',
      title: `Expense Report Submitted${monthName ? ` - ${monthName}` : ''}`,
      message: `${employeeName || employee?.preferredName || employee?.name || 'An employee'} has submitted an expense report${monthName ? ` for ${monthName}` : ''} for your review.`,
      reportId,
      employeeId,
      employeeName: employeeName || employee?.preferredName || employee?.name || 'Employee',
      actorId: employeeId,
      actorName: employeeName || employee?.preferredName || employee?.name || 'Employee',
      actorRole: 'employee',
      sendEmail: true,
    });
  } catch (error) {
    debugError('❌ Error notifying report submission:', error);
    return null;
  }
}

/**
 * Notify supervisor when senior staff has approved and report is ready for supervisor review.
 */
async function notifySupervisorApprovalNeeded(reportId, seniorStaffId, seniorStaffName, employeeId) {
  try {
    const employee = await dbService.getEmployeeById(employeeId);
    if (!employee || !employee.supervisorId) return null;

    const supervisor = await dbService.getEmployeeById(employee.supervisorId);
    if (!supervisor) return null;

    const db = dbService.getDb();
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
      type: 'approval_needed',
      title: `Expense Report Ready for Your Review${monthName ? ` - ${monthName}` : ''}`,
      message: `${employee?.preferredName || employee?.name || 'An employee'}'s expense report${monthName ? ` for ${monthName}` : ''} has been approved by senior staff and is ready for your review.`,
      reportId,
      employeeId,
      employeeName: employee?.preferredName || employee?.name || 'Employee',
      actorId: seniorStaffId,
      actorName: seniorStaffName,
      actorRole: 'senior_staff',
      sendEmail: true,
    });
  } catch (error) {
    debugError('❌ Error notifying supervisor approval needed:', error);
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
 * Create persistent notification for 50+ hours alert to supervisor
 * This notification stays until the supervisor marks it as reviewed
 */
async function notify50PlusHours(employeeId, employeeName, weekStart, totalHours, supervisorId) {
  try {
    if (!supervisorId) {
      debugLog('⚠️ Employee has no supervisor, skipping 50+ hours notification');
      return null;
    }

    const supervisor = await dbService.getEmployeeById(supervisorId);
    if (!supervisor) {
      debugWarn('⚠️ Supervisor not found for 50+ hours notification');
      return null;
    }

    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    return await createNotification({
      recipientId: supervisorId,
      recipientRole: supervisor.role || 'supervisor',
      type: '50_plus_hours_alert',
      title: `⚠️ Employee Working 50+ Hours - ${employeeName}`,
      message: `${employeeName} has logged ${totalHours.toFixed(1)} hours for the week of ${weekStartDate.toLocaleDateString()}. Please check in with them to ensure they are not overworking.`,
      employeeId,
      employeeName,
      actorId: employeeId,
      actorName: employeeName,
      actorRole: 'employee',
      sendEmail: true,
      isDismissible: false, // Persistent - cannot be auto-dismissed
      metadata: JSON.stringify({
        weekStart: weekStartDate.toISOString(),
        weekEnd: weekEndDate.toISOString(),
        totalHours: totalHours,
        alertType: '50_plus_hours'
      }),
    });
  } catch (error) {
    debugError('❌ Error notifying 50+ hours alert:', error);
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
 * Notify employee when their report is fully approved (weekly: after supervisor; monthly: after finance).
 */
async function notifyEmployeeReportApproved(reportId, approverId, approverName, employeeId, isWeeklyCheckup = false) {
  try {
    const report = await new Promise((resolve) => {
      const db = dbService.getDb();
      db.get('SELECT id, month, year FROM expense_reports WHERE id = ?', [reportId], (err, row) => {
        if (err) resolve(null);
        else resolve(row);
      });
    });
    const monthName = report ? new Date(report.year, report.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

    const title = isWeeklyCheckup
      ? 'Weekly check-up approved'
      : `Expense report approved${monthName ? ` - ${monthName}` : ''}`;
    const message = isWeeklyCheckup
      ? 'Your weekly check-up has been approved by your supervisor. You\'re all set.'
      : `Your expense report${monthName ? ` for ${monthName}` : ''} has been fully approved.`;

    return await createNotification({
      recipientId: employeeId,
      recipientRole: 'employee',
      type: 'report_approved',
      title,
      message,
      reportId,
      employeeId,
      actorId: approverId,
      actorName: approverName,
      actorRole: 'supervisor',
      sendEmail: true,
    });
  } catch (error) {
    debugError('❌ Error notifying employee report approved:', error);
    return null;
  }
}

/**
 * Check if employee has 50+ hours in a week and notify supervisor
 * @param {string} employeeId - Employee ID
 * @param {string} date - Date string (YYYY-MM-DD) to check the week for
 * @returns {Promise<void>}
 */
async function checkAndNotify50PlusHours(employeeId, date) {
  try {
    const db = dbService.getDb();
    const employee = await dbService.getEmployeeById(employeeId);
    
    if (!employee) {
      debugWarn('⚠️ Employee not found for 50+ hours check');
      return;
    }

    // Calculate week start (Sunday) for the given date
    const checkDate = new Date(date);
    const dayOfWeek = checkDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const weekStart = new Date(checkDate);
    weekStart.setDate(checkDate.getDate() - dayOfWeek); // Go back to Sunday
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Saturday
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // Get all time tracking entries for this week
    const timeEntries = await new Promise((resolve, reject) => {
      db.all(
        'SELECT hours FROM time_tracking WHERE employeeId = ? AND date >= ? AND date <= ?',
        [employeeId, weekStartStr, weekEndStr],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // Calculate total hours for the week
    const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);

    // Check if 50+ hours and notify supervisor
    if (totalHours >= 50) {
      debugLog(`⚠️ Employee ${employee.preferredName || employee.name} has ${totalHours.toFixed(1)} hours for week of ${weekStartStr}`);
      await notify50PlusHours(
        employeeId,
        employee.preferredName || employee.name,
        weekStartStr,
        totalHours,
        employee.supervisorId
      );
    }
  } catch (error) {
    debugError('❌ Error checking 50+ hours:', error);
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
  notifySupervisorApprovalNeeded,
  notifyFinanceApprovalNeeded,
  notifyEmployeeReportApproved,
  notifySundayReminder,
  notify50PlusHours,
  checkAndNotify50PlusHours,
};

