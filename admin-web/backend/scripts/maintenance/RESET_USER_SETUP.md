# Reset User Setup Wizard

## Overview

This script resets the setup wizard state for a user so they see the setup wizard on their next login (acts like first login).

## What It Does

- Resets `hasCompletedSetupWizard` to `0` (not completed)
- Resets `hasCompletedOnboarding` to `0` (not completed)
- This makes the user see the setup wizard on their next login

## Usage

```bash
cd admin-web/backend
node scripts/maintenance/reset-user-setup-wizard.js <employeeId|email>
```

## Examples

Reset for Greg Weisz by employee ID:
```bash
node scripts/maintenance/reset-user-setup-wizard.js greg-weisz-001
```

Reset by email:
```bash
node scripts/maintenance/reset-user-setup-wizard.js greg.weisz@oxfordhouse.org
```

## What Happens

1. Script looks up the employee by ID or email
2. Shows current state of setup wizard flags
3. Resets both flags to `0` (not completed)
4. User will see setup wizard on next login

## Verification

After running the script:

1. **Log out** of the web portal (if logged in)
2. **Log back in** as the user
3. The **setup wizard should appear** automatically

Or check the database:
```bash
node scripts/debug/check-setup-wizard.js
```

## Notes

- The script uses the production database (`expense_tracker.db`)
- Make sure the backend is stopped if you're running locally
- The user must log out and log back in for the changes to take effect

