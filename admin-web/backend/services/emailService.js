/**
 * Email Service
 * Handles sending email notifications via nodemailer
 */

const nodemailer = require('nodemailer');
const { debugLog, debugWarn, debugError } = require('../debug');

// Email configuration from environment variables
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587', 10);
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER || 'noreply@oxfordhouse.org';
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
      debugWarn('   Set EMAIL_USER, EMAIL_PASS, and optionally EMAIL_HOST, EMAIL_PORT, EMAIL_FROM environment variables.');
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
        // Add timeout to prevent hanging
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      // Verify connection
      transporter.verify((error, success) => {
        if (error) {
          debugError('❌ Email transporter verification failed:', error.message);
          transporter = null;
          resolve(null);
        } else {
          debugLog('✅ Email transporter configured and verified successfully');
          resolve(transporter);
        }
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
      return false;
    }

    if (!to || !subject || !text) {
      debugError('❌ Missing required email fields: to, subject, or text');
      return false;
    }

    const mailOptions = {
      from: EMAIL_FROM,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'), // Convert newlines to <br> if no HTML provided
    };

    const info = await emailTransporter.sendMail(mailOptions);
    debugLog(`✅ Email sent successfully to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    debugError('❌ Error sending email:', error.message);
    return false;
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

module.exports = {
  sendEmail,
  sendNotificationEmail,
  initTransporter,
};

