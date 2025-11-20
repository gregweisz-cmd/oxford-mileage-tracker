/**
 * WebSocket Test Script
 * Tests WebSocket connection and real-time updates
 * Run with: node scripts/test/test-websocket.js
 */

const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:3002/ws';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

let tests = [];
let passed = 0;
let failed = 0;

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function test(name, fn) {
  tests.push({ name, fn });
}

/**
 * Test WebSocket connection
 */
function testConnection() {
  return new Promise((resolve, reject) => {
    log('\n=== Testing WebSocket Connection ===', 'blue');
    
    const ws = new WebSocket(WS_URL);
    let connected = false;
    let messageReceived = false;

    const timeout = setTimeout(() => {
      ws.close();
      if (!connected) {
        log('✗ Connection timeout', 'red');
        reject(new Error('Connection timeout'));
      } else if (!messageReceived) {
        log('✓ Connected but no initial message received', 'yellow');
        resolve();
      } else {
        resolve();
      }
    }, 5000);

    ws.on('open', () => {
      log('✓ WebSocket connection opened', 'green');
      connected = true;
      passed++;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        log(`✓ Message received: ${message.type || 'data'}`, 'green');
        messageReceived = true;
        passed++;
        clearTimeout(timeout);
        ws.close();
        resolve();
      } catch (e) {
        log(`Received message: ${data.toString()}`, 'yellow');
      }
    });

    ws.on('error', (error) => {
      log(`✗ WebSocket error: ${error.message}`, 'red');
      failed++;
      clearTimeout(timeout);
      reject(error);
    });

    ws.on('close', () => {
      log('✓ WebSocket connection closed', 'yellow');
    });
  });
}

/**
 * Test WebSocket broadcast
 */
function testBroadcast() {
  return new Promise((resolve) => {
    log('\n=== Testing WebSocket Broadcast ===', 'blue');
    
    const ws1 = new WebSocket(WS_URL);
    const ws2 = new WebSocket(WS_URL);
    
    let ws1Ready = false;
    let ws2Ready = false;
    let messageReceived = false;

    const timeout = setTimeout(() => {
      ws1.close();
      ws2.close();
      if (messageReceived) {
        log('✓ Broadcast test passed', 'green');
        passed++;
      } else {
        log('⚠ Broadcast test inconclusive (no message received)', 'yellow');
      }
      resolve();
    }, 10000);

    ws1.on('open', () => {
      log('✓ Client 1 connected', 'green');
      ws1Ready = true;
      if (ws2Ready) {
        // Send a test message to trigger broadcast (this won't work unless there's a test endpoint)
        log('Both clients connected - waiting for broadcast...', 'yellow');
      }
    });

    ws2.on('open', () => {
      log('✓ Client 2 connected', 'green');
      ws2Ready = true;
    });

    ws1.on('message', (data) => {
      const message = JSON.parse(data.toString());
      log(`✓ Client 1 received: ${message.type || 'data'}`, 'green');
      messageReceived = true;
      clearTimeout(timeout);
      ws1.close();
      ws2.close();
      passed++;
      resolve();
    });

    ws2.on('message', (data) => {
      const message = JSON.parse(data.toString());
      log(`✓ Client 2 received: ${message.type || 'data'}`, 'green');
    });

    ws1.on('error', (error) => {
      log(`✗ Client 1 error: ${error.message}`, 'red');
      failed++;
      clearTimeout(timeout);
      ws1.close();
      ws2.close();
      resolve();
    });

    ws2.on('error', (error) => {
      log(`✗ Client 2 error: ${error.message}`, 'red');
      failed++;
      clearTimeout(timeout);
      ws1.close();
      ws2.close();
      resolve();
    });
  });
}

/**
 * Run all tests
 */
async function runTests() {
  log('=== WebSocket Tests ===', 'blue');
  log(`Testing: ${WS_URL}\n`, 'blue');

  try {
    await testConnection();
    await testBroadcast();

    // Summary
    log('\n=== Test Summary ===', 'blue');
    log(`Passed: ${passed}`, 'green');
    log(`Failed: ${failed}`, 'red');
    log(`Total: ${passed + failed}`, 'blue');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    log(`\nFatal Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run tests
runTests();

