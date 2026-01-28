# Deploy to Render

## If you see 404 on live

1. **Confirm the backend URL**  
   In [Render Dashboard](https://dashboard.render.com) → your **oxford-mileage-backend** service → copy the **URL** (e.g. `https://oxford-mileage-backend.onrender.com`).

2. **Test the backend**  
   In a browser, open:
   - `https://[your-backend-url]/health` — should return `{"status":"ok",...}`
   - `https://[your-backend-url]/api/employees` — may ask for auth or return JSON.

   If those 404, the backend isn’t running or the URL is wrong (e.g. different Render service name).

3. **Point the admin at that URL**  
   If the admin is on **Vercel**: Project → Settings → Environment Variables → set **`REACT_APP_API_URL`** = `https://[your-backend-url]` (no trailing slash). Redeploy the frontend after changing it.

4. **Cold starts**  
   On Render’s free tier the service spins down when idle. The first request after a while can take 30–60 seconds or time out; retry or wait for the instance to wake.

---

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
