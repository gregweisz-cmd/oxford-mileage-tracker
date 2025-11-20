# Update Passwords on Render Production

This guide explains how to update all employee passwords on the Render production backend.

## Overview

All employee passwords (except Greg Weisz) will be updated to the format: `(Firstname)welcome1`

Example:
- Jackson Longan → Password: `Jacksonwelcome1`
- Sarah Harris → Password: `Sarahwelcome1`

## Method 1: Using the Admin API Endpoint (Recommended)

### Step 1: Set Admin Token in Render Environment Variables

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your backend service: `oxford-mileage-backend`
3. Go to **Environment** tab
4. Add/Update environment variable:
   - **Key**: `ADMIN_TOKEN`
   - **Value**: (Choose a secure random string, e.g., generate one with: `openssl rand -hex 32`)
   - Click **Save Changes**

### Step 2: Call the Admin API Endpoint

Once the environment variable is set and the service has restarted, call the endpoint:

**Using curl:**
```bash
curl -X POST https://oxford-mileage-backend.onrender.com/api/admin/update-passwords \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Using PowerShell (Windows):**
```powershell
$token = "YOUR_ADMIN_TOKEN_HERE"
$headers = @{
    "X-Admin-Token" = $token
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Uri "https://oxford-mileage-backend.onrender.com/api/admin/update-passwords" -Method Post -Headers $headers
```

**Using a REST Client (Postman, Insomnia, etc.):**
- **Method**: POST
- **URL**: `https://oxford-mileage-backend.onrender.com/api/admin/update-passwords`
- **Header**: `X-Admin-Token: YOUR_ADMIN_TOKEN_HERE`
- **Content-Type**: `application/json`

### Step 3: Verify the Update

The API will return a JSON response with:
- `success`: true/false
- `updated`: number of employees updated
- `skipped`: number of employees skipped (errors)
- `employees`: array of updated employees with their new passwords
- `errors`: any errors encountered

Example response:
```json
{
  "success": true,
  "message": "Password update complete. Updated 264 employees.",
  "updated": 264,
  "skipped": 0,
  "employees": [
    {
      "name": "Jackson Longan",
      "email": "jackson.longan@oxfordhouse.org",
      "password": "Jacksonwelcome1"
    },
    ...
  ]
}
```

## Method 2: Verify Passwords (Without Changing)

To check what passwords would be set without actually updating:

```bash
curl -X GET https://oxford-mileage-backend.onrender.com/api/admin/verify-passwords \
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN_HERE"
```

## Security Notes

1. **Admin Token**: Keep the `ADMIN_TOKEN` secure. Don't commit it to Git.
2. **One-Time Use**: After updating passwords, consider changing or rotating the `ADMIN_TOKEN`.
3. **HTTPS**: All API calls use HTTPS, so the token is encrypted in transit.
4. **Logs**: The update will be logged on Render. Check logs for confirmation.

## Troubleshooting

### Error: "Unauthorized. Admin token required."
- Make sure you've set the `ADMIN_TOKEN` environment variable in Render
- Make sure the service has restarted after setting the environment variable
- Verify you're sending the token in the `X-Admin-Token` header

### Error: "Database not initialized"
- The database might not be ready. Wait a few moments and try again.
- Check Render logs for database initialization errors.

### Some Employees Skipped
- Check the `errors` array in the response for details
- Common issues: missing name field, database connection issues

## After Updating

1. **Test Login**: Have a few employees (especially finance team) test their new passwords
2. **Communicate**: Let employees know their new password format: `(Firstname)welcome1`
3. **Encourage Password Change**: Remind employees they can change their password after logging in

## Password Format

The password format is:
```
(Firstname)welcome1
```

Where `(Firstname)` is the employee's first name as it appears in the database.

Examples:
- Greg Weisz → **EXCLUDED** (password remains unchanged)
- Jackson Longan → `Jacksonwelcome1`
- Sarah Harris → `Sarahwelcome1`
- AJ Dunaway → `AJwelcome1`

