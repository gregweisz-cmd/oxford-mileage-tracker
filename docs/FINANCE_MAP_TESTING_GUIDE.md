# Finance Map Creation – Testing Guide

This guide walks you through testing the **route maps in PDF expense reports** so finance can view maps when they need them.

---

## What the feature does

- **Finance** exports an expense report as **PDF**.
- If the report uses cost centers that have **Google Maps enabled**, a dialog asks: **By Day**, **By Cost Center**, or **No Maps**.
- The PDF can include **static map images** showing addresses from mileage entries (by day or by cost center).

---

## Before you test

### 1. Google Maps API (backend)

- **Backend** must have **Maps Static API** and an API key configured.
- On **Render**: Environment → add **`GOOGLE_MAPS_API_KEY`** = your key.
- In **Google Cloud Console**: enable **Maps Static API**, enable billing, create/restrict the key.  
  Full steps: [admin-web/backend/GOOGLE_MAPS_SETUP.md](../admin-web/backend/GOOGLE_MAPS_SETUP.md)

If the key is missing or invalid, PDF export still works but **no map images** are added (backend logs will say “Google Maps API key not configured” or similar).

### 2. Enable maps for a cost center

1. Log in as **Admin** (or a user with Cost Center Management).
2. Open **Admin Portal** → **Cost Center Management** (or the tab where cost centers are edited).
3. **Edit** a cost center that appears on expense reports you’ll test (e.g. Program Services, Finance).
4. Check **“Enable Google Maps in Reports”**.
5. Save.

Only reports that **use at least one cost center with this checked** will show the map-option dialog when finance exports PDF.

### 3. Test data

- Use a **report that has mileage entries** with **start/end addresses** (or location names the backend can geocode).
- The report’s cost center(s) must include the one you enabled in step 2.

---

## How to test (Finance user)

1. **Log in** as a **finance** user (e.g. Greg Weisz with finance role, or another finance account).
2. Open the **Finance Portal** (Finance tab in the web portal).
3. Find a **submitted/pending report** that:
   - Has **mileage entries** with addresses, and  
   - Uses a cost center for which you **enabled Google Maps** (step 2 above).
4. In the report row, click the **download/Export PDF** icon (tooltip: “Export to PDF”).
5. **If maps are enabled for that report**, a dialog **“Select Map View Mode”** appears:
   - **By Day** – one map per day with that day’s routes.
   - **By Cost Center** – one map per cost center with all addresses for that cost center.
   - **No Maps** – PDF with no map images.
6. Choose a mode (e.g. **By Day**) and confirm/Export.
7. **Check the PDF**:
   - It should download (e.g. `LASTNAME, FIRSTNAME EXPENSES MMM-YY.pdf`).
   - Open it and scroll: you should see **map image(s)** after the main report content (one per day or per cost center, depending on mode).

---

## If the map dialog doesn’t appear

- **No “Select Map View Mode”** → Export runs without asking; PDF has no maps.  
  Check:
  1. The report’s cost center(s) include one that has **“Enable Google Maps in Reports”** checked in Cost Center Management.
  2. You’re logged in as a **finance** user (map option is only for finance).
  3. Browser console (F12) for any errors; backend logs for “Maps skipped” or “hasMapsEnabled” if you have debug logging.

---

## If the PDF has no map images

- **Dialog appeared** and you chose By Day or By Cost Center, but the PDF has **no map pages**:
  1. **Backend**: Confirm **`GOOGLE_MAPS_API_KEY`** is set on Render and that Maps Static API is enabled and billing is on (see [GOOGLE_MAPS_SETUP.md](../admin-web/backend/GOOGLE_MAPS_SETUP.md)).
  2. **Data**: Report must have **mileage entries with addresses** (start/end). If addresses are missing or invalid, the backend may skip map generation; check backend logs for map-related errors.
  3. **Backend logs**: Look for “Generating Google Maps”, “Maps skipped”, or API errors (403, 400, 429).

---

## Quick checklist

- [ ] `GOOGLE_MAPS_API_KEY` set on Render (and Maps Static API enabled in GCP).
- [ ] At least one cost center used on the test report has **“Enable Google Maps in Reports”** checked.
- [ ] Logged in as a **finance** user.
- [ ] Test report has **mileage entries with addresses**.
- [ ] Click **Export PDF** on that report → **“Select Map View Mode”** dialog appears.
- [ ] Choose **By Day** or **By Cost Center** → PDF downloads and contains **map image(s)**.

Once this works, finance can use the same flow whenever they need maps on exported reports.
