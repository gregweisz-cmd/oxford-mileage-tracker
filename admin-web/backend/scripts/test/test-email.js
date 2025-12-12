/**
 * Test Email Service
 * Tests the email service via the /api/test-email endpoint
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3002';
const TEST_EMAIL = process.env.TEST_EMAIL || process.argv[2];

if (!TEST_EMAIL) {
  console.error('❌ Error: Test email address required');
  console.log('Usage: node test-email.js <email@example.com>');
  console.log('   or: TEST_EMAIL=email@example.com node test-email.js');
  process.exit(1);
}

async function testEmail() {
  console.log('🧪 Testing Email Service...');
  console.log(`📧 Sending test email to: ${TEST_EMAIL}`);
  console.log(`🌐 API URL: ${API_BASE_URL}`);
  console.log('');

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/test-email`,
      { to: TEST_EMAIL },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      }
    );

    if (response.data.success) {
      console.log('✅ SUCCESS: Test email sent successfully!');
      console.log(`   Message ID: ${response.data.messageId || 'N/A'}`);
      console.log(`   Message: ${response.data.message}`);
      console.log('');
      console.log('📬 Please check your inbox (and spam folder) for the test email.');
      return true;
    } else {
      console.error('❌ FAILED: Email service returned unsuccessful response');
      console.error(`   Error: ${response.data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    if (error.response) {
      // Server responded with error status
      console.error(`❌ FAILED: Server returned error status ${error.response.status}`);
      console.error(`   Error: ${error.response.data.error || error.response.data.message || 'Unknown error'}`);
      
      if (error.response.data.configured !== undefined) {
        console.error(`   Email configured: ${error.response.data.configured}`);
      }
      
      if (error.response.data.hint) {
        console.error(`   Hint: ${error.response.data.hint}`);
      }
    } else if (error.request) {
      // Request was made but no response received
      console.error('❌ FAILED: No response from server');
      console.error('   Make sure the backend server is running');
      console.error(`   Tried to connect to: ${API_BASE_URL}`);
    } else {
      // Error setting up request
      console.error('❌ FAILED: Error setting up request');
      console.error(`   Error: ${error.message}`);
    }
    return false;
  }
}

// Run the test
testEmail()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });

