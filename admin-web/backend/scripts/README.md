# Scripts Directory

Utility scripts organized by purpose.

## Directory Structure

```
scripts/
├── debug/         # Debugging and diagnostic scripts
├── dev/           # Development and testing scripts
├── maintenance/   # Database maintenance and migration scripts
└── README.md      # This file
```

## Script Categories

### Debug Scripts (`debug/`)

Diagnostic and debugging utilities for troubleshooting:

- `check-*.js` - Check database data, schema, or validation
- `find-*.js` - Find specific records or data
- `verify-*.js` - Verify data integrity or correctness

**Examples:**
- `check-employees.js` - Check employee data
- `find-greg.js` - Find Greg Weisz's records
- `verify-password.js` - Verify password hashing

### Development Scripts (`dev/`)

Scripts for development, testing, and data setup:

- `create-*.js` - Create test data or reports
- `load-*.js` - Load test data for specific months
- `link-*.js` - Link relationships between records
- `setup-*.js` - Setup test environments
- `populate-*.js` - Populate test data
- `reset-*.js` - Reset test data
- `grid-*.js` - Grid-related utilities

**Examples:**
- `create-test-reports.js` - Create test expense reports
- `load-greg-january-2025.js` - Load test data for Greg in January
- `setup-test-receipts.js` - Setup test receipt data

### Maintenance Scripts (`maintenance/`)

Database maintenance, migrations, and administrative tasks:

- `export-*.js` - Export data from database
- `migrate-*.js` - Database migrations
- `cleanup-*.js` - Clean up old or duplicate data
- `fix-*.js` - Fix data issues
- `update-*.js` - Update database records

**Examples:**
- `export-supervisor-assignments.js` - Export supervisor relationships
- `migrate-passwords.js` - Migrate password hashes
- `cleanup-old-regular-hours.js` - Clean up old time entries
- `fix-syntax.js` - Fix data syntax issues

## Running Scripts

### From Project Root

```bash
# Debug script
node scripts/debug/check-employees.js

# Development script
node scripts/dev/create-test-reports.js

# Maintenance script
node scripts/maintenance/migrate-passwords.js
```

### From Backend Directory

```bash
# Debug script
node scripts/debug/check-employees.js

# Development script
node scripts/dev/create-test-reports.js

# Maintenance script
node scripts/maintenance/migrate-passwords.js
```

## Script Guidelines

### Before Running

1. **Backup database** - Always backup before maintenance scripts
2. **Check dependencies** - Ensure database is accessible
3. **Read the script** - Understand what it does before running
4. **Test in development** - Never run untested scripts on production

### Script Requirements

Scripts should:
- Include error handling
- Log operations performed
- Be idempotent when possible (safe to run multiple times)
- Include usage instructions in comments

### Creating New Scripts

1. Choose appropriate directory (`debug/`, `dev/`, or `maintenance/`)
2. Follow naming convention (`action-description.js`)
3. Add JSDoc comments explaining purpose
4. Include error handling
5. Update this README if adding new category

## Archived Scripts

Old or deprecated scripts are in `debug-scripts-archive/` directory.

