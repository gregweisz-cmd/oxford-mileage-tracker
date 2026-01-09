/**
 * Add test addresses to Greg Weisz's mileage entries for Google Maps testing
 */

const dbService = require('../../services/dbService');
const { debugLog, debugError } = require('../../debug');

async function addTestAddresses() {
  // Initialize database first
  await dbService.initDatabase();
  const db = dbService.getDb();
  
  return new Promise((resolve, reject) => {
    // First, find Greg Weisz's employee ID
    db.get("SELECT id, name FROM employees WHERE LOWER(name) LIKE '%greg%' OR LOWER(email) LIKE '%greg.weisz%'", [], (err, employee) => {
      if (err) {
        debugError('Error finding Greg Weisz:', err);
        reject(err);
        return;
      }
      
      if (!employee) {
        debugError('Greg Weisz not found in database');
        reject(new Error('Greg Weisz not found'));
        return;
      }
      
      const employeeId = employee.id;
      debugLog(`Found employee: ${employee.name} (ID: ${employeeId})`);
      
      // Use January 2025 for the test data
      const testMonth = 1; // January
      const testYear = 2025;
      
      // Find mileage entries for Greg in January 2025 with "Program Services" cost center
      const monthStr = testMonth.toString().padStart(2, '0');
      const yearStr = testYear.toString();
      
      const query = `
        SELECT id, date, startLocation, endLocation, costCenter 
        FROM mileage_entries 
        WHERE employeeId = ? 
        AND costCenter = 'Program Services'
        AND (
          (date LIKE '%-%-%' AND strftime("%m", date) = ? AND strftime("%Y", date) = ?)
          OR (date LIKE '%/%/%' AND CAST(SUBSTR(date, 1, 2) AS INTEGER) = ? AND SUBSTR(date, 7) = ?)
        )
        ORDER BY date
        LIMIT 10
      `;
      
      const monthInt = parseInt(monthStr);
      const year2digit = yearStr.slice(-2);
      
      db.all(query, [employeeId, monthStr, yearStr, monthInt, year2digit], (err, entries) => {
        if (err) {
          debugError('Error finding mileage entries:', err);
          reject(err);
          return;
        }
        
        if (entries.length === 0) {
          debugLog('No mileage entries found. Creating test entries...');
          
          // Get Greg's base address
          db.get('SELECT baseAddress FROM employees WHERE id = ?', [employeeId], (baseErr, baseRow) => {
            if (baseErr) {
              debugError('Error getting base address:', baseErr);
              reject(baseErr);
              return;
            }
            
            const baseAddress = baseRow?.baseAddress || '230 Wagner St, Troutman, NC 28166'; // Default from credentials
            
            // Create entries from January 2025 report with real addresses
            const testEntries = [
              {
                date: `${testYear}-${monthStr}-06`,
                startLocation: 'BA',
                endLocation: 'OH Jirah',
                startLocationAddress: baseAddress,
                endLocationAddress: '209 S Trenton St, Gastonia, NC',
                purpose: 'help setup new computer for house',
                miles: 101,
                costCenter: 'Program Services'
              },
              {
                date: `${testYear}-${monthStr}-06`,
                startLocation: 'OH Jirah',
                endLocation: 'BA',
                startLocationAddress: '209 S Trenton St, Gastonia, NC',
                endLocationAddress: baseAddress,
                purpose: 'return from OH Jirah',
                miles: 0, // Return trip, already counted
                costCenter: 'Program Services'
              },
              {
                date: `${testYear}-${monthStr}-09`,
                startLocation: 'BA',
                endLocation: "coworker's house",
                startLocationAddress: baseAddress,
                endLocationAddress: '2061 Jamestown Rd, Morganton, NC',
                purpose: 'work on data project',
                miles: 110,
                costCenter: 'Program Services'
              },
              {
                date: `${testYear}-${monthStr}-09`,
                startLocation: "coworker's house",
                endLocation: 'BA',
                startLocationAddress: '2061 Jamestown Rd, Morganton, NC',
                endLocationAddress: baseAddress,
                purpose: 'return from coworker house',
                miles: 0, // Return trip
                costCenter: 'Program Services'
              },
              {
                date: `${testYear}-${monthStr}-21`,
                startLocation: 'BA',
                endLocation: "coworker's house",
                startLocationAddress: baseAddress,
                endLocationAddress: '673 Sand Hill Rd, Asheville, NC',
                purpose: 'drop off donations',
                miles: 216,
                costCenter: 'Program Services'
              },
              {
                date: `${testYear}-${monthStr}-21`,
                startLocation: "coworker's house",
                endLocation: 'BA',
                startLocationAddress: '673 Sand Hill Rd, Asheville, NC',
                endLocationAddress: baseAddress,
                purpose: 'return from coworker house',
                miles: 0, // Return trip
                costCenter: 'Program Services'
              },
              {
                date: `${testYear}-${monthStr}-28`,
                startLocation: 'BA',
                endLocation: 'OH Violet',
                startLocationAddress: baseAddress,
                endLocationAddress: '205 Davis Dr, Morganton, NC',
                purpose: 'help move house out',
                miles: 100,
                costCenter: 'Program Services'
              },
              {
                date: `${testYear}-${monthStr}-28`,
                startLocation: 'OH Violet',
                endLocation: 'BA',
                startLocationAddress: '205 Davis Dr, Morganton, NC',
                endLocationAddress: baseAddress,
                purpose: 'return from OH Violet',
                miles: 0, // Return trip
                costCenter: 'Program Services'
              },
              {
                date: `${testYear}-${monthStr}-30`,
                startLocation: 'BA',
                endLocation: 'Federal Storage',
                startLocationAddress: baseAddress,
                endLocationAddress: '2806 N Cannon Blvd, Kannapolis, NC',
                purpose: 'help load donations',
                miles: 35, // Estimated portion of 104 miles
                costCenter: 'Program Services'
              },
              {
                date: `${testYear}-${monthStr}-30`,
                startLocation: 'Federal Storage',
                endLocation: 'OH Timber Lake',
                startLocationAddress: '2806 N Cannon Blvd, Kannapolis, NC',
                endLocationAddress: '1519 Marlwood Cir, Charlotte, NC',
                purpose: 'transport donations',
                miles: 35, // Estimated portion of 104 miles
                costCenter: 'Program Services'
              },
              {
                date: `${testYear}-${monthStr}-30`,
                startLocation: 'OH Timber Lake',
                endLocation: 'BA',
                startLocationAddress: '1519 Marlwood Cir, Charlotte, NC',
                endLocationAddress: baseAddress,
                purpose: 'return from OH Timber Lake',
                miles: 34, // Remaining portion of 104 miles
                costCenter: 'Program Services'
              }
            ];
          
            // Get oxfordHouseId
            db.get('SELECT oxfordHouseId FROM employees WHERE id = ?', [employeeId], (empErr, empRow) => {
              if (empErr) {
                debugError('Error getting oxfordHouseId:', empErr);
                reject(empErr);
                return;
              }
              
              const oxfordHouseId = empRow?.oxfordHouseId || '';
              const now = new Date().toISOString();
              let completed = 0;
              let errors = 0;
              
              // Create all entries (including all stops for multi-stop trips)
              const entriesToCreate = testEntries;
              
              entriesToCreate.forEach((entry, index) => {
                const entryId = `jan2025-${employeeId}-${entry.date.replace(/-/g, '')}-${index}`;
                
                db.run(
                  `INSERT OR REPLACE INTO mileage_entries (
                    id, employeeId, oxfordHouseId, date, odometerReading, 
                    startLocation, endLocation, startLocationAddress, endLocationAddress,
                    purpose, miles, costCenter, isGpsTracked, createdAt, updatedAt
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    entryId, employeeId, oxfordHouseId, entry.date, entry.miles,
                    entry.startLocation, entry.endLocation, 
                    entry.startLocationAddress, entry.endLocationAddress,
                    entry.purpose, entry.miles, entry.costCenter, 0, now, now
                  ],
                  (insertErr) => {
                    if (insertErr) {
                      debugError(`Error creating test entry ${index + 1}:`, insertErr);
                      errors++;
                    } else {
                      debugLog(`✅ Created test entry ${index + 1}: ${entry.date} - ${entry.startLocation} to ${entry.endLocation} (${entry.miles} miles)`);
                      completed++;
                    }
                    
                    if (completed + errors === entriesToCreate.length) {
                      debugLog(`✅ Added ${completed} test entries with addresses for January 2025`);
                      if (errors > 0) {
                        debugError(`⚠️ ${errors} entries failed`);
                      }
                      resolve();
                    }
                  }
                );
              });
            });
          });
        } else {
          debugLog(`Found ${entries.length} existing entries. Recreating with January 2025 addresses...`);
          
          // Delete existing entries for January 2025 to recreate them properly
          db.run(
            `DELETE FROM mileage_entries 
             WHERE employeeId = ? 
             AND costCenter = 'Program Services'
             AND (
               (date LIKE '%-%-%' AND strftime("%m", date) = ? AND strftime("%Y", date) = ?)
               OR (date LIKE '%/%/%' AND CAST(SUBSTR(date, 1, 2) AS INTEGER) = ? AND SUBSTR(date, 7) = ?)
             )`,
            [employeeId, monthStr, yearStr, monthInt, year2digit],
            (deleteErr) => {
              if (deleteErr) {
                debugError('Error deleting existing entries:', deleteErr);
                reject(deleteErr);
                return;
              }
              
              debugLog('Deleted existing entries. Creating new entries with January 2025 addresses...');
              
              // Get Greg's base address
              db.get('SELECT baseAddress FROM employees WHERE id = ?', [employeeId], (baseErr, baseRow) => {
                if (baseErr) {
                  debugError('Error getting base address:', baseErr);
                  reject(baseErr);
                  return;
                }
                
                const baseAddress = baseRow?.baseAddress || '230 Wagner St, Troutman, NC 28166';
                
                // Create entries from January 2025 report with real addresses
                const testEntries = [
                  {
                    date: `${testYear}-${monthStr}-06`,
                    startLocation: 'BA',
                    endLocation: 'OH Jirah',
                    startLocationAddress: baseAddress,
                    endLocationAddress: '209 S Trenton St, Gastonia, NC',
                    purpose: 'help setup new computer for house',
                    miles: 101,
                    costCenter: 'Program Services'
                  },
                  {
                    date: `${testYear}-${monthStr}-06`,
                    startLocation: 'OH Jirah',
                    endLocation: 'BA',
                    startLocationAddress: '209 S Trenton St, Gastonia, NC',
                    endLocationAddress: baseAddress,
                    purpose: 'return from OH Jirah',
                    miles: 0,
                    costCenter: 'Program Services'
                  },
                  {
                    date: `${testYear}-${monthStr}-09`,
                    startLocation: 'BA',
                    endLocation: "coworker's house",
                    startLocationAddress: baseAddress,
                    endLocationAddress: '2061 Jamestown Rd, Morganton, NC',
                    purpose: 'work on data project',
                    miles: 110,
                    costCenter: 'Program Services'
                  },
                  {
                    date: `${testYear}-${monthStr}-09`,
                    startLocation: "coworker's house",
                    endLocation: 'BA',
                    startLocationAddress: '2061 Jamestown Rd, Morganton, NC',
                    endLocationAddress: baseAddress,
                    purpose: 'return from coworker house',
                    miles: 0,
                    costCenter: 'Program Services'
                  },
                  {
                    date: `${testYear}-${monthStr}-21`,
                    startLocation: 'BA',
                    endLocation: "coworker's house",
                    startLocationAddress: baseAddress,
                    endLocationAddress: '673 Sand Hill Rd, Asheville, NC',
                    purpose: 'drop off donations',
                    miles: 216,
                    costCenter: 'Program Services'
                  },
                  {
                    date: `${testYear}-${monthStr}-21`,
                    startLocation: "coworker's house",
                    endLocation: 'BA',
                    startLocationAddress: '673 Sand Hill Rd, Asheville, NC',
                    endLocationAddress: baseAddress,
                    purpose: 'return from coworker house',
                    miles: 0,
                    costCenter: 'Program Services'
                  },
                  {
                    date: `${testYear}-${monthStr}-28`,
                    startLocation: 'BA',
                    endLocation: 'OH Violet',
                    startLocationAddress: baseAddress,
                    endLocationAddress: '205 Davis Dr, Morganton, NC',
                    purpose: 'help move house out',
                    miles: 100,
                    costCenter: 'Program Services'
                  },
                  {
                    date: `${testYear}-${monthStr}-28`,
                    startLocation: 'OH Violet',
                    endLocation: 'BA',
                    startLocationAddress: '205 Davis Dr, Morganton, NC',
                    endLocationAddress: baseAddress,
                    purpose: 'return from OH Violet',
                    miles: 0,
                    costCenter: 'Program Services'
                  },
                  {
                    date: `${testYear}-${monthStr}-30`,
                    startLocation: 'BA',
                    endLocation: 'Federal Storage',
                    startLocationAddress: baseAddress,
                    endLocationAddress: '2806 N Cannon Blvd, Kannapolis, NC',
                    purpose: 'help load donations',
                    miles: 35,
                    costCenter: 'Program Services'
                  },
                  {
                    date: `${testYear}-${monthStr}-30`,
                    startLocation: 'Federal Storage',
                    endLocation: 'OH Timber Lake',
                    startLocationAddress: '2806 N Cannon Blvd, Kannapolis, NC',
                    endLocationAddress: '1519 Marlwood Cir, Charlotte, NC',
                    purpose: 'transport donations',
                    miles: 35,
                    costCenter: 'Program Services'
                  },
                  {
                    date: `${testYear}-${monthStr}-30`,
                    startLocation: 'OH Timber Lake',
                    endLocation: 'BA',
                    startLocationAddress: '1519 Marlwood Cir, Charlotte, NC',
                    endLocationAddress: baseAddress,
                    purpose: 'return from OH Timber Lake',
                    miles: 34,
                    costCenter: 'Program Services'
                  }
                ];
                
                // Get oxfordHouseId
                db.get('SELECT oxfordHouseId FROM employees WHERE id = ?', [employeeId], (empErr, empRow) => {
                  if (empErr) {
                    debugError('Error getting oxfordHouseId:', empErr);
                    reject(empErr);
                    return;
                  }
                  
                  const oxfordHouseId = empRow?.oxfordHouseId || '';
                  const now = new Date().toISOString();
                  let completed = 0;
                  let errors = 0;
                  
                  testEntries.forEach((entry, index) => {
                    const entryId = `jan2025-${employeeId}-${entry.date.replace(/-/g, '')}-${index}`;
                    
                    db.run(
                      `INSERT INTO mileage_entries (
                        id, employeeId, oxfordHouseId, date, odometerReading, 
                        startLocation, endLocation, startLocationAddress, endLocationAddress,
                        purpose, miles, costCenter, isGpsTracked, createdAt, updatedAt
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        entryId, employeeId, oxfordHouseId, entry.date, entry.miles,
                        entry.startLocation, entry.endLocation, 
                        entry.startLocationAddress, entry.endLocationAddress,
                        entry.purpose, entry.miles, entry.costCenter, 0, now, now
                      ],
                      (insertErr) => {
                        if (insertErr) {
                          debugError(`Error creating test entry ${index + 1}:`, insertErr);
                          errors++;
                        } else {
                          debugLog(`✅ Created test entry ${index + 1}: ${entry.date} - ${entry.startLocation} to ${entry.endLocation} (${entry.miles} miles)`);
                          completed++;
                        }
                        
                        if (completed + errors === testEntries.length) {
                          debugLog(`✅ Added ${completed} test entries with addresses for January 2025`);
                          if (errors > 0) {
                            debugError(`⚠️ ${errors} entries failed`);
                          }
                          resolve();
                        }
                      }
                    );
                  });
                });
              });
            }
          );
        }
      });
    });
  });
}

// Run the script
if (require.main === module) {
  addTestAddresses()
    .then(() => {
      debugLog('✅ Test addresses added successfully');
      process.exit(0);
    })
    .catch((error) => {
      debugError('❌ Error adding test addresses:', error);
      process.exit(1);
    });
}

module.exports = { addTestAddresses };

