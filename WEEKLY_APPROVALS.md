# Weekly Approvals Feature - Implementation Plan

## 🎯 **Feature Overview**

Allow supervisors to choose their preferred approval frequency for reviewing expense reports from their team members.

### **Approval Frequency Options:**
- **Weekly** - Review reports every week
- **Biweekly** - Review reports every 2 weeks  
- **Monthly** - Review reports once per month (default)

---

## ✅ **Completed**

### **Database Schema**
1. ✅ Added `weekly_reports` table (mobile + backend)
   - Week number tracking
   - Start/end date range
   - Same approval workflow as monthly reports
   
2. ✅ Added `approvalFrequency` column to employees table
   - Values: 'weekly', 'biweekly', 'monthly'
   - Default: 'monthly'
   - Migration added for existing employees

---

## 📋 **Implementation Plan**

### **Phase 1: Backend Foundation** ✅
- [x] Create weekly_reports table
- [x] Add approvalFrequency to employees table
- [ ] Add weekly reports API endpoints (copy monthly pattern)
- [ ] Add biweekly calculation logic

### **Phase 2: Supervisor Settings**
- [ ] Add "Approval Frequency" setting in Supervisor Management
- [ ] UI to set weekly/biweekly/monthly per supervisor
- [ ] Save preference to employee record
- [ ] Display current setting in supervisor profile

### **Phase 3: Mobile App**
- [ ] Auto-detect supervisor's preferred frequency
- [ ] Show appropriate submit button (weekly/biweekly/monthly)
- [ ] Calculate week numbers correctly
- [ ] Submit to correct endpoint based on frequency

### **Phase 4: Supervisor Dashboard**
- [ ] Show reports based on supervisor's frequency setting
- [ ] Weekly tab (if supervisor prefers weekly)
- [ ] Biweekly tab (if supervisor prefers biweekly)
- [ ] Monthly tab (default, always available)
- [ ] Filter by approval period

---

## 🔧 **Technical Details**

### **Week Calculation**
```typescript
// ISO Week number calculation
function getWeekNumber(date: Date): { week: number; year: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week: weekNo, year: d.getFullYear() };
}

// Biweekly calculation (every 2 weeks)
function getBiweeklyPeriod(date: Date): { period: number; year: number } {
  const { week, year } = getWeekNumber(date);
  return { period: Math.ceil(week / 2), year };
}
```

### **Database Schema**

#### **weekly_reports Table**
```sql
CREATE TABLE weekly_reports (
  id TEXT PRIMARY KEY,
  employeeId TEXT NOT NULL,
  weekNumber INTEGER NOT NULL,  -- ISO week number (1-53)
  year INTEGER NOT NULL,
  startDate TEXT NOT NULL,       -- Monday of the week
  endDate TEXT NOT NULL,         -- Sunday of the week
  totalMiles REAL NOT NULL,
  totalExpenses REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  submittedAt TEXT,
  submittedBy TEXT,
  reviewedAt TEXT,
  reviewedBy TEXT,
  approvedAt TEXT,
  approvedBy TEXT,
  rejectedAt TEXT,
  rejectedBy TEXT,
  rejectionReason TEXT,
  comments TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

#### **employees Table Addition**
```sql
ALTER TABLE employees ADD COLUMN approvalFrequency TEXT DEFAULT 'monthly';
-- Valid values: 'weekly', 'biweekly', 'monthly'
```

---

## 🎨 **UI Design**

### **Supervisor Settings (Admin Portal)**
```
┌─────────────────────────────────────────────┐
│ Supervisor: John Smith                      │
│ ┌─────────────────────────────────────────┐ │
│ │ Approval Frequency                      │ │
│ │                                         │ │
│ │ ○ Weekly    (every Monday)              │ │
│ │ ○ Biweekly  (every other Monday)        │ │
│ │ ● Monthly   (beginning of each month)   │ │
│ │                                         │ │
│ │ [Save Preference]                       │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### **Mobile App - Submit Button**
```
Employee sees appropriate button based on their supervisor's preference:

If supervisor prefers WEEKLY:
  ┌─────────────────────────────────┐
  │ 📅 Submit This Week's Report    │
  │ Week 42 (Oct 14-20, 2024)       │
  └─────────────────────────────────┘

If supervisor prefers BIWEEKLY:
  ┌─────────────────────────────────┐
  │ 📅 Submit Bi-Weekly Report      │
  │ Period 21 (Oct 7-20, 2024)      │
  └─────────────────────────────────┘

If supervisor prefers MONTHLY:
  ┌─────────────────────────────────┐
  │ 📅 Submit Monthly Report        │
  │ October 2024                    │
  └─────────────────────────────────┘
```

### **Supervisor Dashboard**
```
┌─────────────────────────────────────────────┐
│ Approvals                                   │
│ ─────────────────────────────────────────  │
│ View: [Weekly ▼] [This Week ▼]             │
│                                             │
│ ┌─────────────────────────────────────────┐│
│ │ John Doe                                ││
│ │ Week 42 (Oct 14-20, 2024)               ││
│ │ 120.5 miles • $85.00 expenses           ││
│ │ [View] [Request Revision] [Reject] [✓]  ││
│ └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

---

## 🔄 **Workflow Examples**

### **Weekly Approval Workflow**
1. **Monday**: Employee works, tracks mileage
2. **Tuesday-Friday**: Employee continues tracking
3. **Friday/Sunday**: Employee submits week's report
4. **Monday**: Supervisor reviews last week
5. **Supervisor**: Approves/rejects/requests revision
6. **Employee**: Gets notification, sees status

### **Biweekly Approval Workflow**
1. **Week 1**: Employee tracks expenses
2. **Week 2**: Employee continues tracking
3. **End of Week 2**: Employee submits 2-week report
4. **Beginning of Week 3**: Supervisor reviews
5. **Supervisor**: Takes action
6. **Employee**: Receives feedback

### **Monthly Approval Workflow** (Current)
1. **Month**: Employee tracks all month
2. **End of Month**: Employee submits monthly report
3. **Beginning of Next Month**: Supervisor reviews
4. **Supervisor**: Takes action
5. **Employee**: Receives feedback

---

## 💡 **Business Logic**

### **Auto-Detection**
```typescript
// When employee loads submit screen
1. Get employee's supervisor ID
2. Fetch supervisor's approvalFrequency setting
3. Show appropriate submit button:
   - weekly: "Submit This Week"
   - biweekly: "Submit Bi-Weekly Report"  
   - monthly: "Submit Monthly Report"
4. Calculate appropriate period
5. Submit to correct endpoint
```

### **Supervisor Dashboard**
```typescript
// When supervisor opens Approvals tab
1. Get supervisor's approvalFrequency setting
2. Load reports based on frequency:
   - weekly: Load weekly_reports WHERE status = 'submitted'
   - biweekly: Load weekly_reports for biweekly periods
   - monthly: Load monthly_reports WHERE status = 'submitted'
3. Display in appropriate format
4. Allow supervisor to change frequency anytime
```

---

## 🎯 **Benefits**

### **For Employees**
- ✅ Submit more frequently (less to remember)
- ✅ Faster feedback from supervisor
- ✅ Smaller reports to review
- ✅ Earlier error correction

### **For Supervisors**
- ✅ Choose frequency that fits their workflow
- ✅ Review smaller chunks (less overwhelming)
- ✅ More frequent touchpoints with team
- ✅ Catch issues earlier
- ✅ Flexibility per supervisor

### **For Organization**
- ✅ Flexible approval workflow
- ✅ Accommodates different management styles
- ✅ Better compliance
- ✅ Faster issue resolution
- ✅ More timely reimbursements

---

## 📅 **Week/Period Calculations**

### **Weekly (ISO 8601)**
- Week starts Monday, ends Sunday
- Week 1 is the week with January 4th
- 52-53 weeks per year

### **Biweekly**
- 2-week periods
- 26 periods per year
- Aligned to ISO weeks (periods 1, 3, 5, 7...)

### **Monthly**
- Calendar months
- 12 periods per year
- Current implementation

---

## 🚀 **Implementation Priority**

### **Must Have**
1. ✅ Database tables (weekly_reports)
2. ✅ Approval frequency field
3. [ ] Weekly reports API (mirror monthly)
4. [ ] Auto-detect supervisor preference
5. [ ] Show appropriate submit button

### **Should Have**
1. [ ] Biweekly calculation
2. [ ] Supervisor can change frequency
3. [ ] Dashboard filters by frequency
4. [ ] Historical period navigation
5. [ ] Period selector

### **Nice to Have**
1. [ ] Default to supervisor's preference for new hires
2. [ ] Analytics by approval frequency
3. [ ] Bulk approval for weekly reports
4. [ ] Export by period type
5. [ ] Reminder emails by frequency

---

## 📝 **Next Steps**

### **Immediate**
1. Add approvalFrequency to Employee interface (mobile)
2. Create WeeklyReportService (mirror MonthlyReportService)
3. Add weekly reports API endpoints
4. Update SupervisorDashboard to handle all frequencies

### **Then**
1. Add frequency selector in Supervisor Management
2. Update mobile Reports screen to detect frequency
3. Show appropriate submit button
4. Test all three frequencies

---

## 🎉 **Summary**

Weekly approvals give supervisors flexibility to review their team's work at a cadence that fits their management style:

- **Weekly**: Close oversight, frequent feedback
- **Biweekly**: Balanced approach, not too frequent
- **Monthly**: Traditional approach, comprehensive review

All three options will coexist, configurable per supervisor! 🚀

---

*End of Weekly Approvals Implementation Plan*

