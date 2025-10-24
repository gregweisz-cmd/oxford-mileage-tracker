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
    filename: 'gas-station-shell.jpg',
    originalName: 'Shell Gas Station Receipt',
    category: 'Gas',
    amount: 45.67,
    date: '2025-10-23',
    description: 'Gas fill-up at Shell station on Main St',
    filePath: '/uploads/test-receipts/gas-station-shell.jpg',
    fileSize: 245760,
    mimeType: 'image/jpeg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'test-receipt-002',
    employeeId: 'greg-weisz-001',
    filename: 'restaurant-diner.jpg',
    originalName: 'Local Diner Receipt',
    category: 'Meals',
    amount: 23.45,
    date: '2025-10-23',
    description: 'Business lunch at Local Diner',
    filePath: '/uploads/test-receipts/restaurant-diner.jpg',
    fileSize: 189440,
    mimeType: 'image/jpeg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'test-receipt-003',
    employeeId: 'greg-weisz-001',
    filename: 'office-supplies-staples.pdf',
    originalName: 'Staples Office Supplies',
    category: 'Office Supplies',
    amount: 89.99,
    date: '2025-10-22',
    description: 'Office supplies for project work',
    filePath: '/uploads/test-receipts/office-supplies-staples.pdf',
    fileSize: 512000,
    mimeType: 'application/pdf',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'test-receipt-004',
    employeeId: 'greg-weisz-001',
    filename: 'hotel-marriott.jpg',
    originalName: 'Marriott Hotel Receipt',
    category: 'Lodging',
    amount: 156.78,
    date: '2025-10-21',
    description: 'Business trip accommodation',
    filePath: '/uploads/test-receipts/hotel-marriott.jpg',
    fileSize: 678912,
    mimeType: 'image/jpeg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'test-receipt-005',
    employeeId: 'greg-weisz-001',
    filename: 'parking-garage.jpg',
    originalName: 'Downtown Parking',
    category: 'Parking',
    amount: 12.00,
    date: '2025-10-23',
    description: 'Parking at downtown garage',
    filePath: '/uploads/test-receipts/parking-garage.jpg',
    fileSize: 156789,
    mimeType: 'image/jpeg',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Ensure receipts table exists
db.run(`
  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    employeeId TEXT NOT NULL,
    filename TEXT NOT NULL,
    originalName TEXT,
    category TEXT,
    amount REAL,
    date TEXT,
    description TEXT,
    filePath TEXT,
    fileSize INTEGER,
    mimeType TEXT,
    createdAt TEXT,
    updatedAt TEXT,
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
          id, employeeId, filename, originalName, category, amount, date,
          description, filePath, fileSize, mimeType, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        receipt.id, receipt.employeeId, receipt.filename, receipt.originalName,
        receipt.category, receipt.amount, receipt.date, receipt.description,
        receipt.filePath, receipt.fileSize, receipt.mimeType,
        receipt.createdAt, receipt.updatedAt
      ], function(err) {
        if (err) {
          console.error(`❌ Error inserting receipt ${receipt.id}:`, err.message);
        } else {
          console.log(`✅ Inserted test receipt: ${receipt.originalName}`);
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
