const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'expense_tracker.db');
const db = new sqlite3.Database(dbPath);

console.log('🧪 Setting up test data for receipts functionality testing...');

// Create test receipts data
const testReceipts = [
  {
    id: 'test-receipt-001',
    employeeId: 'greg-weisz-001',
    vendor: 'Shell Gas Station',
    category: 'Gas',
    amount: 45.67,
    date: '2025-10-23',
    description: 'Gas fill-up at Shell station on Main St',
    imageUri: '/uploads/test-receipts/gas-station-shell.jpg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'test-receipt-002',
    employeeId: 'greg-weisz-001',
    vendor: 'Local Diner',
    category: 'Meals',
    amount: 23.45,
    date: '2025-10-23',
    description: 'Business lunch at Local Diner',
    imageUri: '/uploads/test-receipts/restaurant-diner.jpg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'test-receipt-003',
    employeeId: 'greg-weisz-001',
    vendor: 'Staples',
    category: 'Office Supplies',
    amount: 89.99,
    date: '2025-10-22',
    description: 'Office supplies for project work',
    imageUri: '/uploads/test-receipts/office-supplies-staples.pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'test-receipt-004',
    employeeId: 'greg-weisz-001',
    vendor: 'Marriott Hotel',
    category: 'Lodging',
    amount: 156.78,
    date: '2025-10-21',
    description: 'Business trip accommodation',
    imageUri: '/uploads/test-receipts/hotel-marriott.jpg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'test-receipt-005',
    employeeId: 'greg-weisz-001',
    vendor: 'Downtown Parking Garage',
    category: 'Parking',
    amount: 12.00,
    date: '2025-10-23',
    description: 'Parking at downtown garage',
    imageUri: '/uploads/test-receipts/parking-garage.jpg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Ensure receipts table exists
db.run(`
  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    employeeId TEXT NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    vendor TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    imageUri TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (employeeId) REFERENCES employees (id)
  )
`, (err) => {
  if (err) {
    console.error('❌ Error creating receipts table:', err.message);
    return;
  }
  
  console.log('✅ Receipts table ensured to exist');
  
  // Clear existing test receipts
  db.run('DELETE FROM receipts WHERE id LIKE "test-receipt-%"', (err) => {
    if (err) {
      console.error('❌ Error clearing test receipts:', err.message);
      return;
    }
    
    console.log('🧹 Cleared existing test receipts');
    
    // Insert test receipts
    let completed = 0;
    testReceipts.forEach((receipt) => {
      db.run(`
        INSERT INTO receipts (
          id, employeeId, date, amount, vendor, description, category, imageUri, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        receipt.id, receipt.employeeId, receipt.date, receipt.amount, receipt.vendor,
        receipt.description, receipt.category, receipt.imageUri, receipt.createdAt, receipt.updatedAt
      ], function(err) {
        if (err) {
          console.error(`❌ Error inserting receipt ${receipt.id}:`, err.message);
        } else {
          console.log(`✅ Inserted test receipt: ${receipt.vendor}`);
        }
        
        completed++;
        if (completed === testReceipts.length) {
          console.log('🎉 Test receipts setup completed!');
          
          // Verify the data
          db.all('SELECT COUNT(*) as count FROM receipts WHERE id LIKE "test-receipt-%"', (err, rows) => {
            if (err) {
              console.error('❌ Error verifying test receipts:', err.message);
            } else {
              console.log(`📊 Total test receipts created: ${rows[0].count}`);
            }
            
            db.close();
          });
        }
      });
    });
  });
});

