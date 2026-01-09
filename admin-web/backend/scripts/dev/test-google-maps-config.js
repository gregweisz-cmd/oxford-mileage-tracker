/**
 * Test script to verify Google Maps API key is configured correctly
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const googleMapsService = require('../../services/googleMapsService');
const { debugLog, debugError } = require('../../debug');

async function testGoogleMapsConfig() {
  console.log('\n🔍 Testing Google Maps API Configuration...\n');
  
  // Check if API key is configured
  const isConfigured = googleMapsService.isConfigured();
  console.log(`✅ API Key Configured: ${isConfigured ? 'YES' : 'NO'}`);
  
  if (!isConfigured) {
    console.error('\n❌ ERROR: GOOGLE_MAPS_API_KEY is not set in environment variables');
    console.log('   Make sure you have GOOGLE_MAPS_API_KEY in your .env file');
    process.exit(1);
  }
  
  // Test with a simple address lookup
  console.log('\n🧪 Testing with sample addresses...');
  const testAddresses = [
    '230 Wagner St, Troutman, NC 28166',
    '209 S Trenton St, Gastonia, NC'
  ];
  
  try {
    console.log(`   Testing with ${testAddresses.length} addresses...`);
    const mapImage = await googleMapsService.downloadStaticMapImage(testAddresses, { size: '600x400' });
    console.log(`   ✅ Successfully downloaded map image: ${mapImage.length} bytes`);
    console.log('\n✅ Google Maps API is working correctly!');
    console.log('   You can now test the map feature in expense reports.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR: Failed to download map image');
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      const responseData = error.response.data;
      if (Buffer.isBuffer(responseData)) {
        const errorMessage = responseData.toString('utf-8');
        console.error(`   Google Error Message: ${errorMessage}`);
      } else {
        console.error(`   Response: ${JSON.stringify(responseData)}`);
      }
    }
    console.log('\n⚠️  This could mean:');
    console.log('   1. The API key is invalid');
    console.log('   2. Maps Static API is not enabled for this key');
    console.log('   3. The API key has restrictions that prevent this request');
    console.log('   4. Billing is not enabled on the Google Cloud project\n');
    process.exit(1);
  }
}

testGoogleMapsConfig();

