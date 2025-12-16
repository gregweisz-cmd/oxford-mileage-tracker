# Biweekly Approval - Corrected Definition

## ✅ **Correct Understanding**

**Biweekly** = Twice per month (not every 2 weeks)

### **Approval Frequencies:**

#### **Weekly**
- Reviews every week
- 52 submissions per year
- Example: Week of Oct 7-13, Week of Oct 14-20, etc.

#### **Biweekly** (CORRECTED)
- Reviews **twice per month**
- 24 submissions per year (2 per month × 12 months)
- **Period 1**: Days 1-15 of the month
- **Period 2**: Days 16-end of month
- Example for October:
  - Period 1: Oct 1-15
  - Period 2: Oct 16-31

#### **Monthly**
- Reviews once per month
- 12 submissions per year
- Example: October 2024

---

## 🔧 **Implementation Changes Needed**

### **Database Schema**
Instead of `weekly_reports` table, we need a more flexible structure:

```sql
-- Rename to report_periods or keep as monthly_reports and add period fields
ALTER TABLE monthly_reports ADD COLUMN periodType TEXT DEFAULT 'monthly';
-- Values: 'weekly', 'biweekly-first', 'biweekly-second', 'monthly'

ALTER TABLE monthly_reports ADD COLUMN periodNumber INTEGER;
-- For biweekly: 1 or 2
-- For weekly: 1-53
-- For monthly: 1-12
```

OR keep separate tables but change logic:

```sql
-- biweekly_reports table
CREATE TABLE biweekly_reports (
  id TEXT PRIMARY KEY,
  employeeId TEXT NOT NULL,
  month INTEGER NOT NULL,          -- 1-12
  year INTEGER NOT NULL,
  periodNumber INTEGER NOT NULL,   -- 1 or 2 (first half or second half)
  startDate TEXT NOT NULL,         -- Day 1 or Day 16
  endDate TEXT NOT NULL,           -- Day 15 or last day of month
  totalMiles REAL NOT NULL,
  totalExpenses REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  -- ... same approval fields as monthly
);
```

---

## 📅 **Period Calculations**

### **Biweekly Period 1 (First Half)**
```typescript
function getFirstHalfPeriod(month: number, year: number) {
  return {
    periodNumber: 1,
    month,
    year,
    startDate: new Date(year, month - 1, 1),    // 1st of month
    endDate: new Date(year, month - 1, 15),     // 15th of month
    label: 'First Half'
  };
}
```

### **Biweekly Period 2 (Second Half)**
```typescript
function getSecondHalfPeriod(month: number, year: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    periodNumber: 2,
    month,
    year,
    startDate: new Date(year, month - 1, 16),   // 16th of month
    endDate: new Date(year, month - 1, lastDay), // Last day of month
    label: 'Second Half'
  };
}
```

### **Current Period Detection**
```typescript
function getCurrentBiweeklyPeriod() {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  if (day <= 15) {
    return getFirstHalfPeriod(month, year);
  } else {
    return getSecondHalfPeriod(month, year);
  }
}
```

---

## 🎯 **Use Cases**

### **Biweekly Supervisor Example**

**October 2024:**
- **Oct 1-15**: Employee tracks expenses
- **Oct 15**: Employee submits "First Half - October" report
- **Oct 16**: Supervisor reviews and approves
- **Oct 16-31**: Employee tracks more expenses
- **Oct 31**: Employee submits "Second Half - October" report
- **Nov 1**: Supervisor reviews and approves

**Result**: Supervisor reviews twice per month at predictable points

---

## 💡 **Benefits of This Approach**

### **Why Month-Based Biweekly is Better:**
1. ✅ Predictable dates (always mid-month and end-of-month)
2. ✅ Aligns with monthly billing cycles
3. ✅ Easier to remember (15th and last day)
4. ✅ Works with calendar months
5. ✅ Simpler for accounting
6. ✅ No complex week calculations

### **Comparison:**

| Frequency | Submissions/Year | Review Points | Calculation |
|-----------|------------------|---------------|-------------|
| Weekly | 52 | Every Monday | ISO weeks |
| **Biweekly** | **24** | **Mid-month & End-of-month** | **1-15, 16-end** |
| Monthly | 12 | End of month | Calendar months |

---

## 🚀 **Recommended Implementation**

### **Option 1: Separate Table (Cleaner)**
```sql
CREATE TABLE biweekly_reports (
  id TEXT PRIMARY KEY,
  employeeId TEXT NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  periodNumber INTEGER NOT NULL,  -- 1 or 2
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  totalMiles REAL NOT NULL,
  totalExpenses REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  -- ... approval workflow fields
);
```

### **Option 2: Unified Table (More Flexible)**
```sql
CREATE TABLE report_periods (
  id TEXT PRIMARY KEY,
  employeeId TEXT NOT NULL,
  periodType TEXT NOT NULL,        -- 'weekly', 'biweekly', 'monthly'
  year INTEGER NOT NULL,
  month INTEGER,                   -- For biweekly/monthly
  periodNumber INTEGER,            -- For biweekly: 1 or 2, Weekly: 1-53
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  totalMiles REAL NOT NULL,
  totalExpenses REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  -- ... approval workflow fields
);
```

**I recommend Option 1** for clarity, but Option 2 is more scalable if you want to add other frequencies later (quarterly, etc.).

---

## 📝 **Next Steps**

1. Create biweekly_reports table
2. Update week calculation logic to month-based
3. UI shows "First Half of October" or "Second Half of October"
4. Submit button detects which period user is in
5. Supervisor dashboard groups by month and period

---

**Would you like me to update the implementation to use month-based biweekly periods instead of week-based?**

