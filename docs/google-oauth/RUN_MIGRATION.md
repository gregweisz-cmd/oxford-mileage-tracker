# How to Run the Google OAuth Migration

## Correct Command

You need to navigate to the **oxford-mileage-tracker** directory first, not the `.cursor` directory.

### Option 1: Run from oxford-mileage-tracker directory

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker\admin-web\backend
node scripts/migrations/add-google-auth-columns.js
```

### Option 2: Run with full path

```powershell
cd C:\Users\GooseWeisz\oxford-mileage-tracker
node admin-web/backend/scripts/migrations/add-google-auth-columns.js
```

## Expected Output

You should see output like:
```
🔧 Google OAuth Migration Script
================================
Database path: C:\Users\GooseWeisz\oxford-mileage-tracker\admin-web\backend\expense_tracker.db

✅ Connected to database
📊 Current employees table has X columns

➕ Adding googleId column...
✅ Added googleId column
➕ Adding authProvider column...
✅ Added authProvider column
➕ Adding emailVerified column...
✅ Added emailVerified column

📇 Creating index on googleId...
✅ Created index on googleId

🔍 Verifying final table structure...
✅ Final table structure: X columns

New columns:
  - googleId: TEXT (default: NULL)
  - authProvider: TEXT (default: local)
  - emailVerified: INTEGER (default: 0)

✅ Migration complete!
✅ Database connection closed
```

## If Columns Already Exist

If the columns already exist, you'll see:
```
⏭️  googleId column already exists
⏭️  authProvider column already exists
⏭️  emailVerified column already exists
```

This is fine! The migration is idempotent (safe to run multiple times).

