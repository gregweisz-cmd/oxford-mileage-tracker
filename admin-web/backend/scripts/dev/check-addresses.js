const dbService = require('../../services/dbService');

async function checkAddresses() {
  await dbService.initDatabase();
  const db = dbService.getDb();
  
  db.all(
    `SELECT date, startLocationAddress, endLocationAddress, costCenter, miles 
     FROM mileage_entries 
     WHERE employeeId = 'greg-weisz-001' 
     AND date LIKE '2025-01%' 
     ORDER BY date`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log(`\n📋 Found ${rows.length} mileage entries for Greg Weisz in January 2025:\n`);
        rows.forEach((row, i) => {
          console.log(`${i + 1}. ${row.date} - ${row.costCenter} (${row.miles} miles)`);
          console.log(`   Start: ${row.startLocationAddress || 'N/A'}`);
          console.log(`   End: ${row.endLocationAddress || 'N/A'}`);
          console.log('');
        });
      }
      process.exit(0);
    }
  );
}

checkAddresses();

