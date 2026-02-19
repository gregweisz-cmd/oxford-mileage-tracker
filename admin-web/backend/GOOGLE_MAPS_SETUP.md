# Google Maps API Setup

This document describes how to configure Google Maps APIs used by the app and web portal.

## Which APIs Are Used Where

| Feature | API(s) | Purpose |
|--------|--------|--------|
| **Calculate miles** (web + app) | Geocoding API, Distance Matrix API | Turn addresses into coordinates and get driving distance |
| **PDF route maps** (export) | **Maps Static API**, **Directions API** (optional) | Static: map image; Directions: actual driven route (polyline). If Directions is not enabled, maps show a straight line between start/end. |

They are **separate APIs**. If "Calculate" works, Geocoding and Distance Matrix are enabled. PDF maps will still show "Map unavailable" until **Maps Static API** is enabled in the same project (see below).

## If GitHub or Google flagged your API key (revoke and rotate)

If GitHub secret scanning or Google notified you that a Maps API key was exposed:

1. **Revoke the exposed key**
   - Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
   - Find the exposed API key and either **Delete** it or **Regenerate** it (if your provider offers that).
   - Treat the old key as compromised; do not use it again.

2. **Create a new API key**
   - In **Credentials**, click **Create Credentials** → **API Key**.
   - Copy the new key. Optionally restrict it (Maps Static API, Geocoding API, Distance Matrix API) and set application restrictions.

3. **Set the new key everywhere (never commit it)**
   - **Render (backend)**: Environment → add or update `GOOGLE_MAPS_API_KEY` with the new key. Save so the service redeploys.
   - **Mobile app (EAS builds)**: In [Expo Dashboard](https://expo.dev) → your project → **Secrets**, add `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` with the new key. The repo uses `app.config.js` to read this at build time so the key is not in source control.
   - **Mobile app (local dev)**: Either set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in your shell before running, or temporarily put the key in `app.json` under `expo.extra.googleMapsApiKey` and **do not commit** that change (the repo keeps a placeholder there).

After rotating, the repo should only ever contain the placeholder `YOUR_GOOGLE_MAPS_API_KEY_HERE` in `app.json`; the real key lives only in env vars and secrets.

## Overview

The Google Maps feature allows finance team members to view route maps in PDF expense reports. Maps show one map per trip, zoomed to that route.

## Prerequisites

- Google Cloud Platform account
- Billing enabled on your Google Cloud project (Google Maps Static API requires billing)

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable billing for the project

### 2. Enable Google Maps Static API

1. Navigate to **APIs & Services** > **Library**
2. Search for "Maps Static API"
3. Click on "Maps Static API" and click **Enable**

### 3. Create API Key

1. Navigate to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. Copy the generated API key
4. (Recommended) Click **Restrict Key** to limit usage:
   - **Application restrictions**: None (backend server) or IP if you know Render’s IPs
   - **API restrictions**: Restrict key → choose "Maps Static API" (for PDF maps). For PDF maps to show the **driven route** (not just a straight line), also enable **Directions API**. If you use **Calculate miles** on the web portal, also allow "Geocoding API" and "Distance Matrix API"

### 4. Enable APIs for Web Portal "Calculate miles" (optional)

The web portal **Calculate miles** button uses the same key and needs:

1. **Geocoding API** – **APIs & Services** > **Library** > search "Geocoding API" > **Enable**
2. **Distance Matrix API** – **APIs & Services** > **Library** > search "Distance Matrix API" > **Enable**

If you only use static maps in PDF reports, you can skip this. If "Calculate miles" is used, enable both.

### 5. Configure Environment Variable

**Local / .env**

Add the following to your `.env` file:

```bash
GOOGLE_MAPS_API_KEY=your_api_key_here
```

**Important**: Never commit the API key to version control. Add `.env` to `.gitignore` if not already present.

**Web portal backend on Render**

1. Open [Render Dashboard](https://dashboard.render.com/) and select your **backend** service (e.g. `oxford-mileage-backend`).
2. Go to **Environment** (left sidebar).
3. Click **Add Environment Variable**.
4. **Key**: `GOOGLE_MAPS_API_KEY`
5. **Value**: paste the same API key you use for the app (from Google Cloud Console > Credentials).
6. Save. Render will redeploy so the new variable is picked up.

After this, static maps in PDF export and the **Calculate miles** button on the web portal will use the key. The key is only used on the backend (Render); it is never sent to the browser.

**Mobile app (Expo / EAS)**

The mobile app reads the Google Maps key from `expo.extra.googleMapsApiKey` at build time. The repo uses `app.config.js` to inject the key from the environment so it is never committed:

- **EAS Build**: In Expo Dashboard → your project → **Secrets**, add `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` with your API key. Each EAS build will use this.
- **Local dev**: Set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in your environment before running (e.g. in `.env` if you load it, or in your shell). Do not put the real key in `app.json` and commit it; the repo keeps the placeholder `YOUR_GOOGLE_MAPS_API_KEY_HERE` there.

## Usage

### Enabling Maps for Cost Centers

1. Navigate to **Admin Portal** > **Cost Center Management**
2. Edit a cost center
3. Check "Enable Google Maps in Reports"
4. Save the cost center

### Viewing Maps in Reports

1. Finance team members can export expense reports as PDF
2. If a report contains cost centers with maps enabled, a dialog will appear asking for map view mode:
   - **By Day**: One map per day showing all routes for that day
   - **By Cost Center**: One map per cost center showing all routes across all days
   - **No Maps**: Export without maps

## API Usage and Billing

- Google Maps Static API has a free tier: $200 credit per month
- After free tier: $2.00 per 1,000 requests
- Each map image counts as one request
- Typical usage: 1-5 maps per report depending on number of days/cost centers

## Troubleshooting

### Maps Not Appearing (PDF reports)

PDF maps use **Maps Static API**, which is different from the APIs used by the "Calculate miles" button (Geocoding + Distance Matrix). You must enable it separately:

1. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Library**, search for **"Maps Static API"** and click **Enable**.
2. If your API key is restricted, add "Maps Static API" to the allowed APIs for that key.
3. Check that `GOOGLE_MAPS_API_KEY` is set in environment variables (e.g. on Render).
4. Verify billing is enabled on the Google Cloud project (Static Maps requires billing).
5. Check backend logs for the exact error (e.g. `X-Staticmap-API-Warning` or geocoding errors).

### "Maps Static API is enabled" but PDF maps still show "Map unavailable"

If the API is enabled and the key is set, the usual cause is one of the following:

1. **Billing not enabled**
   - Maps Static API requires **billing to be enabled** on the Google Cloud project, even for the free tier ($200/month credit).
   - In [Google Cloud Console](https://console.cloud.google.com/) → **Billing** → confirm the project is linked to a billing account. See [g.co/staticmaperror](https://g.co/staticmaperror) for Google’s checklist.

2. **API key application restriction blocking the backend**
   - The PDF is generated on the **backend** (e.g. Render). The request has **no HTTP referrer** (it’s server-to-Google).
   - If the key is restricted to **HTTP referrers (websites)** only, Google will reject server requests and return the small error image.
   - **Fix:** In **APIs & Services** → **Credentials** → your key → **Application restrictions**, use **None** (for development) or **IP addresses** and add your server’s IPs (e.g. Render’s outbound IPs if you use them). Do not use “HTTP referrers” only for a key that the backend uses.

3. **API key API restrictions**
   - Under **API restrictions**, the key must allow **Maps Static API**. If you only added “Geocoding API” and “Distance Matrix API” (for the Calculate button), add **Maps Static API** to the same key (or use a separate key for the backend that includes Maps Static API).

4. **Key not set where the PDF runs**
   - The report PDF is built by the **backend** service. Ensure `GOOGLE_MAPS_API_KEY` is set in that service’s environment (e.g. Render → your **backend** service → **Environment**), not only in the frontend or in a different service.

5. **Backend logs**
   - On the next failed PDF export, check the backend logs. The code now logs the exact failure (e.g. “Google returned 100x100 error tile” and suggests billing/restrictions). The PDF may also show a short “Details: …” line with the error message.

### API Errors

- **403 Forbidden**: API key may be invalid or restricted
- **400 Bad Request**: Check that addresses are valid
- **429 Too Many Requests**: API quota exceeded, check billing

## Security Notes

- API keys should be restricted to specific APIs and domains
- Never expose API keys in client-side code
- Rotate API keys periodically
- Monitor API usage in Google Cloud Console

