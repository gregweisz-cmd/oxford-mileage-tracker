const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('expense_tracker.db');

db.all(
  'SELECT id, startLocation, endLocation, needsRevision, revisionReason FROM mileage_entries WHERE employeeId="mh96jo4qry67z3hn41" AND needsRevision=1',
  (err, mileageRows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('Mileage entries needing revision:');
      console.log(JSON.stringify(mileageRows, null, 2));
    }
    
    db.all(
      'SELECT id, category, description, needsRevision, revisionReason FROM time_tracking WHERE employeeId="mh96jo4qry67z3hn41" AND needsRevision=1',
      (err, timeRows) => {
        if (err) {
          console.error('Error:', err);
        } else {
          console.log('\nTime entries needing revision:');
          console.log(JSON.stringify(timeRows, null, 2));
        }
        
        db.all(
          'SELECT id, vendor, description, needsRevision, revisionReason FROM receipts WHERE employeeId="mh96jo4qry67z3hn41" AND needsRevision=1',
          (err, receiptRows) => {
            if (err) {
              console.error('Error:', err);
            } else {
              console.log('\nReceipts needing revision:');
              console.log(JSON.stringify(receiptRows, null, 2));
            }
            db.close();
          }
        );
      }
    );
  }
);

