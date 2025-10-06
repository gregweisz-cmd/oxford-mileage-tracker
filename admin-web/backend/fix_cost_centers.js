const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to the database
const DB_PATH = path.join(__dirname, '../../oxford_tracker.db');

// Correct cost centers mapping from the CSV
const correctCostCenters = {
  '5d60325822954e074a4cf6e1': ['IL-STATE', 'MN-STATE', 'WI-STATE'], // AJ Dunaway
  '653fc7377ffe2633dcb88761': ['WA.KING'], // Aaron Torrance
  '5cfaed33c5929137a5d1f906': ['OK-SUBG'], // Aaron Vick
  '5fd7c4930300f7002999941b': ['SC-STATE'], // Aislinne Langston
  '65c8ecccebc24bc3a11bc948': ['OR-STATE'], // Alex Smith
  '5cfaed341af1bf3e3acd891a': ['Program Services'], // Alex Szary
  '660d9406ae7fb5de1e937015': ['Finance'], // Alexandra Mulvey
  '66352cb976b9b714c8d22994': ['AZ.MC-SUBG'], // Alexis Landa
  '65b4279cee86bfbddf4ee5cc': ['KY-SOR'], // Alison Kayrouz
  '67698b8828337c0dec758a34': ['NC.F-SOR'], // Alyssa Robles
  '63f4d60a6a7ffc46c8bf7aeb': ['FL-SOR'], // Amanda Disney
  '65809c05d9954830480e9c0a': ['NC.MECKCO-OSG'], // Amanda McGuirt
  '622f6b513da22f72f6989a12': ['Finance'], // Andrea Kissack
  '65871429cd986921f5ce2ac2': ['FL-SOR'], // Andrew Ward
  '65733778f2c9a1989cd0f310': ['TX-SUBG'], // Angelica Neighbors
  '5cfaed34a7e24d36e6574300': ['WA-SUBG'], // Anna Rand
  '5cfaed321af1bf2f0e18feb2': ['WA-SUBG'], // Annie Headley
  '61534df91932e77cd23d9a85': ['TX-SUBG'], // Antonio Rivera Jr.
  '5cfaed3392dabb58c03d5779': ['Program Services'], // Goose Weisz
  '5cfaed321af1bf3f29708a29': ['Program Services'], // Jackson Longan
  '5cfaed3129624875195c4d4c': ['CT-STATE', 'DE-STATE', 'NJ-STATE'], // George Kent
  '5cfaed32c5929136cea26dee': ['Program Services'], // Jason Jarreau
  '5cfaed32c5929137e459451a': ['Program Services'], // James Alston
  '5cfaed31c5929137e45944c2': ['NE-SOR'], // Jacqueline Alba
  '5cfaed3192dabb584397cd0e': ['TN-SUBG'], // Jason Hill
  '63db2744ee7cde62d94f747b': ['WA-SUBG'], // Jason Henken
  '6758568409e617ce81da62f8': ['KY-SOR'], // Jared Vaughn
  '67799997e9d88464ff952d74': ['TN-STATE'], // James Raymond
  '610b1a09ff6a5fdaad7ed702': ['OH-SOR', 'OH-SOS'], // Jacob McKinney
  '5cfaed31c5929137a5d1f881': ['NC.F-SUBG'], // Jacklyn Feliciano
  '661833adea836b98786ca3f7': ['NJ-SUBG'], // Isaac Benezra
  '68390e6855d11fd9c4015875': ['NC.AHP'], // Irving Hewitt
  '5d9ce4b2b0974e4dea5a3676': ['LA-SOR'], // Heather Lee
  '60493c873dc2a796bd56082c': ['NJ-SOR'], // Harold Hannum
  '653ff50e278ec661ef79c91b': ['TN-STATE'], // Geremy Wilkerson
  '635fd70d0e0e7e8617c4c3d5': ['NC.F-SUBG'], // George Buddington
  'jesse_wilson_001': ['Program Services'], // Jesse Wilson
  'kenneth_norman_001': ['Program Services'] // Kenneth Norman
};

// Connect to database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to the SQLite database');
});

// Function to fix cost centers
function fixCostCenters() {
  console.log('🔧 Starting cost center fix...');
  
  let fixedCount = 0;
  let totalCount = 0;
  
  // Get all employees
  db.all('SELECT id, name, oxfordHouseId FROM employees', (err, rows) => {
    if (err) {
      console.error('❌ Error fetching employees:', err.message);
      return;
    }
    
    totalCount = rows.length;
    console.log(`📊 Found ${totalCount} employees to process`);
    
    rows.forEach((employee, index) => {
      const correctCostCentersForEmployee = correctCostCenters[employee.oxfordHouseId];
      
      if (correctCostCentersForEmployee) {
        const costCentersJson = JSON.stringify(correctCostCentersForEmployee);
        const selectedCostCentersJson = JSON.stringify(correctCostCentersForEmployee);
        const defaultCostCenter = correctCostCentersForEmployee[0];
        
        // Update the employee's cost centers
        db.run(
          'UPDATE employees SET costCenters = ? WHERE id = ?',
          [costCentersJson, employee.id],
          function(err) {
            if (err) {
              console.error(`❌ Error updating ${employee.name}:`, err.message);
            } else {
              console.log(`✅ Fixed cost centers for ${employee.name}: ${correctCostCentersForEmployee.join(', ')}`);
              fixedCount++;
            }
            
            // Check if this is the last employee
            if (index === rows.length - 1) {
              console.log(`\n🎉 Cost center fix completed!`);
              console.log(`📊 Fixed ${fixedCount} out of ${totalCount} employees`);
              db.close();
            }
          }
        );
      } else {
        console.log(`⚠️ No cost center data found for ${employee.name} (${employee.oxfordHouseId})`);
        
        // Check if this is the last employee
        if (index === rows.length - 1) {
          console.log(`\n🎉 Cost center fix completed!`);
          console.log(`📊 Fixed ${fixedCount} out of ${totalCount} employees`);
          db.close();
        }
      }
    });
  });
}

// Run the fix
fixCostCenters();
