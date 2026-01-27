# Deploy to Render

## Before first deploy (HR Sync)

Add the HR API token in Render so "Sync from HR API" works in production:

1. Render Dashboard → your backend service (e.g. **oxford-mileage-backend**)
2. **Environment** → Add environment variable
3. **Key:** `EMPLOYEE_API_TOKEN`  
   **Value:** (token from Director of Tech / Appwarmer)
4. Save. Render will redeploy with the new variable.

See [docs/HR_SYNC_SETUP.md](docs/HR_SYNC_SETUP.md) for full setup.

## Deploy

Push to `main`. With `autoDeploy: true` and `branch: main` in `render.yaml`, Render deploys automatically.

```bash
git add -A   # only after reviewing; avoid adding .db or secrets
git commit -m "HR Sync from external API + archive employees not in HR"
git push origin main
```
