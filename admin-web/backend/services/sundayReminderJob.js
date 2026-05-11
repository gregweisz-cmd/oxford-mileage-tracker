/**
 * Sunday Reminder Job
 * Scheduled job that sends Sunday expense reminders to employees
 */

const dbService = require('./dbService');
const notificationService = require('./notificationService');
const { debugLog, debugWarn, debugError } = require('../debug');

let reminderInterval = null;
let isRunning = false;
let lastReminderDate = null; // Track the last Sunday we sent reminders for
const SUNDAY_REMINDER_EVENT_KEY = 'sunday_reminder';

/**
 * Check if today is Sunday
 * @returns {boolean} True if today is Sunday (day 0)
 */
function isSunday() {
  const now = new Date();
  return now.getDay() === 0; // 0 = Sunday
}

/**
 * Get all employees who should receive Sunday reminders
 * @returns {Promise<Array>} Array of employee objects
 */
async function getEmployeesForSundayReminders() {
  return new Promise((resolve, reject) => {
    const db = dbService.getDb();
    
    // Get all employees with Sunday reminders enabled
    // Also check for null (default to enabled)
    db.all(
      `SELECT id, name, preferredName, email, role, sundayReminderEnabled 
       FROM employees 
       WHERE (archived IS NULL OR archived = 0) 
       AND (sundayReminderEnabled IS NULL OR sundayReminderEnabled = 1)`,
      [],
      (err, rows) => {
        if (err) {
          debugError('❌ Error fetching employees for Sunday reminders:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      }
    );
  });
}

/**
 * Get the date string for today (YYYY-MM-DD format)
 * Used to track which Sunday we've already sent reminders for
 * @returns {string} Date string in YYYY-MM-DD format
 */
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function claimReminderSend(employeeId, dedupeKey) {
  return new Promise((resolve, reject) => {
    const db = dbService.getDb();
    const now = new Date().toISOString();
    db.run(
      `INSERT OR IGNORE INTO notification_send_log
        (eventKey, recipientId, dedupeKey, status, claimedAt, updatedAt)
       VALUES (?, ?, ?, 'claimed', ?, ?)`,
      [SUNDAY_REMINDER_EVENT_KEY, employeeId, dedupeKey, now, now],
      function(err) {
        if (err) return reject(err);
        resolve(this.changes === 1);
      }
    );
  });
}

function markReminderSent(employeeId, dedupeKey, notificationId) {
  return new Promise((resolve, reject) => {
    const db = dbService.getDb();
    const now = new Date().toISOString();
    db.run(
      `UPDATE notification_send_log
       SET status = 'sent', notificationId = ?, sentAt = ?, updatedAt = ?
       WHERE eventKey = ? AND recipientId = ? AND dedupeKey = ?`,
      [notificationId || null, now, now, SUNDAY_REMINDER_EVENT_KEY, employeeId, dedupeKey],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function releaseReminderClaim(employeeId, dedupeKey, error) {
  return new Promise((resolve, reject) => {
    const db = dbService.getDb();
    db.run(
      `DELETE FROM notification_send_log
       WHERE eventKey = ? AND recipientId = ? AND dedupeKey = ? AND status = 'claimed'`,
      [SUNDAY_REMINDER_EVENT_KEY, employeeId, dedupeKey],
      (err) => {
        if (err) return reject(err);
        if (error) {
          debugWarn(`⚠️ Released Sunday reminder claim for retry: ${employeeId} (${String(error.message || error).slice(0, 160)})`);
        }
        resolve();
      }
    );
  });
}

/**
 * Send Sunday reminders to all eligible employees
 * Only sends once per Sunday
 * @returns {Promise<{sent: number, failed: number}>} Statistics about sent reminders
 */
async function sendSundayReminders() {
  if (!isSunday()) {
    debugLog('📅 Today is not Sunday, skipping reminder job');
    return { sent: 0, failed: 0 };
  }

  // Check if we've already sent reminders for this Sunday
  const todayDateString = getTodayDateString();
  if (lastReminderDate === todayDateString) {
    debugLog('📅 Already sent Sunday reminders for today, skipping');
    return { sent: 0, failed: 0 };
  }

  debugLog('🔔 Starting Sunday reminder job...');

  try {
    const employees = await getEmployeesForSundayReminders();
    debugLog(`📧 Found ${employees.length} employees eligible for Sunday reminders`);

    let sent = 0;
    let failed = 0;

    for (const employee of employees) {
      try {
        const claimed = await claimReminderSend(employee.id, todayDateString);
        if (!claimed) {
          debugLog(`📅 Sunday reminder already sent or claimed for ${employee.id} on ${todayDateString}, skipping`);
          continue;
        }

        const notificationId = await notificationService.notifySundayReminder(employee.id);
        if (notificationId) {
          await markReminderSent(employee.id, todayDateString, notificationId);
          sent++;
          debugLog(`✅ Sent Sunday reminder to ${employee.preferredName || employee.name} (${employee.email})`);
        } else {
          await releaseReminderClaim(employee.id, todayDateString, new Error('Notification service returned no notification id'));
          failed++;
          debugWarn(`⚠️ Failed to send Sunday reminder to ${employee.preferredName || employee.name}`);
        }
      } catch (error) {
        await releaseReminderClaim(employee.id, todayDateString, error).catch(releaseErr => {
          debugError(`❌ Failed to release Sunday reminder claim for ${employee.id}:`, releaseErr);
        });
        failed++;
        debugError(`❌ Error sending Sunday reminder to ${employee.preferredName || employee.name}:`, error);
      }
    }

    // Mark that we've sent reminders for this Sunday
    lastReminderDate = todayDateString;
    
    debugLog(`✅ Sunday reminder job completed. Sent: ${sent}, Failed: ${failed}`);
    return { sent, failed };
  } catch (error) {
    debugError('❌ Error in Sunday reminder job:', error);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Start the Sunday reminder job
 * Runs every hour to check if it's Sunday and send reminders
 */
function startSundayReminderJob() {
  if (isRunning) {
    debugWarn('⚠️ Sunday reminder job is already running');
    return;
  }

  debugLog('🚀 Starting Sunday reminder job scheduler...');
  isRunning = true;

  // Run immediately if it's Sunday
  if (isSunday()) {
    sendSundayReminders().catch(err => {
      debugError('❌ Error in initial Sunday reminder run:', err);
    });
  }

  // Check every hour (3600000 ms) if it's Sunday and send reminders
  // We check hourly to ensure we catch Sunday at the right time
  // Note: Reminders are only sent once per Sunday (tracked by date)
  reminderInterval = setInterval(() => {
    if (isSunday()) {
      sendSundayReminders().catch(err => {
        debugError('❌ Error in scheduled Sunday reminder run:', err);
      });
    } else {
      // Reset the last reminder date when it's no longer Sunday
      // This ensures we send reminders again next Sunday
      if (lastReminderDate !== null) {
        lastReminderDate = null;
        debugLog('📅 Reset reminder date tracker (no longer Sunday)');
      }
    }
  }, 60 * 60 * 1000); // 1 hour

  debugLog('✅ Sunday reminder job scheduler started (checks every hour, sends once per Sunday)');
}

/**
 * Stop the Sunday reminder job
 */
function stopSundayReminderJob() {
  if (!isRunning) {
    return;
  }

  debugLog('🛑 Stopping Sunday reminder job scheduler...');
  isRunning = false;

  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }

  debugLog('✅ Sunday reminder job scheduler stopped');
}

/**
 * Manually trigger Sunday reminders (for testing or manual execution)
 * @returns {Promise<{sent: number, failed: number}>} Statistics
 */
async function triggerSundayReminders() {
  debugLog('🔔 Manually triggering Sunday reminders...');
  return await sendSundayReminders();
}

module.exports = {
  startSundayReminderJob,
  stopSundayReminderJob,
  triggerSundayReminders,
  sendSundayReminders,
  isSunday,
};

