#!/usr/bin/env node
/**
 * Set Admin Roles on Render Production
 * 
 * Updates specific employees to Admin role/position on Render production backend
 * 
 * Usage:
 *   node scripts/maintenance/set-admin-roles-render.js [--dry-run]
 * 
 * Requires:
 *   - ADMIN_TOKEN environment variable set in Render (or pass via --token flag)
 *   - Production API URL: https://oxford-mileage-backend.onrender.com
 */

const https = require('https');

// Production API URL
const PRODUCTION_API_URL = 'https://oxford-mileage-backend.onrender.com';

// Employees to set as admin
const employeesToSetAdmin = [
  'Crystal Wood',
  'Kosal Dao',
  'Alexandra Mulvey',
  'Andrea Kissack',
  'Kelyne Moore',
  'Leann Tyler'
];

// Get command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tokenIndex = args.indexOf('--token');
const adminToken = tokenIndex !== -1 && args[tokenIndex + 1] 
  ? args[tokenIndex + 1] 
  : process.env.ADMIN_TOKEN || 'CHANGE_THIS_IN_PRODUCTION';

function log(message, type = 'info') {
  const prefix = {
    info: '📝',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    step: '🚀'
  }[type] || '📝';
  console.log(`${prefix} ${message}`);
}

/**
 * Make HTTPS request to Render API
 */
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, PRODUCTION_API_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken
      }
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: parsed });
          } else {
            reject({ statusCode: res.statusCode, error: parsed.error || parsed.message || responseData });
          }
        } catch (e) {
          reject({ statusCode: res.statusCode, error: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject({ error: error.message });
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Get employee by email or name
 */
async function getEmployee(identifier) {
  try {
    // Try by email first
    const response = await makeRequest('GET', `/api/employees?search=${encodeURIComponent(identifier)}`);
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      // Find exact match
      const employee = response.data.find(emp => 
        emp.name === identifier || emp.email === identifier
      );
      return employee || response.data[0];
    }
    return null;
  } catch (error) {
    log(`Error fetching employee ${identifier}: ${error.error || error.message}`, 'error');
    return null;
  }
}

/**
 * Update employee position to Admin
 */
async function updateEmployeeToAdmin(employee) {
  try {
    const response = await makeRequest('PUT', `/api/employees/${employee.id}`, {
      position: 'Admin'
    });
    return { success: true, employee };
  } catch (error) {
    return { success: false, employee, error: error.error || error.message };
  }
}

/**
 * Main function to update all employees
 */
async function setAdminRolesOnRender() {
  log('🚀 Setting Admin Roles on Render Production', 'step');
  log(`Production API: ${PRODUCTION_API_URL}`, 'info');
  if (dryRun) {
    log('DRY RUN MODE - No changes will be made', 'warning');
  }
  if (!adminToken || adminToken === 'CHANGE_THIS_IN_PRODUCTION') {
    log('⚠️  Warning: ADMIN_TOKEN not set or using default value', 'warning');
    log('   Set ADMIN_TOKEN in Render environment variables or use --token flag', 'info');
  }
  log('', 'info');

  const results = {
    updated: [],
    failed: [],
    notFound: []
  };

  for (const name of employeesToSetAdmin) {
    log(`Looking up: ${name}...`, 'step');
    
    const employee = await getEmployee(name);
    
    if (!employee) {
      log(`❌ ${name} - NOT FOUND`, 'error');
      results.notFound.push(name);
      log('', 'info');
      continue;
    }

    log(`Found: ${employee.name} (${employee.email})`, 'success');
    log(`Current Position: ${employee.position}`, 'info');

    if (employee.position === 'Admin' || employee.position === 'Administrator') {
      log(`✅ Already Admin - skipping`, 'success');
      log('', 'info');
      continue;
    }

    if (dryRun) {
      log(`Would update to: Admin`, 'info');
      results.updated.push({ name: employee.name, email: employee.email, dryRun: true });
    } else {
      log(`Updating to Admin...`, 'step');
      const result = await updateEmployeeToAdmin(employee);
      
      if (result.success) {
        log(`✅ Updated: ${employee.name} → Admin`, 'success');
        results.updated.push({ name: employee.name, email: employee.email });
      } else {
        log(`❌ Failed: ${result.error}`, 'error');
        results.failed.push({ name: employee.name, email: employee.email, error: result.error });
      }
    }
    
    log('', 'info');
  }

  // Summary
  log('', 'info');
  log('📊 Summary:', 'step');
  log(`   Total employees: ${employeesToSetAdmin.length}`, 'info');
  log(`   ✅ Updated: ${results.updated.length}`, 'success');
  log(`   ❌ Failed: ${results.failed.length}`, results.failed.length > 0 ? 'error' : 'info');
  log(`   ⚠️  Not Found: ${results.notFound.length}`, results.notFound.length > 0 ? 'warning' : 'info');

  if (results.failed.length > 0) {
    log('', 'info');
    log('Failed updates:', 'error');
    results.failed.forEach(item => {
      log(`   ${item.name}: ${item.error}`, 'error');
    });
  }

  if (results.notFound.length > 0) {
    log('', 'info');
    log('Not found:', 'warning');
    results.notFound.forEach(name => {
      log(`   ${name}`, 'warning');
    });
  }

  if (dryRun) {
    log('', 'info');
    log('Dry run complete. Run without --dry-run to apply changes.', 'info');
  } else if (results.updated.length > 0) {
    log('', 'info');
    log('✅ Admin roles updated on Render!', 'success');
  }

  return results;
}

// Run the update
setAdminRolesOnRender()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    log(`Fatal error: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  });

