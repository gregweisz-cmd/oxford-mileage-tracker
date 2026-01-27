/**
 * Script to check for duplicate employee records
 * This helps identify if there are multiple employee records with the same name
 * but different IDs, which could cause data sync issues
 */

const dbService = require('../../services/dbService');
const path = require('path');

// Initialize database
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../../oxford_tracker.db');
dbService.initDatabase(dbPath);

async function checkDuplicates() {
  const db = dbService.getDb();
  
  console.log('🔍 Checking for duplicate employee records...\n');
  
  // Get all employees
  db.all('SELECT id, name, email, createdAt FROM employees ORDER BY name, createdAt', [], (err, employees) => {
    if (err) {
      console.error('❌ Error fetching employees:', err);
      process.exit(1);
    }
    
    // Group by name (case-insensitive)
    const nameMap = new Map();
    employees.forEach(emp => {
      const nameKey = emp.name.toLowerCase().trim();
      if (!nameMap.has(nameKey)) {
        nameMap.set(nameKey, []);
      }
      nameMap.get(nameKey).push(emp);
    });
    
    // Find duplicates
    const duplicates = [];
    nameMap.forEach((emps, name) => {
      if (emps.length > 1) {
        duplicates.push({ name, employees: emps });
      }
    });
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate employee records found!\n');
      process.exit(0);
    }
    
    console.log(`⚠️  Found ${duplicates.length} employee(s) with duplicate names:\n`);
    
    duplicates.forEach(({ name, employees }) => {
      console.log(`📋 "${name}" has ${employees.length} records:`);
      employees.forEach((emp, index) => {
        console.log(`   ${index + 1}. ID: ${emp.id}`);
        console.log(`      Email: ${emp.email || '(no email)'}`);
        console.log(`      Created: ${emp.createdAt}`);
        
        // Check for data associated with each ID
        db.all(
          `SELECT 
            (SELECT COUNT(*) FROM mileage_entries WHERE employeeId = ?) as mileage_count,
            (SELECT COUNT(*) FROM receipts WHERE employeeId = ?) as receipts_count,
            (SELECT COUNT(*) FROM time_tracking WHERE employeeId = ?) as time_count,
            (SELECT COUNT(*) FROM daily_descriptions WHERE employeeId = ?) as descriptions_count
          `,
          [emp.id, emp.id, emp.id, emp.id],
          (err, counts) => {
            if (!err && counts && counts.length > 0) {
              const data = counts[0];
              console.log(`      Data: ${data.mileage_count} mileage, ${data.receipts_count} receipts, ${data.time_count} hours, ${data.descriptions_count} descriptions`);
            }
          }
        );
      });
      console.log('');
    });
    
    console.log('\n💡 Recommendation:');
    console.log('   - Review the duplicate records above');
    console.log('   - Identify which record should be kept (usually the one with the most data)');
    console.log('   - Merge data from duplicate records into the primary record');
    console.log('   - Delete the duplicate employee records');
    console.log('\n   Use the merge script: node scripts/maintenance/merge-duplicate-employees.js');
    
    process.exit(0);
  });
}

checkDuplicates();
