/**
 * Email Service
 * Handles sending email notifications via nodemailer
 */

const nodemailer = require('nodemailer');
const { debugLog, debugWarn, debugError } = require('../debug');

// Email configuration from environment variables
// Support both EMAIL_* and SMTP_* naming conventions
const EMAIL_HOST = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587', 10);
const EMAIL_USER = process.env.EMAIL_USER || process.env.SMTP_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || process.env.SMTP_PASSWORD || process.env.SMTP_APP_PASSWORD || '';
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER || 'noreply@oxfordhouse.org';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Oxford House Expense Tracker';
const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== 'false'; // Default to true unless explicitly disabled

// Create reusable transporter (will be initialized lazily)
let transporter = null;

/**
 * Initialize email transporter
 * @returns {Promise<nodemailer.Transporter|null>} Transporter instance or null if email is disabled/misconfigured
 */
function initTransporter() {
  return new Promise((resolve) => {
    if (!EMAIL_ENABLED) {
      debugWarn('⚠️ Email notifications are disabled (EMAIL_ENABLED=false)');
      resolve(null);
      return;
    }

    if (!EMAIL_USER || !EMAIL_PASS) {
      debugWarn('⚠️ Email credentials not configured. Email notifications will be skipped.');
      debugWarn('   Set EMAIL_USER (or SMTP_USER) and EMAIL_PASS (or SMTP_PASSWORD) environment variables.');
      debugWarn('   Optionally set EMAIL_HOST, EMAIL_PORT, EMAIL_FROM, EMAIL_FROM_NAME');
      resolve(null);
      return;
    }

    if (transporter) {
      resolve(transporter);
      return;
    }

    try {
      transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        secure: EMAIL_PORT === 465, // true for 465, false for other ports
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS,
        },
        // Increased timeouts for cloud platforms like Render
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 30000,
        socketTimeout: 30000,
        // TLS options for better compatibility
        tls: {
          // Don't reject unauthorized certificates (some SMTP servers use self-signed)
          rejectUnauthorized: false,
          // Allow older TLS versions if needed
          minVersion: 'TLSv1.2',
        },
        // Pool connections for better performance
        pool: true,
        maxConnections: 1,
        maxMessages: 3,
      });

      // Verify connection (but don't block if it fails - will retry on actual send)
      // Use a timeout to prevent hanging, and resolve immediately with transporter
      // Some cloud platforms have network restrictions that block verify() but allow sendMail()
      const verifyTimeout = setTimeout(() => {
        debugWarn('⚠️ Email transporter verification timed out (will try send anyway)');
        resolve(transporter);
      }, 5000); // 5 second timeout for verify
      
      transporter.verify((error, success) => {
        clearTimeout(verifyTimeout);
        if (error) {
          debugWarn('⚠️ Email transporter verification failed (will retry on send):', error.message);
          // Don't set transporter to null - allow retry on actual send
        } else {
          debugLog('✅ Email transporter configured and verified successfully');
        }
        resolve(transporter);
      });
    } catch (error) {
      debugError('❌ Error creating email transporter:', error);
      transporter = null;
      resolve(null);
    }
  });
}

/**
 * Send an email notification
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text email body
 * @param {string} [options.html] - HTML email body (optional)
 * @returns {Promise<boolean>} True if email was sent successfully, false otherwise
 */
async function sendEmail({ to, subject, text, html }) {
  try {
    const emailTransporter = await initTransporter();
    
    if (!emailTransporter) {
      debugWarn('⚠️ Email transporter not available. Skipping email send.');
      return { success: false, error: 'Email transporter not available' };
    }

    if (!to || !subject || !text) {
      debugError('❌ Missing required email fields: to, subject, or text');
      return { success: false, error: 'Missing required email fields: to, subject, or text' };
    }

    const mailOptions = {
      from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'), // Convert newlines to <br> if no HTML provided
    };

    const info = await emailTransporter.sendMail(mailOptions);
    debugLog(`✅ Email sent successfully to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    debugError('❌ Error sending email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification email for expense report workflow events
 * @param {Object} options - Notification options
 * @param {Object} options.recipient - Employee object with email
 * @param {string} options.type - Notification type (e.g., 'report_submitted', 'revision_requested')
 * @param {string} options.title - Email subject line
 * @param {string} options.message - Email body message
 * @param {Object} [options.report] - Expense report object (optional)
 * @param {Object} [options.actor] - Actor employee object (optional)
 * @returns {Promise<boolean>} True if email was sent successfully
 */
async function sendNotificationEmail({ recipient, type, title, message, report, actor }) {
  if (!recipient || !recipient.email) {
    debugWarn('⚠️ No recipient email provided for notification');
    return false;
  }

  const reportInfo = report ? ` for ${new Date(report.year, report.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : '';
  const actorInfo = actor ? ` from ${actor.preferredName || actor.name || 'Team'}` : '';

  const emailSubject = title || `Oxford House Expense Tracker${reportInfo}${actorInfo}`;
  
  let emailBody = message;
  if (report) {
    emailBody += `\n\nReport Period: ${new Date(report.year, report.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  }
  
  emailBody += '\n\nPlease log in to the Oxford House Expense Tracker portal to review and take action.';
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1976d2;">${emailSubject}</h2>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>
      </div>
      ${report ? `<p><strong>Report Period:</strong> ${new Date(report.year, report.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>` : ''}
      <p style="margin-top: 20px;">
        <a href="${process.env.REACT_APP_API_URL || 'https://oxford-mileage-backend.onrender.com'}/admin" 
           style="background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Log In to Portal
        </a>
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This is an automated notification from the Oxford House Expense Tracker system.
      </p>
    </div>
  `;

  return await sendEmail({
    to: recipient.email,
    subject: emailSubject,
    text: emailBody,
    html: htmlBody,
  });
}

/**
 * Verify email configuration
 * @returns {Promise<boolean>} True if email is configured and working
 */
async function verifyEmailConfig() {
  if (!EMAIL_ENABLED) {
    return false;
  }

  if (!EMAIL_USER || !EMAIL_PASS) {
    return false;
  }

  try {
    const emailTransporter = await initTransporter();
    return emailTransporter !== null;
  } catch (error) {
    debugError('❌ Email config verification failed:', error);
    return false;
  }
}

/**
 * Send email notification when report is submitted for approval
 */
async function sendReportSubmittedNotification({
  supervisorEmail,
  supervisorName,
  employeeName,
  employeeEmail,
  reportId,
  reportPeriod,
}) {
  const subject = `New Expense Report Pending Approval - ${employeeName}`;
  
  const text = `Hello ${supervisorName},\n\n${employeeName} has submitted an expense report for your approval.\n\nReport Period: ${reportPeriod}\nReport ID: ${reportId}\n\nPlease review and approve or request revisions as needed.`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Expense Report Pending Approval</h1>
        </div>
        <div class="content">
          <p>Hello ${supervisorName},</p>
          <p><strong>${employeeName}</strong> has submitted an expense report for your approval.</p>
          <p><strong>Report Period:</strong> ${reportPeriod}</p>
          <p><strong>Report ID:</strong> ${reportId}</p>
          <p>Please review and approve or request revisions as needed.</p>
          <p style="text-align: center;">
            <a href="${process.env.ADMIN_PORTAL_URL || process.env.REACT_APP_API_URL?.replace('/api', '') || 'https://oxford-mileage-backend.onrender.com'}/reports/pending" class="button">Review Report</a>
          </p>
        </div>
        <div class="footer">
          <p>This is an automated notification from Oxford House Expense Tracker.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: supervisorEmail,
    subject: subject,
    text: text,
    html: html,
  });
}

/**
 * Send email notification when report is approved
 */
async function sendReportApprovedNotification({
  employeeEmail,
  employeeName,
  supervisorName,
  reportId,
  reportPeriod,
  comments,
}) {
  const subject = `Expense Report Approved - ${reportPeriod}`;
  
  const text = `Hello ${employeeName},\n\nYour expense report has been approved by ${supervisorName}.\n\nReport Period: ${reportPeriod}\nReport ID: ${reportId}${comments ? `\n\nComments: ${comments}` : ''}\n\nYour report will now be processed by Finance.`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .approved-badge { background-color: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; display: inline-block; margin: 10px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Report Approved ✓</h1>
        </div>
        <div class="content">
          <p>Hello ${employeeName},</p>
          <p>Your expense report has been <strong>approved</strong> by ${supervisorName}.</p>
          <div class="approved-badge">✓ APPROVED</div>
          <p><strong>Report Period:</strong> ${reportPeriod}</p>
          <p><strong>Report ID:</strong> ${reportId}</p>
          ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
          <p>Your report will now be processed by Finance.</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from Oxford House Expense Tracker.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: employeeEmail,
    subject: subject,
    text: text,
    html: html,
  });
}

/**
 * Send email notification when report is rejected
 */
async function sendReportRejectedNotification({
  employeeEmail,
  employeeName,
  supervisorName,
  reportId,
  reportPeriod,
  comments,
}) {
  const subject = `Expense Report Requires Attention - ${reportPeriod}`;
  
  const text = `Hello ${employeeName},\n\nYour expense report has been rejected by ${supervisorName}.\n\nReport Period: ${reportPeriod}\nReport ID: ${reportId}\n\nComments: ${comments || 'No comments provided'}\n\nPlease review the comments and resubmit your report with the necessary corrections.`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .comments-box { background-color: #fff; border-left: 4px solid #f44336; padding: 15px; margin: 15px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Report Rejected</h1>
        </div>
        <div class="content">
          <p>Hello ${employeeName},</p>
          <p>Your expense report has been <strong>rejected</strong> by ${supervisorName}.</p>
          <p><strong>Report Period:</strong> ${reportPeriod}</p>
          <p><strong>Report ID:</strong> ${reportId}</p>
          ${comments ? `
            <div class="comments-box">
              <p><strong>Comments from ${supervisorName}:</strong></p>
              <p>${comments}</p>
            </div>
          ` : ''}
          <p>Please review the comments above and resubmit your report with the necessary corrections.</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from Oxford House Expense Tracker.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: employeeEmail,
    subject: subject,
    text: text,
    html: html,
  });
}

/**
 * Send email notification when revision is requested
 */
async function sendRevisionRequestedNotification({
  employeeEmail,
  employeeName,
  supervisorName,
  reportId,
  reportPeriod,
  comments,
}) {
  const subject = `Expense Report Revision Requested - ${reportPeriod}`;
  
  const text = `Hello ${employeeName},\n\n${supervisorName} has requested revisions to your expense report.\n\nReport Period: ${reportPeriod}\nReport ID: ${reportId}\n\nRevision Request: ${comments || 'No comments provided'}\n\nPlease make the requested changes and resubmit your report.`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .comments-box { background-color: #fff; border-left: 4px solid #FF9800; padding: 15px; margin: 15px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Revision Requested</h1>
        </div>
        <div class="content">
          <p>Hello ${employeeName},</p>
          <p>${supervisorName} has requested revisions to your expense report.</p>
          <p><strong>Report Period:</strong> ${reportPeriod}</p>
          <p><strong>Report ID:</strong> ${reportId}</p>
          ${comments ? `
            <div class="comments-box">
              <p><strong>Revision Request from ${supervisorName}:</strong></p>
              <p>${comments}</p>
            </div>
          ` : ''}
          <p>Please make the requested changes and resubmit your report.</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from Oxford House Expense Tracker.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: employeeEmail,
    subject: subject,
    text: text,
    html: html,
  });
}

module.exports = {
  sendEmail,
  sendNotificationEmail,
  sendReportSubmittedNotification,
  sendReportApprovedNotification,
  sendReportRejectedNotification,
  sendRevisionRequestedNotification,
  verifyEmailConfig,
  initTransporter,
};

