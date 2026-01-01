# Dashboard & Reporting API Testing Guide

**Date**: December 31, 2025  
**Time**: ~20 minutes  
**Status**: Complete

---

## Test Accounts

- **Greg Weisz** (Admin): `greg.weisz@oxfordhouse.org`
- **Alex Szary** (Employee): `alex.szary@oxfordhouse.org`
- **AJ Dunaway** (Supervisor): `aj.dunaway@oxfordhouse.org`

---

## Test 1: Dashboard Statistics API

**Endpoint**: `GET /api/dashboard-statistics`

**Purpose**: Returns customizable dashboard statistics for staff/supervisor portals

### Test 1.1: Basic Request (Employee Role)

1. **Login to web portal** as Alex Szary (Employee)
2. **Open browser console** (F12 → Console tab)
3. **Get auth token and user info**:
   ```javascript
   const token = localStorage.getItem('authToken');
   const employeeData = JSON.parse(localStorage.getItem('employeeData'));
   console.log('Token:', token);
   console.log('Employee ID:', employeeData.id);
   console.log('Role:', employeeData.role);
   ```

4. **Test endpoint with basic statistics**:
   ```javascript
   fetch('http://localhost:3002/api/dashboard-statistics?statistics=total-expenses,current-month-total', {
     method: 'GET',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json',
       'x-user-role': employeeData.role || 'employee',
       'x-user-id': employeeData.id
     }
   })
  .then(r => r.json())
  .then(data => {
    console.log('✅ Dashboard Statistics Response:', data);
    // Verify response structure (API returns { statistics: [...] })
    const stats = data.statistics || [];
    console.log('Statistics returned:', stats.length);
    stats.forEach(stat => {
      console.log(`  - ${stat.id}: ${stat.value} ${stat.unit || ''}`);
    });
  })
   .catch(err => console.error('❌ Error:', err));
   ```

**Expected Results**:
- ✅ Returns array of statistics
- ✅ Each statistic has: `id`, `title`, `value`, `unit`
- ✅ Values are numbers (not null/undefined)
- ✅ Only shows data for logged-in employee (role-based filtering)

### Test 1.2: Date Range Filter

```javascript
const startDate = '2025-12-01';
const endDate = '2025-12-31';
fetch(`http://localhost:3002/api/dashboard-statistics?statistics=total-expenses&startDate=${startDate}&endDate=${endDate}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-user-role': employeeData.role || 'employee',
    'x-user-id': employeeData.id
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Date-filtered Statistics:', data);
})
.catch(err => console.error('❌ Error:', err));
```

**Expected Results**:
- ✅ Statistics are filtered to specified date range
- ✅ Values match data within date range only

### Test 1.3: Supervisor Role (Team Data)

1. **Login as AJ Dunaway** (Supervisor)
2. **Run same test as 1.1**
3. **Verify**:
   - ✅ Statistics include data from team members
   - ✅ Supervisor can see aggregated team data

---

## Test 2: Admin Reporting Overview API

**Endpoint**: `GET /api/admin/reporting/overview`

**Purpose**: Returns comprehensive admin dashboard overview with summary cards, attention items, etc.

**Note**: This endpoint is typically admin-only, but test with available roles.

### Test 2.1: Basic Overview Request

1. **Login as Greg Weisz** (Admin)
2. **Open browser console**
3. **Test endpoint**:
   ```javascript
   const token = localStorage.getItem('authToken');
   const employeeData = JSON.parse(localStorage.getItem('employeeData'));
   
   fetch('http://localhost:3002/api/admin/reporting/overview', {
     method: 'GET',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     }
   })
   .then(r => r.json())
   .then(data => {
     console.log('✅ Admin Overview Response:', data);
     
     // Verify response structure
     console.log('📊 Summary Cards:', data.summaryCards?.length || 0);
     data.summaryCards?.forEach(card => {
       console.log(`  - ${card.label}: ${card.value} ${card.unit || ''}`);
     });
     
     console.log('⚠️  Attention Total:', data.attention?.total || 0);
     console.log('📈 Top Cost Centers:', data.topCostCenters?.length || 0);
     console.log('📅 Date Range:', data.range?.start, 'to', data.range?.end);
   })
   .catch(err => console.error('❌ Error:', err));
   ```

**Expected Results**:
- ✅ Returns JSON with structure:
  - `range`: { start, end }
  - `filters`: { costCenters }
  - `summaryCards`: Array of summary statistics
  - `submissionFunnel`: Submission workflow data
  - `topCostCenters`: Top cost centers data
  - `attention`: Attention items (overdue, missing receipts, over budget)
  - `generatedAt`: ISO timestamp
  - `metadata`: Available cost centers, baseline range

### Test 2.2: Date Range Filter

```javascript
const startDate = '2025-12-01';
const endDate = '2025-12-31';
fetch(`http://localhost:3002/api/admin/reporting/overview?startDate=${startDate}&endDate=${endDate}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Date-filtered Overview:', data);
  console.log('Date Range:', data.range);
  // Verify dates match request
  if (data.range.start === startDate && data.range.end === endDate) {
    console.log('✅ Date range matches request');
  }
})
.catch(err => console.error('❌ Error:', err));
```

**Expected Results**:
- ✅ Response includes correct date range
- ✅ All statistics reflect data within date range

### Test 2.3: Cost Center Filter

```javascript
const costCenters = ['NC.F-SAPTBG', 'CORPORATE'];
fetch(`http://localhost:3002/api/admin/reporting/overview?costCenters=${costCenters.join(',')}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Cost Center-filtered Overview:', data);
  console.log('Applied Filters:', data.filters);
  // Verify filters match request
  if (JSON.stringify(data.filters.costCenters.sort()) === JSON.stringify(costCenters.sort())) {
    console.log('✅ Cost center filters match request');
  }
})
.catch(err => console.error('❌ Error:', err));
```

**Expected Results**:
- ✅ Response includes cost center filters
- ✅ Data is filtered to specified cost centers only

---

## Test 3: Report Builder Query API

**Endpoint**: `POST /api/admin/reporting/report-builder/query`

**Purpose**: Executes custom report builder queries with filters

### Test 3.1: Basic Query

1. **Login as Admin**
2. **Test endpoint**:
   ```javascript
   const token = localStorage.getItem('authToken');
   
   fetch('http://localhost:3002/api/admin/reporting/report-builder/query', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       selectedColumns: ['employeeName', 'date', 'amount'],
       filters: {
         startDate: '2025-12-01',
         endDate: '2025-12-31'
       },
       limit: 100
     })
   })
   .then(r => r.json())
   .then(data => {
     console.log('✅ Report Builder Query Response:', data);
     console.log('Rows returned:', data.rows?.length || 0);
     console.log('Columns:', data.columns || []);
   })
   .catch(err => console.error('❌ Error:', err));
   ```

**Expected Results**:
- ✅ Returns JSON with:
  - `rows`: Array of data rows
  - `columns`: Array of column definitions
  - `total`: Total row count (if available)
- ✅ Filters are applied correctly
- ✅ Limit is respected

### Test 3.2: Complex Filters

```javascript
fetch('http://localhost:3002/api/admin/reporting/report-builder/query', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    selectedColumns: ['employeeName', 'costCenter', 'date', 'amount'],
    filters: {
      startDate: '2025-12-01',
      endDate: '2025-12-31',
      costCenters: ['NC.F-SAPTBG', 'CORPORATE'],
      employeeIds: [/* add employee IDs if needed */]
    },
    limit: 50
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Complex Query Response:', data);
  // Verify filters worked
  const uniqueCostCenters = new Set(data.rows.map(r => r.costCenter));
  console.log('Cost Centers in results:', Array.from(uniqueCostCenters));
})
.catch(err => console.error('❌ Error:', err));
```

**Expected Results**:
- ✅ Multiple filters work together
- ✅ Results match all filter criteria
- ✅ Cost center filter is applied correctly

---

## Test 4: Frontend Dashboard Loading

**Purpose**: Verify dashboard loads correctly in UI

### Test 4.1: Staff Portal Dashboard

1. **Login as Alex Szary** (Employee)
2. **Navigate to Staff Portal**
3. **Verify**:
   - ✅ Dashboard loads without errors
   - ✅ Statistics cards display correctly
   - ✅ Data matches backend API response
   - ✅ Loading states work properly

### Test 4.2: Admin Portal Dashboard

1. **Login as Greg Weisz** (Admin)
2. **Navigate to Admin Portal**
3. **Verify**:
   - ✅ Overview dashboard loads
   - ✅ Summary cards show correct totals
   - ✅ Attention items display correctly
   - ✅ Cost center filters work in UI
   - ✅ Date range picker updates data correctly

### Test 4.3: Role-Based Data

1. **Login as different roles** (Employee, Supervisor, Admin)
2. **Compare dashboard data**:
   - ✅ Employee sees only own data
   - ✅ Supervisor sees team data
   - ✅ Admin sees all data

---

## Test Results Checklist

- [ ] Dashboard Statistics API returns correct data
- [ ] Date range filters work correctly
- [ ] Role-based filtering works (employee/supervisor)
- [ ] Admin Overview API returns complete data
- [ ] Cost center filters work correctly
- [ ] Report Builder query executes successfully
- [ ] Frontend dashboard loads without errors
- [ ] Dashboard totals are accurate
- [ ] Filters work in frontend UI

---

## Notes

- All endpoints should return 200 OK with valid JSON
- Error responses should be 4xx/5xx with error message
- Date formats: ISO format (YYYY-MM-DD)
- Cost centers: Array or comma-separated string
- Authentication: Bearer token in Authorization header

