# Google Maps Static API Setup

This document describes how to configure Google Maps Static API for route visualization in expense reports.

## Overview

The Google Maps feature allows finance team members to view route maps in PDF expense reports. Maps show all addresses an employee visited during their work day, organized either by day or by cost center.

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
   - **API restrictions**: Restrict key → choose "Maps Static API" (for PDF maps). If you use **Calculate miles** on the web portal, also allow "Geocoding API" and "Distance Matrix API"

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

### Maps Not Appearing

1. Check that `GOOGLE_MAPS_API_KEY` is set in environment variables
2. Verify the API key is valid and not restricted incorrectly
3. Check that Maps Static API is enabled in Google Cloud Console
4. Verify billing is enabled on the Google Cloud project
5. Check backend logs for error messages

### API Errors

- **403 Forbidden**: API key may be invalid or restricted
- **400 Bad Request**: Check that addresses are valid
- **429 Too Many Requests**: API quota exceeded, check billing

## Security Notes

- API keys should be restricted to specific APIs and domains
- Never expose API keys in client-side code
- Rotate API keys periodically
- Monitor API usage in Google Cloud Console

