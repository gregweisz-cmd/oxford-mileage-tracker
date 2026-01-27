# Power BI Dashboard Guide for Oxford Mileage Tracker

Now that you have your data connected and relationships built, here's a guide to creating useful dashboards and visualizations.

## 📊 Key Metrics to Track

Based on your expense tracking system, here are the important metrics:

### Financial Metrics
- **Mileage Reimbursement**: Miles × $0.445 per mile
- **Total Receipts**: Sum of all receipt amounts
- **Total Expenses**: Mileage + Receipts
- **Average Expense per Day**: Total expenses / number of days with activity
- **Expense by Cost Center**: Breakdown of expenses by cost center

### Operational Metrics
- **Total Miles Driven**: Sum of all mileage entries
- **Average Miles per Day**: Total miles / number of days with mileage
- **Total Hours Worked**: Sum of all time tracking hours
- **Hours by Type**: Working Hours, G&A Hours, Holiday Hours, PTO Hours, etc.
- **Days with Activity**: Count of days with mileage, receipts, or hours

### Employee Metrics
- **Expenses by Employee**: Total expenses per employee
- **Miles by Employee**: Total miles per employee
- **Hours by Employee**: Total hours per employee
- **Activity Frequency**: Number of days with entries per employee

---

## 🎨 Recommended Dashboards

### 1. Executive Summary Dashboard

**Purpose**: High-level overview for management

**Visualizations**:
1. **Total Expenses (This Month)** - Card visual
   - Measure: `Total Expenses = SUM(mileageEntries[miles]) * 0.445 + SUM(receipts[amount])`
   
2. **Total Miles (This Month)** - Card visual
   - Measure: `Total Miles = SUM(mileageEntries[miles])`
   
3. **Total Hours (This Month)** - Card visual
   - Measure: `Total Hours = SUM(timeTracking[hours])`
   
4. **Expenses by Cost Center** - Pie or Donut chart
   - X-axis: `costCenter`
   - Y-axis: `Total Expenses`
   
5. **Expenses Trend (Last 6 Months)** - Line chart
   - X-axis: `date` (grouped by month)
   - Y-axis: `Total Expenses`
   
6. **Top 5 Employees by Expenses** - Bar chart
   - X-axis: `employeeName`
   - Y-axis: `Total Expenses`
   - Sort: Descending, Top 5

---

### 2. Mileage Analysis Dashboard

**Purpose**: Detailed mileage tracking and patterns

**Visualizations**:
1. **Total Miles This Month** - Card
   - Measure: `Total Miles = SUM(mileageEntries[miles])`

2. **Miles by Day** - Line chart
   - X-axis: `date` (from mileageEntries)
   - Y-axis: `SUM(mileageEntries[miles])`

3. **Miles by Cost Center** - Stacked bar chart
   - X-axis: `costCenter`
   - Y-axis: `SUM(mileageEntries[miles])`
   - Legend: `employeeName` (optional)

4. **Average Miles per Trip** - Card
   - Measure: `Average Miles = AVERAGE(mileageEntries[miles])`

5. **GPS vs Manual Entries** - Pie chart
   - Legend: `isGpsTracked` (True/False)
   - Values: `COUNT(mileageEntries[id])`

6. **Top Routes** - Table
   - Columns: `startLocationName`, `endLocationName`, `COUNT(mileageEntries[id])`, `SUM(mileageEntries[miles])`
   - Sort by: Count or Miles (descending)

---

### 3. Hours & Time Tracking Dashboard

**Purpose**: Track employee hours and time allocation

**Visualizations**:
1. **Total Hours This Month** - Card
   - Measure: `Total Hours = SUM(timeTracking[hours])`

2. **Hours by Type** - Stacked bar chart
   - X-axis: `date` (grouped by week)
   - Y-axis: `SUM(timeTracking[hours])`
   - Legend: `type` (Working Hours, G&A Hours, Holiday Hours, etc.)

3. **Hours by Employee** - Bar chart
   - X-axis: `employeeName`
   - Y-axis: `SUM(timeTracking[hours])`

4. **Hours by Cost Center** - Pie chart
   - Legend: `costCenter`
   - Values: `SUM(timeTracking[hours])`

5. **Average Hours per Day** - Card
   - Measure: `Average Hours = AVERAGE(timeTracking[hours])`

6. **Days with Hours Logged** - Card
   - Measure: `Days with Hours = DISTINCTCOUNT(timeTracking[date])`

---

### 4. Expense Details Dashboard

**Purpose**: Detailed expense breakdown and analysis

**Visualizations**:
1. **Total Expenses This Month** - Card
   - Measure: `Total Expenses = (SUM(mileageEntries[miles]) * 0.445) + SUM(receipts[amount])`

2. **Mileage vs Receipts** - Clustered column chart
   - X-axis: `date` (grouped by week)
   - Y-axis: `Mileage Amount` and `Receipt Amount`
   - Two measures:
     - `Mileage Amount = SUM(mileageEntries[miles]) * 0.445`
     - `Receipt Amount = SUM(receipts[amount])`

3. **Expenses by Category** - Pie chart
   - Use receipt categories if available, or group by receipt type

4. **Expense Trend** - Line chart
   - X-axis: `date` (grouped by month)
   - Y-axis: `Total Expenses`

5. **Top Expense Days** - Table
   - Columns: `date`, `Mileage Amount`, `Receipt Amount`, `Total Expenses`
   - Sort by: Total Expenses (descending)

6. **Expenses by Cost Center** - Treemap
   - Size: `Total Expenses`
   - Category: `costCenter`

---

### 5. Employee Activity Dashboard

**Purpose**: Track individual employee activity and patterns

**Visualizations**:
1. **Employee Selector** - Slicer
   - Field: `employeeName` (from employees table)

2. **Employee Total Expenses** - Card
   - Measure: `Employee Expenses = CALCULATE(Total Expenses, FILTER(...))`
   - Filtered by selected employee

3. **Employee Miles** - Card
   - Measure: `Employee Miles = CALCULATE(Total Miles, FILTER(...))`

4. **Employee Hours** - Card
   - Measure: `Employee Hours = CALCULATE(Total Hours, FILTER(...))`

5. **Activity Calendar** - Matrix
   - Rows: `date` (grouped by day)
   - Columns: Activity type (Mileage, Receipts, Hours)
   - Values: Count or Sum

6. **Monthly Comparison** - Clustered column chart
   - X-axis: `date` (grouped by month)
   - Y-axis: `Total Expenses`, `Total Miles`, `Total Hours`
   - Filtered by selected employee

---

## 🔧 Creating Measures (DAX Formulas)

Here are some key measures you'll want to create:

### 1. Total Miles
```dax
Total Miles = SUM(mileageEntries[miles])
```

### 2. Mileage Amount (at $0.445 per mile)
```dax
Mileage Amount = SUM(mileageEntries[miles]) * 0.445
```

### 3. Total Receipts
```dax
Total Receipts = SUM(receipts[amount])
```

### 4. Total Expenses
```dax
Total Expenses = [Mileage Amount] + [Total Receipts]
```

### 5. Total Hours
```dax
Total Hours = SUM(timeTracking[hours])
```

### 6. Average Miles per Day
```dax
Average Miles per Day = 
DIVIDE(
    [Total Miles],
    DISTINCTCOUNT(mileageEntries[date]),
    0
)
```

### 7. Days with Activity
```dax
Days with Activity = 
DISTINCTCOUNT(
    UNION(
        VALUES(mileageEntries[date]),
        VALUES(receipts[date]),
        VALUES(timeTracking[date])
    )
)
```

### 8. Expenses This Month
```dax
Expenses This Month = 
CALCULATE(
    [Total Expenses],
    FILTER(
        ALL(mileageEntries[date], receipts[date]),
        MONTH(mileageEntries[date]) = MONTH(TODAY()) &&
        YEAR(mileageEntries[date]) = YEAR(TODAY())
    )
)
```

---

## 📅 Date Filtering Best Practices

### Create a Date Table
For better date filtering, create a separate Date table:

1. **New Table** → Enter Data
2. Create a date range (e.g., 2024-01-01 to 2025-12-31)
3. Add columns: Year, Month, MonthName, Week, DayOfWeek, etc.
4. Create relationship: Date table `Date` column → mileageEntries `date` column

### Use Date Slicers
- Add a **Date Slicer** to your dashboards
- Connect it to your Date table
- This will filter all related tables automatically

---

## 🎯 Quick Start: Your First Dashboard

1. **Create a new page** in Power BI Desktop

2. **Add these visuals**:
   - **Card**: Total Expenses (use the measure above)
   - **Card**: Total Miles
   - **Card**: Total Hours
   - **Line Chart**: Expenses by Month (X: date, Y: Total Expenses)
   - **Pie Chart**: Expenses by Cost Center

3. **Add a Date Slicer**:
   - Connect to your date field
   - Set to "Between" mode for date range selection

4. **Format your visuals**:
   - Choose a color scheme
   - Add titles
   - Adjust font sizes

5. **Test interactivity**:
   - Click on chart elements to see cross-filtering
   - Use the date slicer to filter data

---

## 💡 Pro Tips

1. **Use Tooltips**: Create tooltip pages with detailed breakdowns that appear on hover

2. **Bookmarks**: Save specific filter states as bookmarks for quick navigation

3. **Drill-through**: Set up drill-through pages for detailed views (e.g., click an employee to see their detailed activity)

4. **Conditional Formatting**: Use color coding to highlight high/low values

5. **KPIs**: Use KPI visuals for targets vs actuals (if you have budget data)

6. **Refresh Schedule**: Set up automatic refresh in Power BI Service (daily/weekly)

---

## 🔄 Refreshing Data

### Manual Refresh
- In Power BI Desktop: **Home** → **Refresh**

### Automatic Refresh (Power BI Service)
1. Publish your report to Power BI Service
2. Go to **Dataset Settings**
3. Configure **Scheduled Refresh**
4. Set frequency (daily, weekly, etc.)

**Note**: Your backend endpoint supports query parameters for filtering:
- `?startDate=2024-01-01&endDate=2024-01-31` - Filter by date range
- `?employeeId=greg-weisz-001` - Filter by employee

---

## 📊 Sample Report Structure

```
📁 Executive Dashboard
  ├─ Summary Cards (Expenses, Miles, Hours)
  ├─ Expense Trend Chart
  ├─ Cost Center Breakdown
  └─ Top Employees Table

📁 Mileage Analysis
  ├─ Miles by Day Chart
  ├─ Miles by Cost Center
  ├─ GPS vs Manual Comparison
  └─ Top Routes Table

📁 Hours Tracking
  ├─ Hours by Type Chart
  ├─ Hours by Employee
  ├─ Hours by Cost Center
  └─ Daily Hours Breakdown

📁 Expense Details
  ├─ Mileage vs Receipts
  ├─ Expense Categories
  ├─ Expense Trend
  └─ Top Expense Days

📁 Employee Activity
  ├─ Employee Selector
  ├─ Employee Summary Cards
  ├─ Activity Calendar
  └─ Monthly Comparison
```

---

## 🚀 Next Steps

1. **Start with the Executive Summary Dashboard** - Get the high-level view working first

2. **Add Date Filtering** - Make sure you can filter by month/quarter/year

3. **Create Employee Drill-through** - Click an employee to see their detailed activity

4. **Add Cost Center Analysis** - Break down expenses by cost center

5. **Set Up Refresh Schedule** - Automate data updates

6. **Publish to Power BI Service** - Share with your team

---

## ❓ Common Questions

**Q: How do I filter by a specific month?**
A: Add a Date Slicer and set it to filter by month, or create a measure that filters by the current month.

**Q: How do I show only active employees?**
A: Add a filter to your visuals: `employees[isActive] = TRUE` (if you have this field)

**Q: How do I calculate year-over-year growth?**
A: Create a measure using `SAMEPERIODLASTYEAR()` function in DAX.

**Q: Can I export data to Excel?**
A: Yes! Right-click any visual → **Export data** → Choose Excel format.

---

**Need help with specific visualizations?** Let me know what you'd like to build next!
