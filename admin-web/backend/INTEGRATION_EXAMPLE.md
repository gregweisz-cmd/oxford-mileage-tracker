# Integration Example

This document shows how to update `server.js` to use the new modular utilities.

## Current Usage in server.js

Currently, these functions are defined directly in `server.js`:

```javascript
// Lines 40-52
function getNetworkIPs() { ... }

// Lines 54-73
function generateEmployeeId(employeeName) { ... }

// Lines 75-82
function generateDefaultPassword(fullName) { ... }

// Lines 84-99
async function hashPassword(password) { ... }
async function comparePassword(password, hash) { ... }

// Lines 505-515
function parseJsonSafe(value, fallback) { ... }

// Lines 517-523
function isFinancePosition(position = '') { ... }
function isSupervisorPosition(position = '') { ... }

// Lines 497-503
function addHours(date, hours) { ... }
function computeEscalationDueAt(hours) { ... }

// Lines 230-316
const COST_CENTERS = [ ... ];
const SUPERVISOR_ESCALATION_HOURS = 48;
const FINANCE_ESCALATION_HOURS = 72;
```

## Updated Usage (After Integration)

Replace the function definitions with imports at the top of `server.js`:

```javascript
// Add these imports near the top, after other requires
const helpers = require('./utils/helpers');
const dateHelpers = require('./utils/dateHelpers');
const constants = require('./utils/constants');

// Then use them like this:
const networkIPs = helpers.getNetworkIPs();
const employeeId = helpers.generateEmployeeId('John Doe');
const password = await helpers.hashPassword('password123');
const isValid = await helpers.comparePassword('password123', hash);
const isFinance = helpers.isFinancePosition('Finance Manager');
const dueAt = helpers.computeEscalationDueAt(constants.SUPERVISOR_ESCALATION_HOURS);
const normalizedDate = dateHelpers.normalizeDateString('01/15/25');

// Use constants directly
const costCenters = constants.COST_CENTERS;
const escalationHours = constants.SUPERVISOR_ESCALATION_HOURS;
```

## Step-by-Step Integration

### Step 1: Add imports
Add these lines after line 20 (after other requires):
```javascript
const helpers = require('./utils/helpers');
const dateHelpers = require('./utils/dateHelpers');
const constants = require('./utils/constants');
```

### Step 2: Remove function definitions
Delete or comment out the function definitions (lines 40-523).

### Step 3: Replace direct calls
Replace direct function calls with module calls:
- `getNetworkIPs()` → `helpers.getNetworkIPs()`
- `generateEmployeeId(name)` → `helpers.generateEmployeeId(name)`
- `parseJsonSafe(value, fallback)` → `helpers.parseJsonSafe(value, fallback)`
- `COST_CENTERS` → `constants.COST_CENTERS`
- `SUPERVISOR_ESCALATION_HOURS` → `constants.SUPERVISOR_ESCALATION_HOURS`
- `normalizeDateString(date)` → `dateHelpers.normalizeDateString(date)`

### Step 4: Test
Run the server and test key endpoints to ensure everything works.

## Benefits

1. **Cleaner server.js**: Removes ~200 lines of utility code
2. **Reusable**: Other modules can import and use these utilities
3. **Testable**: Utilities can be tested independently
4. **Maintainable**: Changes to utilities only need to be made in one place

## Testing

Before making changes to `server.js`, run:
```bash
node test-utils.js
```

This will verify all utilities work correctly.

