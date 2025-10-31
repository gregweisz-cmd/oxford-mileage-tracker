const https = require('https');

const url = 'https://oxford-mileage-backend.onrender.com/api/auth/verify';

console.log('Testing CORS from oxford-mileage-tracker.vercel.app...');

const options = {
  hostname: 'oxford-mileage-backend.onrender.com',
  path: '/api/auth/verify',
  method: 'GET',
  headers: {
    'Origin': 'https://oxford-mileage-tracker.vercel.app',
    'User-Agent': 'Node-CORS-Test'
  }
};

const req = https.request(options, (res) => {
  console.log(`\nStatus: ${res.statusCode}`);
  console.log('CORS Headers:');
  console.log('  Access-Control-Allow-Origin:', res.headers['access-control-allow-origin'] || 'NOT SET');
  console.log('  Access-Control-Allow-Methods:', res.headers['access-control-allow-methods'] || 'NOT SET');
  console.log('  Access-Control-Allow-Headers:', res.headers['access-control-allow-headers'] || 'NOT SET');
  console.log('  Access-Control-Allow-Credentials:', res.headers['access-control-allow-credentials'] || 'NOT SET');
  
  res.on('data', () => {});
  res.on('end', () => {
    console.log('\n✅ Request completed');
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`\n❌ Error: ${e.message}`);
  process.exit(1);
});

req.setTimeout(5000, () => {
  console.error('\n❌ Request timeout');
  req.destroy();
  process.exit(1);
});

req.end();

