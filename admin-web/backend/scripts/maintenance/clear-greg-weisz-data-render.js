#!/usr/bin/env node
/**
 * Clear All Data for Greg Weisz on Render Production
 * 
 * Deletes all mileage entries, receipts, time tracking, daily descriptions,
 * expense reports, and daily odometer readings for Greg Weisz
 * 
 * Usage:
 *   node scripts/maintenance/clear-greg-weisz-data-render.js [--dry-run]
 * 
 * Requires:
 *   - Production API URL: https://oxford-mileage-backend.onrender.com
 */

const https = require('https');

// Production API URL
const PRODUCTION_API_URL = 'https://oxford-mileage-backend.onrender.com';

// Greg Weisz identifiers (try multiple variations)
const gregIdentifiers = [
  'Greg Weisz',
  'greg.weisz@oxfordhouse.org',
  'mggwglbfk9dij3oze8l',
  'greg-weisz-001'
];

// Get command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

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
        'Content-Type': 'application/json'
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
            // For DELETE operations, 404 might be OK if item doesn't exist
            if (method === 'DELETE' && res.statusCode === 404) {
              resolve({ statusCode: res.statusCode, data: { message: 'Not found (may already be deleted)' } });
            } else {
              reject({ statusCode: res.statusCode, error: parsed.error || parsed.message || responseData });
            }
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: responseData });
          } else {
            reject({ statusCode: res.statusCode, error: responseData });
          }
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
 * Get employee by identifier
 */
async function getEmployee(identifier) {
  try {
    // Try by ID first
    if (identifier.length > 10) {
      try {
        const response = await makeRequest('GET', `/api/employees/${identifier}`);
        if (response.data && response.data.id) {
          return response.data;
        }
      } catch (e) {
        // Not found by ID, try search
      }
    }
    
    // Try by search
    const response = await makeRequest('GET', `/api/employees?search=${encodeURIComponent(identifier)}`);
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      // Find exact match
      const employee = response.data.find(emp => 
        emp.name === identifier || 
        emp.email === identifier ||
        emp.id === identifier
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
 * Delete all mileage entries for employee
 */
async function deleteMileageEntries(employeeId) {
  try {
    log('  Fetching mileage entries...', 'step');
    const response = await makeRequest('GET', `/api/mileage-entries?employeeId=${employeeId}`);
    const entries = response.data || [];
    log(`  Found ${entries.length} mileage entries`, 'info');
    
    if (entries.length === 0) {
      return { deleted: 0, failed: 0 };
    }
    
    let deleted = 0;
    let failed = 0;
    
    for (const entry of entries) {
      if (dryRun) {
        log(`    Would delete: ${entry.id} (${entry.date})`, 'info');
        deleted++;
      } else {
        try {
          await makeRequest('DELETE', `/api/mileage-entries/${entry.id}`);
          deleted++;
        } catch (error) {
          log(`    Failed to delete ${entry.id}: ${error.error || error.message}`, 'error');
          failed++;
        }
      }
    }
    
    return { deleted, failed };
  } catch (error) {
    log(`  Error deleting mileage entries: ${error.error || error.message}`, 'error');
    return { deleted: 0, failed: 0 };
  }
}

/**
 * Delete all receipts for employee
 */
async function deleteReceipts(employeeId) {
  try {
    log('  Fetching receipts...', 'step');
    const response = await makeRequest('GET', `/api/receipts?employeeId=${employeeId}`);
    const receipts = response.data || [];
    log(`  Found ${receipts.length} receipts`, 'info');
    
    if (receipts.length === 0) {
      return { deleted: 0, failed: 0 };
    }
    
    let deleted = 0;
    let failed = 0;
    
    for (const receipt of receipts) {
      if (dryRun) {
        log(`    Would delete: ${receipt.id} (${receipt.date})`, 'info');
        deleted++;
      } else {
        try {
          await makeRequest('DELETE', `/api/receipts/${receipt.id}`);
          deleted++;
        } catch (error) {
          log(`    Failed to delete ${receipt.id}: ${error.error || error.message}`, 'error');
          failed++;
        }
      }
    }
    
    return { deleted, failed };
  } catch (error) {
    log(`  Error deleting receipts: ${error.error || error.message}`, 'error');
    return { deleted: 0, failed: 0 };
  }
}

/**
 * Delete all time tracking entries for employee
 */
async function deleteTimeTracking(employeeId) {
  try {
    log('  Fetching time tracking entries...', 'step');
    const response = await makeRequest('GET', `/api/time-tracking?employeeId=${employeeId}`);
    const entries = response.data || [];
    log(`  Found ${entries.length} time tracking entries`, 'info');
    
    if (entries.length === 0) {
      return { deleted: 0, failed: 0 };
    }
    
    let deleted = 0;
    let failed = 0;
    
    for (const entry of entries) {
      if (dryRun) {
        log(`    Would delete: ${entry.id} (${entry.date})`, 'info');
        deleted++;
      } else {
        try {
          await makeRequest('DELETE', `/api/time-tracking/${entry.id}`);
          deleted++;
        } catch (error) {
          log(`    Failed to delete ${entry.id}: ${error.error || error.message}`, 'error');
          failed++;
        }
      }
    }
    
    return { deleted, failed };
  } catch (error) {
    log(`  Error deleting time tracking: ${error.error || error.message}`, 'error');
    return { deleted: 0, failed: 0 };
  }
}

/**
 * Delete all daily descriptions for employee
 */
async function deleteDailyDescriptions(employeeId) {
  try {
    log('  Fetching daily descriptions...', 'step');
    const response = await makeRequest('GET', `/api/daily-descriptions?employeeId=${employeeId}`);
    const descriptions = response.data || [];
    log(`  Found ${descriptions.length} daily descriptions`, 'info');
    
    if (descriptions.length === 0) {
      return { deleted: 0, failed: 0 };
    }
    
    let deleted = 0;
    let failed = 0;
    
    for (const desc of descriptions) {
      if (dryRun) {
        log(`    Would delete: ${desc.id} (${desc.date})`, 'info');
        deleted++;
      } else {
        try {
          await makeRequest('DELETE', `/api/daily-descriptions/${desc.id}`);
          deleted++;
        } catch (error) {
          log(`    Failed to delete ${desc.id}: ${error.error || error.message}`, 'error');
          failed++;
        }
      }
    }
    
    return { deleted, failed };
  } catch (error) {
    log(`  Error deleting daily descriptions: ${error.error || error.message}`, 'error');
    return { deleted: 0, failed: 0 };
  }
}

/**
 * Delete all expense reports for employee
 */
async function deleteExpenseReports(employeeId) {
  try {
    log('  Fetching expense reports...', 'step');
    // First, try to get all reports for the employee
    let allReports = [];
    try {
      const response = await makeRequest('GET', `/api/expense-reports?employeeId=${employeeId}`);
      if (response.data && Array.isArray(response.data)) {
        allReports = response.data;
      }
    } catch (error) {
      // If that fails, fall back to checking specific months/years
      log('    Could not fetch all reports, checking specific months/years...', 'warning');
      const currentYear = new Date().getFullYear();
      const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
      const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      
      for (const year of years) {
        for (const month of months) {
          try {
            const response = await makeRequest('GET', `/api/expense-reports/${employeeId}/${month}/${year}`);
            if (response.data && response.data.id) {
              allReports.push(response.data);
            }
          } catch (error) {
            // Not found for this month/year, continue
          }
        }
      }
    }
    
    log(`  Found ${allReports.length} expense reports`, 'info');
    
    if (allReports.length === 0) {
      return { deleted: 0, failed: 0, cleared: 0 };
    }
    
    let deleted = 0;
    let failed = 0;
    let cleared = 0;
    
    for (const report of allReports) {
      if (dryRun) {
        log(`    Would delete: ${report.id} (${report.month}/${report.year})`, 'info');
        deleted++;
      } else {
        try {
          // First, try to clear the reportData JSON to remove all embedded data
          try {
            const clearedReportData = {
              employeeSignature: null,
              employeeCertificationAcknowledged: false,
              supervisorSignature: null,
              supervisorCertificationAcknowledged: false,
              dailyEntries: [],
              dailyDescriptions: [],
              receipts: [],
              mileageEntries: [],
              timeTracking: []
            };
            await makeRequest('POST', `/api/expense-reports`, {
              employeeId: employeeId,
              month: report.month,
              year: report.year,
              reportData: clearedReportData
            });
            cleared++;
            log(`    Cleared reportData for ${report.id}`, 'info');
          } catch (clearError) {
            // If clearing fails, continue to delete
            log(`    Could not clear reportData for ${report.id}: ${clearError.error || clearError.message}`, 'warning');
          }
          
          // Then delete the report
          await makeRequest('DELETE', `/api/expense-reports/${report.id}`);
          deleted++;
        } catch (error) {
          log(`    Failed to delete ${report.id}: ${error.error || error.message}`, 'error');
          failed++;
        }
      }
    }
    
    return { deleted, failed, cleared };
  } catch (error) {
    log(`  Error deleting expense reports: ${error.error || error.message}`, 'error');
    return { deleted: 0, failed: 0, cleared: 0 };
  }
}

/**
 * Delete all weekly reports for employee
 */
async function deleteWeeklyReports(employeeId) {
  try {
    log('  Fetching weekly reports...', 'step');
    const response = await makeRequest('GET', `/api/weekly-reports?employeeId=${employeeId}`);
    const reports = response.data || [];
    log(`  Found ${reports.length} weekly reports`, 'info');
    
    if (reports.length === 0) {
      return { deleted: 0, failed: 0 };
    }
    
    let deleted = 0;
    let failed = 0;
    
    for (const report of reports) {
      if (dryRun) {
        log(`    Would delete: ${report.id} (Week ${report.weekNumber}/${report.year})`, 'info');
        deleted++;
      } else {
        try {
          await makeRequest('DELETE', `/api/weekly-reports/${report.id}`);
          deleted++;
        } catch (error) {
          log(`    Failed to delete ${report.id}: ${error.error || error.message}`, 'error');
          failed++;
        }
      }
    }
    
    return { deleted, failed };
  } catch (error) {
    log(`  Error deleting weekly reports: ${error.error || error.message}`, 'error');
    return { deleted: 0, failed: 0 };
  }
}

/**
 * Delete all biweekly reports for employee
 */
async function deleteBiweeklyReports(employeeId) {
  try {
    log('  Fetching biweekly reports...', 'step');
    const response = await makeRequest('GET', `/api/biweekly-reports?employeeId=${employeeId}`);
    const reports = response.data || [];
    log(`  Found ${reports.length} biweekly reports`, 'info');
    
    if (reports.length === 0) {
      return { deleted: 0, failed: 0 };
    }
    
    let deleted = 0;
    let failed = 0;
    
    for (const report of reports) {
      if (dryRun) {
        log(`    Would delete: ${report.id} (Period ${report.periodNumber}/${report.month}/${report.year})`, 'info');
        deleted++;
      } else {
        try {
          await makeRequest('DELETE', `/api/biweekly-reports/${report.id}`);
          deleted++;
        } catch (error) {
          log(`    Failed to delete ${report.id}: ${error.error || error.message}`, 'error');
          failed++;
        }
      }
    }
    
    return { deleted, failed };
  } catch (error) {
    log(`  Error deleting biweekly reports: ${error.error || error.message}`, 'error');
    return { deleted: 0, failed: 0 };
  }
}

/**
 * Clear employee signature and certification data
 */
async function clearEmployeeSignature(employeeId) {
  try {
    log('  Clearing employee signature and certification data...', 'step');
    
    if (dryRun) {
      log('    Would clear signature and certification data', 'info');
      return { cleared: true };
    } else {
      // Get current employee data
      const employeeResponse = await makeRequest('GET', `/api/employees/${employeeId}`);
      if (!employeeResponse.data) {
        log('    Employee not found', 'warning');
        return { cleared: false };
      }
      
      const employee = employeeResponse.data;
      
      // Update employee to clear signature - need to include all required fields
      const updateData = {
        name: employee.name,
        email: employee.email,
        oxfordHouseId: employee.oxfordHouseId,
        position: employee.position,
        phoneNumber: employee.phoneNumber || '',
        baseAddress: employee.baseAddress,
        baseAddress2: employee.baseAddress2 || '',
        signature: null  // Clear the signature
      };
      
      await makeRequest('PUT', `/api/employees/${employeeId}`, updateData);
      
      log('    ✅ Cleared signature data from employee record', 'success');
      return { cleared: true };
    }
  } catch (error) {
    log(`  Error clearing signature: ${error.error || error.message}`, 'error');
    return { cleared: false };
  }
}

/**
 * Main function to clear all data
 */
async function clearGregWeiszData() {
  log('🚀 Clearing All Data for Greg Weisz on Render Production', 'step');
  log(`Production API: ${PRODUCTION_API_URL}`, 'info');
  if (dryRun) {
    log('DRY RUN MODE - No changes will be made', 'warning');
  }
  log('', 'info');

  // Find Greg Weisz
  let employee = null;
  for (const identifier of gregIdentifiers) {
    log(`Looking up: ${identifier}...`, 'step');
    employee = await getEmployee(identifier);
    if (employee) {
      log(`✅ Found: ${employee.name} (${employee.email}) - ID: ${employee.id}`, 'success');
      break;
    }
  }

  if (!employee) {
    log('❌ Greg Weisz not found. Tried:', 'error');
    gregIdentifiers.forEach(id => log(`   - ${id}`, 'error'));
    process.exit(1);
  }

  log('', 'info');
  log(`🗑️  Clearing all data for ${employee.name} (${employee.id})...`, 'step');
  log('', 'info');

  const results = {
    mileageEntries: { deleted: 0, failed: 0 },
    receipts: { deleted: 0, failed: 0 },
    timeTracking: { deleted: 0, failed: 0 },
    dailyDescriptions: { deleted: 0, failed: 0 },
    expenseReports: { deleted: 0, failed: 0 },
    weeklyReports: { deleted: 0, failed: 0 },
    biweeklyReports: { deleted: 0, failed: 0 },
    signature: { cleared: false }
  };

  // Delete mileage entries
  log('📦 Mileage Entries:', 'step');
  results.mileageEntries = await deleteMileageEntries(employee.id);
  log(`   ✅ Deleted: ${results.mileageEntries.deleted}, ❌ Failed: ${results.mileageEntries.failed}`, 
      results.mileageEntries.failed > 0 ? 'error' : 'success');
  log('', 'info');

  // Delete receipts
  log('🧾 Receipts:', 'step');
  results.receipts = await deleteReceipts(employee.id);
  log(`   ✅ Deleted: ${results.receipts.deleted}, ❌ Failed: ${results.receipts.failed}`, 
      results.receipts.failed > 0 ? 'error' : 'success');
  log('', 'info');

  // Delete time tracking
  log('⏰ Time Tracking:', 'step');
  results.timeTracking = await deleteTimeTracking(employee.id);
  log(`   ✅ Deleted: ${results.timeTracking.deleted}, ❌ Failed: ${results.timeTracking.failed}`, 
      results.timeTracking.failed > 0 ? 'error' : 'success');
  log('', 'info');

  // Delete daily descriptions
  log('📝 Daily Descriptions:', 'step');
  results.dailyDescriptions = await deleteDailyDescriptions(employee.id);
  log(`   ✅ Deleted: ${results.dailyDescriptions.deleted}, ❌ Failed: ${results.dailyDescriptions.failed}`, 
      results.dailyDescriptions.failed > 0 ? 'error' : 'success');
  log('', 'info');

  // Delete expense reports
  log('📄 Expense Reports:', 'step');
  results.expenseReports = await deleteExpenseReports(employee.id);
  log(`   ✅ Deleted: ${results.expenseReports.deleted}, ❌ Failed: ${results.expenseReports.failed}`, 
      results.expenseReports.failed > 0 ? 'error' : 'success');
  log('', 'info');

  // Delete weekly reports
  log('📅 Weekly Reports:', 'step');
  results.weeklyReports = await deleteWeeklyReports(employee.id);
  log(`   ✅ Deleted: ${results.weeklyReports.deleted}, ❌ Failed: ${results.weeklyReports.failed}`, 
      results.weeklyReports.failed > 0 ? 'error' : 'success');
  log('', 'info');

  // Delete biweekly reports
  log('📆 Biweekly Reports:', 'step');
  results.biweeklyReports = await deleteBiweeklyReports(employee.id);
  log(`   ✅ Deleted: ${results.biweeklyReports.deleted}, ❌ Failed: ${results.biweeklyReports.failed}`, 
      results.biweeklyReports.failed > 0 ? 'error' : 'success');
  log('', 'info');

  // Clear employee signature
  log('✍️  Employee Signature:', 'step');
  results.signature = await clearEmployeeSignature(employee.id);
  log(`   ${results.signature.cleared ? '✅ Cleared' : '❌ Failed'}`, 
      results.signature.cleared ? 'success' : 'error');
  log('', 'info');

  // Summary
  const totalDeleted = Object.values(results).reduce((sum, r) => {
    if (r && typeof r.deleted === 'number') return sum + r.deleted;
    return sum;
  }, 0);
  const totalFailed = Object.values(results).reduce((sum, r) => {
    if (r && typeof r.failed === 'number') return sum + r.failed;
    return sum;
  }, 0);

  log('📊 Summary:', 'step');
  log(`   Mileage Entries: ${results.mileageEntries.deleted} deleted, ${results.mileageEntries.failed} failed`, 'info');
  log(`   Receipts: ${results.receipts.deleted} deleted, ${results.receipts.failed} failed`, 'info');
  log(`   Time Tracking: ${results.timeTracking.deleted} deleted, ${results.timeTracking.failed} failed`, 'info');
  log(`   Daily Descriptions: ${results.dailyDescriptions.deleted} deleted, ${results.dailyDescriptions.failed} failed`, 'info');
  log(`   Expense Reports: ${results.expenseReports.deleted} deleted, ${results.expenseReports.cleared || 0} cleared, ${results.expenseReports.failed} failed`, 'info');
  log(`   Weekly Reports: ${results.weeklyReports.deleted} deleted, ${results.weeklyReports.failed} failed`, 'info');
  log(`   Biweekly Reports: ${results.biweeklyReports.deleted} deleted, ${results.biweeklyReports.failed} failed`, 'info');
  log(`   Signature: ${results.signature.cleared ? 'Cleared' : 'Failed'}`, results.signature.cleared ? 'success' : 'error');
  log('', 'info');
  log(`   Total: ${totalDeleted} items deleted, ${totalFailed} failed`, 
      totalFailed > 0 ? 'error' : 'success');

  if (dryRun) {
    log('', 'info');
    log('Dry run complete. Run without --dry-run to apply changes.', 'warning');
  } else if (totalDeleted > 0) {
    log('', 'info');
    log('✅ All data cleared for Greg Weisz!', 'success');
  }

  return results;
}

// Run the cleanup
clearGregWeiszData()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    log(`Fatal error: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  });
