# HR Sync (External Employee API) Setup

The "Sync from HR API" button in Admin Portal → Employee Management calls `https://api.appwarmer.com/api/employee` to pull names, emails, cost centers, etc. into your employee table. To enable it, set the API token in your environment.

## Local development

1. In the backend folder, create or edit the file:
   ```
   admin-web/backend/.env
   ```

2. Add **one uncommented line** with the token (no `#` at the start of that line):
   ```
   EMPLOYEE_API_TOKEN=your_actual_token_here
   ```
   or
   ```
   APPWARMER_EMPLOYEE_API_TOKEN=your_actual_token_here
   ```
   If you copied from `.env.example`, every line is commented out (`#`). You must add a new line **without** `#`, or remove the `#` from the `EMPLOYEE_API_TOKEN` line and put your token after `=`.

3. Save the file as **UTF-8** (not UTF-16). Some editors on Windows save as UTF-16 by default; dotenv expects UTF-8.

4. From `admin-web/backend`, run:
   ```
   node scripts/check-hr-sync-env.js
   ```
   It should report `Token ready for sync? true`. If it says `(0)` variables or `false`, the line is still commented or the file is wrong.

5. Restart the backend server so it picks up the variable.

6. In Admin Portal, open the Employee Management tab and click **Sync from HR API**. If the token is set correctly, you’ll see a success message (e.g. “Synced X employees; Y created; Z updated; W archived (not in HR)”). HR is the source of truth: anyone not in the HR API is archived.

## Render (production)

1. Open your Render dashboard and select the backend service (e.g. Oxford Mileage Backend).
2. Go to **Environment**.
3. Add a variable:
   - **Key:** `EMPLOYEE_API_TOKEN` (or `APPWARMER_EMPLOYEE_API_TOKEN`)
   - **Value:** the token from your Director of Tech
4. Save. Render will redeploy so the new variable is used.

## Security

- Do **not** put the token in code or in any file that is committed to git.
- `.env` is in `.gitignore` and stays on your machine (or in Render’s encrypted env).
- Rotate the token if it is ever exposed.
