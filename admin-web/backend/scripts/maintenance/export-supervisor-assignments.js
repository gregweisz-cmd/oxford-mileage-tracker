const fs = require('fs');

// Fetch from production database
const https = require('https');

https.get('https://oxford-mileage-backend.onrender.com/api/employees', (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const employees = JSON.parse(data);
      
      // Filter to only employees with supervisors
      const assignments = employees
        .filter(emp => emp.supervisorId)
        .map(emp => ({
          id: emp.id,
          name: emp.name,
          supervisorId: emp.supervisorId
        }));
      
      console.log(`Total employees with supervisors: ${assignments.length}`);
      
      // Save to file
      const output = {
        generatedAt: new Date().toISOString(),
        assignments: assignments
      };
      
      fs.writeFileSync('supervisor-assignments.json', JSON.stringify(output, null, 2));
      console.log('✅ Saved supervisor assignments to supervisor-assignments.json');
      
      // Also create SQL UPDATE statements for easy insertion
      const sqlUpdates = assignments.map(assignment => 
        `UPDATE employees SET supervisorId = '${assignment.supervisorId}' WHERE id = '${assignment.id}';`
      );
      
      fs.writeFileSync('supervisor-assignments.sql', sqlUpdates.join('\n'));
      console.log('✅ Saved SQL UPDATE statements to supervisor-assignments.sql');
      
      // Also create a .js module file for import into server.js
      const jsModule = `// Auto-generated supervisor assignments
// Last updated: ${new Date().toISOString()}

const SUPERVISOR_ASSIGNMENTS = ${JSON.stringify(assignments.map(a => ({
  id: a.id,
  supervisorId: a.supervisorId
})), null, 2)};

module.exports = { SUPERVISOR_ASSIGNMENTS };
`;
      
      fs.writeFileSync('supervisor-assignments-module.js', jsModule);
      console.log('✅ Saved JavaScript module to supervisor-assignments-module.js');
      
    } catch (error) {
      console.error('Error parsing data:', error);
    }
  });
}).on('error', (error) => {
  console.error('Error fetching data:', error);
});

