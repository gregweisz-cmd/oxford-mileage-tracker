const dbService = require('../../services/dbService');
const { debugLog } = require('../../debug');

async function checkCostCenters() {
  await dbService.initDatabase();
  const db = dbService.getDb();
  
  db.all(
    `SELECT name, code, enableGoogleMaps FROM cost_centers 
     WHERE name LIKE '%Program%' OR name LIKE '%PS%' OR code LIKE '%PS%' 
     ORDER BY name`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error:', err);
      } else {
        console.log('\n📋 Cost Centers with Program Services or PS:');
        console.log(JSON.stringify(rows, null, 2));
      }
      process.exit(0);
    }
  );
}

checkCostCenters();

