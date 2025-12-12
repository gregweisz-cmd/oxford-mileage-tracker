/**
 * Test Email Configuration
 * Tests if email service is configured correctly (without sending email)
 */

const emailService = require('../../services/emailService');

async function testEmailConfig() {
  console.log('🧪 Testing Email Configuration...');
  console.log('');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`   EMAIL_HOST/SMTP_HOST: ${process.env.EMAIL_HOST || process.env.SMTP_HOST || 'NOT SET'}`);
  console.log(`   EMAIL_PORT/SMTP_PORT: ${process.env.EMAIL_PORT || process.env.SMTP_PORT || 'NOT SET'}`);
  console.log(`   EMAIL_USER/SMTP_USER: ${process.env.EMAIL_USER || process.env.SMTP_USER ? '***SET***' : 'NOT SET'}`);
  console.log(`   EMAIL_PASS/SMTP_PASSWORD: ${process.env.EMAIL_PASS || process.env.SMTP_PASSWORD ? '***SET***' : 'NOT SET'}`);
  console.log(`   EMAIL_FROM: ${process.env.EMAIL_FROM || 'NOT SET'}`);
  console.log(`   EMAIL_FROM_NAME: ${process.env.EMAIL_FROM_NAME || 'NOT SET'}`);
  console.log(`   EMAIL_ENABLED: ${process.env.EMAIL_ENABLED !== 'false' ? 'true (default)' : 'false'}`);
  console.log('');

  // Test configuration verification
  console.log('🔍 Verifying email configuration...');
  try {
    const isConfigured = await emailService.verifyEmailConfig();
    
    if (isConfigured) {
      console.log('✅ Email configuration is valid!');
      console.log('   The email service is ready to send emails.');
      return true;
    } else {
      console.log('❌ Email configuration is invalid or incomplete.');
      console.log('   Please check your environment variables.');
      return false;
    }
  } catch (error) {
    console.error('❌ Error verifying email configuration:');
    console.error(`   ${error.message}`);
    return false;
  }
}

// Run the test
testEmailConfig()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });

