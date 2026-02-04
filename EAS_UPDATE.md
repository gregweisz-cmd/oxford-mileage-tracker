# EAS OTA Updates (mobile app)

**Always run EAS update from the repo root** (`oxford-mileage-tracker`), not from `admin-web`.

- **Correct project (mobile):** `oh-staff-tracker` → projectId `d303cc80-9dcf-4d5c-952b-d50df5cb04f0`  
  Updates URL: https://u.expo.dev/d303cc80-9dcf-4d5c-952b-d50df5cb04f0  
  Dashboard: https://expo.dev/accounts/goosew27/projects/oh-staff-tracker/updates

- **admin-web** has its own `app.json` with a different projectId (`29c7c213-...`). Running `eas update` from inside `admin-web` publishes to that other project, so the installed mobile app (which checks the first project) will not receive those updates.

**From repo root:**

```bash
npm run eas-update
# or with a custom message:
npx eas update --branch production --message "Your message"
```

The app uses the **Render** backend when `USE_PRODUCTION_FOR_TESTING` is true in `src/config/api.ts` (production API URL is set there).
