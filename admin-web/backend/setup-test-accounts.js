const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path (same as server.js)
const DB_PATH = path.join(__dirname, '..', '..', 'oxford_tracker.db');

// Connect to database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Failed to connect to database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to the SQLite database');
});

// Test accounts to create
const testAccounts = [
  {
    id: 'greg-weisz-001',
    name: 'Greg Weisz',
    preferredName: 'Greg',
    email: 'greg.weisz@oxfordhouse.org',
    password: 'ImtheBoss5!',
    oxfordHouseId: 'oxford-house-001',
    position: 'Senior Data Analyst',
    phoneNumber: '(555) 123-4567',
    baseAddress: '230 Wagner St, Troutman, NC 28166',
    costCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
    selectedCostCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
    defaultCostCenter: 'PS-Unfunded'
  },
  {
    id: 'kathleen-gibson-001',
    name: 'Kathleen Gibson',
    preferredName: 'Kathleen',
    email: 'kathleen.gibson@oxfordhouse.org',
    password: 'Kathleenwelcome1',
    oxfordHouseId: 'oxford-house-001',
    position: 'CEO',
    phoneNumber: '(555) 234-5678',
    baseAddress: '9016 Mustard Seed Ln, Garner, NC 27529',
    costCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
    selectedCostCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
    defaultCostCenter: 'PS-Unfunded'
  },
  {
    id: 'aj-dunaway-001',
    name: 'AJ Dunaway',
    preferredName: 'AJ',
    email: 'ajdunaway@oxfordhouse.org',
    password: 'ajdunaway1!',
    oxfordHouseId: 'oxford-house-002',
    position: 'Program Services Director',
    phoneNumber: '(555) 345-6789',
    baseAddress: '456 Oak Ave, Charlotte, NC 28202',
    costCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Direct Care']),
    selectedCostCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Direct Care']),
    defaultCostCenter: 'PS-Funded'
  },
  {
    id: 'test-supervisor-001',
    name: 'Sarah Johnson',
    preferredName: 'Sarah',
    email: 'sarah.johnson@oxfordhouse.org',
    password: 'TestSupervisor1!',
    oxfordHouseId: 'oxford-house-003',
    position: 'Supervisor',
    phoneNumber: '(555) 456-7890',
    baseAddress: '789 Pine St, Durham, NC 27701',
    costCenters: JSON.stringify(['PS-Funded', 'Direct Care', 'Training']),
    selectedCostCenters: JSON.stringify(['PS-Funded', 'Direct Care', 'Training']),
    defaultCostCenter: 'PS-Funded'
  },
  {
    id: 'test-staff-001',
    name: 'Mike Wilson',
    preferredName: 'Mike',
    email: 'mike.wilson@oxfordhouse.org',
    password: 'TestStaff1!',
    oxfordHouseId: 'oxford-house-004',
    position: 'Staff',
    phoneNumber: '(555) 567-8901',
    baseAddress: '321 Elm St, Greensboro, NC 27401',
    costCenters: JSON.stringify(['Direct Care', 'PS-Funded']),
    selectedCostCenters: JSON.stringify(['Direct Care', 'PS-Funded']),
    defaultCostCenter: 'Direct Care'
  },
  {
    id: 'test-staff-002',
    name: 'Lisa Davis',
    preferredName: 'Lisa',
    email: 'lisa.davis@oxfordhouse.org',
    password: 'TestStaff2!',
    oxfordHouseId: 'oxford-house-005',
    position: 'Staff',
    phoneNumber: '(555) 678-9012',
    baseAddress: '654 Maple Dr, Winston-Salem, NC 27101',
    costCenters: JSON.stringify(['PS-Unfunded', 'Training']),
    selectedCostCenters: JSON.stringify(['PS-Unfunded', 'Training']),
    defaultCostCenter: 'PS-Unfunded'
  },
  {
    id: 'jackson-longan-001',
    name: 'Jackson Longan',
    preferredName: 'Jackson',
    email: 'jackson.longan@oxfordhouse.org',
    password: 'Jacksonwelcome1',
    oxfordHouseId: 'oxford-house-006',
    position: 'Director of Communication and Information',
    phoneNumber: '(361) 563-1537',
    baseAddress: '425 Pergola St, Yukon, OK 73099',
    costCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
    selectedCostCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
    defaultCostCenter: 'PS-Unfunded'
  },
  {
    id: 'alex-szary-001',
    name: 'Alex Szary',
    preferredName: 'Alex',
    email: 'alex.szary@oxfordhouse.org',
    password: 'Alexwelcome1',
    oxfordHouseId: 'oxford-house-007',
    position: 'Senior Manager of Data and Analytics',
    phoneNumber: '(210) 369-8399',
    baseAddress: '7343 Obbligato Ln, San Antonio, TX 78266',
    costCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
    selectedCostCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Administrative', 'Training', 'Direct Care', 'Travel', 'Other']),
    defaultCostCenter: 'PS-Unfunded'
  },
  {
    id: 'kenneth-norman-001',
    name: 'Kenneth Norman',
    preferredName: 'Kenneth',
    email: 'kenneth.norman@oxfordhouse.org',
    password: 'Kennethwelcome1',
    oxfordHouseId: 'oxford-house-008',
    position: 'Re-entry Coordinator',
    phoneNumber: '(402) 669-0608',
    baseAddress: '1019 Grey Fawn Dr, Omaha, NE 68154',
    costCenters: JSON.stringify(['NE-SOR']),
    selectedCostCenters: JSON.stringify(['NE-SOR']),
    defaultCostCenter: 'NE-SOR'
  },
  {
    id: 'matt-diedrich-001',
    name: 'Matt Diedrich',
    preferredName: 'Matt',
    email: 'matt.diedrich@oxfordhouse.org',
    password: 'GiantsSuck1',
    oxfordHouseId: 'oxford-house-009',
    position: 'Staff',
    phoneNumber: '(704) 477-4762',
    baseAddress: '1000 E Woodlawn Rd, Apt 201, Charlotte, NC 28209',
    costCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Direct Care']),
    selectedCostCenters: JSON.stringify(['PS-Unfunded', 'PS-Funded', 'Direct Care']),
    defaultCostCenter: 'PS-Unfunded'
  }
];

console.log('👥 Setting up test accounts...');

let completedAccounts = 0;
const totalAccounts = testAccounts.length;

testAccounts.forEach((account, index) => {
  // Check if account already exists
  db.get(
    'SELECT id FROM employees WHERE id = ? OR email = ?',
    [account.id, account.email],
    (err, row) => {
      if (err) {
        console.error(`❌ Error checking for ${account.name}:`, err);
        return;
      }

      const now = new Date().toISOString();

      if (row) {
        console.log(`🔄 ${account.name} already exists, updating...`);
        
        // Update existing account
        db.run(
          `UPDATE employees SET 
            name = ?,
            preferredName = ?,
            email = ?,
            password = ?,
            oxfordHouseId = ?,
            position = ?,
            phoneNumber = ?,
            baseAddress = ?,
            costCenters = ?,
            selectedCostCenters = ?,
            defaultCostCenter = ?,
            updatedAt = ?
          WHERE id = ?`,
          [
            account.name,
            account.preferredName,
            account.email,
            account.password,
            account.oxfordHouseId,
            account.position,
            account.phoneNumber,
            account.baseAddress,
            account.costCenters,
            account.selectedCostCenters,
            account.defaultCostCenter,
            now,
            account.id
          ],
          (err) => {
            if (err) {
              console.error(`❌ Error updating ${account.name}:`, err);
            } else {
              console.log(`✅ ${account.name} updated successfully`);
            }
            completedAccounts++;
            if (completedAccounts === totalAccounts) {
              printAllAccounts();
            }
          }
        );
      } else {
        console.log(`➕ Creating new account for ${account.name}...`);
        
        // Insert new account
        db.run(
          `INSERT INTO employees (
            id, name, preferredName, email, password, oxfordHouseId, position, 
            phoneNumber, baseAddress, costCenters, selectedCostCenters, 
            defaultCostCenter, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            account.id,
            account.name,
            account.preferredName,
            account.email,
            account.password,
            account.oxfordHouseId,
            account.position,
            account.phoneNumber,
            account.baseAddress,
            account.costCenters,
            account.selectedCostCenters,
            account.defaultCostCenter,
            now,
            now
          ],
          (err) => {
            if (err) {
              console.error(`❌ Error creating ${account.name}:`, err);
            } else {
              console.log(`✅ ${account.name} created successfully`);
            }
            completedAccounts++;
            if (completedAccounts === totalAccounts) {
              printAllAccounts();
            }
          }
        );
      }
    }
  );
});

function printAllAccounts() {
  console.log('\n🎉 All Test Accounts Ready!');
  console.log('=====================================');
  
  testAccounts.forEach((account, index) => {
    console.log(`\n${index + 1}. ${account.name} (${account.preferredName})`);
    console.log(`   Email: ${account.email}`);
    console.log(`   Password: ${account.password}`);
    console.log(`   Position: ${account.position}`);
    console.log(`   Default Cost Center: ${account.defaultCostCenter}`);
    console.log(`   Cost Centers: ${JSON.parse(account.costCenters).join(', ')}`);
  });
  
  console.log('\n=====================================');
  console.log('✅ All accounts are ready for testing!');
  console.log('✅ These accounts will work in both web portal and mobile app');
  console.log('✅ Ready for Vercel deployment');
  console.log('✅ Script completed successfully\n');
  
  db.close();
}
