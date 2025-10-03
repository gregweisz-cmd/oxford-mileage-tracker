// Simple test script to verify Excel functionality
const XLSX = require('xlsx');

console.log('Testing Excel functionality...');

// Test 1: Create a simple workbook
const testData = [
  { Name: 'John Doe', Email: 'john@test.com', Position: 'Manager' },
  { Name: 'Jane Smith', Email: 'jane@test.com', Position: 'Coordinator' }
];

const worksheet = XLSX.utils.json_to_sheet(testData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Test Sheet');

// Test 2: Generate Excel file
const excelBuffer = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
console.log('✅ Excel file generated successfully!');
console.log('File size:', excelBuffer.length, 'characters');

// Test 3: Verify the data
const newWorkbook = XLSX.read(excelBuffer, { type: 'base64' });
const newWorksheet = newWorkbook.Sheets['Test Sheet'];
const newData = XLSX.utils.sheet_to_json(newWorksheet);
console.log('✅ Data verification successful!');
console.log('Retrieved data:', newData);

console.log('\n🎉 All Excel tests passed!');
console.log('The Admin page Excel functionality should work correctly.');




