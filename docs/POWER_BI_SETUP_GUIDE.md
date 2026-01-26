# Power BI Connection Guide for Oxford Mileage Tracker

## Overview

The backend is hosted on Render.com and uses SQLite. Power BI can connect to the data via REST API endpoints. This guide covers two approaches:

1. **REST API Connection** (Recommended) - Connect directly to API endpoints
2. **Database Export** - Export data and import into Power BI

---

## Option 1: REST API Connection (Recommended)

Power BI can connect directly to REST API endpoints. This provides real-time data access.

### Prerequisites
- Power BI Desktop (free download from Microsoft)
- Backend API URL: `https://oxford-mileage-backend.onrender.com/api`

### Available API Endpoints

#### 1. Mileage Entries
```
GET https://oxford-mileage-backend.onrender.com/api/mileage-entries
Query Parameters:
  - employeeId (optional): Filter by employee
  - month (optional): Filter by month (1-12)
  - year (optional): Filter by year
```

#### 2. Receipts
```
GET https://oxford-mileage-backend.onrender.com/api/receipts
Query Parameters:
  - employeeId (optional): Filter by employee
  - month (optional): Filter by month (1-12)
  - year (optional): Filter by year
```

#### 3. Time Tracking
```
GET https://oxford-mileage-backend.onrender.com/api/time-tracking
Query Parameters:
  - employeeId (optional): Filter by employee
  - month (optional): Filter by month (1-12)
  - year (optional): Filter by year
```

#### 4. Daily Descriptions
```
GET https://oxford-mileage-backend.onrender.com/api/daily-descriptions
Query Parameters:
  - employeeId (optional): Filter by employee
```

#### 5. Employees
```
GET https://oxford-mileage-backend.onrender.com/api/employees
```

### Step-by-Step: Connect Power BI to REST API

#### Step 1: Open Power BI Desktop
1. Launch Power BI Desktop
2. Click **Get Data** → **Web**

#### Step 2: Connect to Mileage Entries
1. Enter URL: `https://oxford-mileage-backend.onrender.com/api/mileage-entries`
2. Click **OK**
3. Power BI will fetch the data
4. Click **Transform Data** to see the data
5. Click **Close & Apply**

#### Step 3: Add Additional Data Sources
Repeat Step 2 for each endpoint:
- Receipts: `https://oxford-mileage-backend.onrender.com/api/receipts`
- Time Tracking: `https://oxford-mileage-backend.onrender.com/api/time-tracking`
- Daily Descriptions: `https://oxford-mileage-backend.onrender.com/api/daily-descriptions`
- Employees: `https://oxford-mileage-backend.onrender.com/api/employees`

#### Step 4: Create Relationships
1. In Power BI, go to **Model** view
2. Create relationships between tables:
   - `mileage_entries.employeeId` → `employees.id`
   - `receipts.employeeId` → `employees.id`
   - `time_tracking.employeeId` → `employees.id`
   - `daily_descriptions.employeeId` → `employees.id`

#### Step 5: Create Visualizations
Now you can create dashboards with:
- Total miles by employee
- Receipt totals by category
- Hours worked by employee
- Monthly trends
- Cost center breakdowns

---

## Option 2: Database Export (Alternative)

If you prefer working with the database directly, you can export it and convert to a format Power BI supports.

### Step 1: Export Database from Render

You'll need to SSH into Render or use a script to export the database. Since Render uses SQLite, you can:

1. **Use a database export script** (we can create one)
2. **Download via Render dashboard** (if available)
3. **Use a database browser tool**

### Step 2: Convert SQLite to CSV or Access Database

Power BI can import:
- CSV files
- Excel files
- Access databases (.accdb)
- SQL Server databases

#### Option A: Export to CSV
Use a SQLite tool to export each table to CSV, then import into Power BI.

#### Option B: Convert to Access Database
1. Install Microsoft Access
2. Import SQLite tables into Access
3. Connect Power BI to the Access database

---

## Option 3: Use Custom Power BI Export Endpoint (Recommended for Best Performance)

A dedicated endpoint has been created that returns all data in a single optimized request.

### Endpoint:
```
GET https://oxford-mileage-backend.onrender.com/api/power-bi/export
Query Parameters (all optional):
  - employeeId: Filter by specific employee
  - startDate: Filter from date (YYYY-MM-DD)
  - endDate: Filter to date (YYYY-MM-DD)
```

### Response Format:
```json
{
  "employees": [...],
  "mileageEntries": [...],
  "receipts": [...],
  "timeTracking": [...],
  "dailyDescriptions": [...],
  "exportDate": "2026-01-XX...",
  "recordCounts": {
    "employees": 50,
    "mileageEntries": 1000,
    "receipts": 500,
    "timeTracking": 2000,
    "dailyDescriptions": 300
  }
}
```

### Benefits:
- ✅ Single endpoint for all data
- ✅ Optimized queries with pre-joined relationships
- ✅ Better performance (one request instead of multiple)
- ✅ Includes employee names already joined
- ✅ Optional date/employee filtering

### Step-by-Step: Connect Power BI to Export Endpoint

1. **Open Power BI Desktop**
2. **Get Data** → **Web**
3. **Enter URL**: `https://oxford-mileage-backend.onrender.com/api/power-bi/export`
4. Click **OK**
5. Power BI will fetch the JSON response
6. Click **Transform Data**
7. Expand the tables you need:
   - Click the expand icon (↗) next to `mileageEntries`
   - Click the expand icon next to `receipts`
   - Click the expand icon next to `timeTracking`
   - Click the expand icon next to `dailyDescriptions`
   - Click the expand icon next to `employees`
8. Click **Close & Apply**

### Summary Statistics Endpoint

For dashboard summaries, use:
```
GET https://oxford-mileage-backend.onrender.com/api/power-bi/summary
Query Parameters (all optional):
  - employeeId: Filter by specific employee
  - startDate: Filter from date (YYYY-MM-DD)
  - endDate: Filter to date (YYYY-MM-DD)
```

Returns aggregated statistics and employee-level summaries.

---

## Recommended Approach

**For most users: Use Option 1 (REST API)**

**Advantages:**
- ✅ Real-time data
- ✅ No database access needed
- ✅ Easy to set up
- ✅ Automatic updates when you refresh

**Limitations:**
- ⚠️ May be slower for very large datasets
- ⚠️ Requires internet connection

---

## Power BI Refresh Schedule

Once connected, you can set up automatic refresh:

1. In Power BI Desktop: **File** → **Options and Settings** → **Data Source Settings**
2. Configure refresh schedule
3. Publish to Power BI Service for scheduled refreshes

---

## Sample Power BI Queries (M Language)

### Get All Mileage Entries
```m
let
    Source = Json.Document(Web.Contents("https://oxford-mileage-backend.onrender.com/api/mileage-entries")),
    #"Converted to Table" = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Expanded Column1" = Table.ExpandRecordColumn(#"Converted to Table", "Column1", {"id", "employeeId", "date", "miles", "startLocation", "endLocation"}, {"id", "employeeId", "date", "miles", "startLocation", "endLocation"})
in
    #"Expanded Column1"
```

### Get Mileage Entries for Specific Employee
```m
let
    employeeId = "greg-weisz-001",
    url = "https://oxford-mileage-backend.onrender.com/api/mileage-entries?employeeId=" & employeeId,
    Source = Json.Document(Web.Contents(url))
in
    Source
```

---

## Troubleshooting

### Issue: "Unable to connect"
- Check that the backend URL is correct
- Verify the backend is running on Render
- Check firewall settings

### Issue: "Authentication required"
- Some endpoints may require authentication
- We may need to add API key authentication for Power BI

### Issue: "Data refresh fails"
- Check internet connection
- Verify backend is accessible
- Check for rate limiting (may need to add delays)

---

## Next Steps

1. **Try Option 1 first** - Connect via REST API
2. **If you need better performance** - We can create a custom export endpoint
3. **If you need offline access** - Use Option 2 (database export)

Let me know which approach you'd like to use, and I can help you set it up!
