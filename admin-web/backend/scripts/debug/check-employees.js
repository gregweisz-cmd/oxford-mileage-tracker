const https = require('https');

https.get('https://oxford-mileage-backend.onrender.com/api/employees', (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const employees = JSON.parse(data);
      
      console.log(`Total employees: ${employees.length}`);
      console.log(`With supervisor: ${employees.filter(e => e.supervisorId).length}`);
      console.log(`Without supervisor: ${employees.filter(e => !e.supervisorId).length}`);
      
      const supervisors = employees
        .filter(e => e.supervisorId)
        .map(e => ({ name: e.name, supervisorId: e.supervisorId }));
      
      if (supervisors.length > 0) {
        console.log(`\nEmployees WITH supervisors:`);
        supervisors.forEach(s => console.log(`  ${s.name} -> ${s.supervisorId}`));
      }
      
    } catch (error) {
      console.error('Error parsing data:', error);
    }
  });
}).on('error', (error) => {
  console.error('Error fetching data:', error);
});

