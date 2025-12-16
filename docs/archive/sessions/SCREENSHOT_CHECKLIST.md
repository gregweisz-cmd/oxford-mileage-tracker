# Screenshot Checklist for Training Guide

This checklist helps you capture all the screenshots needed for the Training Guide. Each screenshot should be clear, well-lit, and show the relevant UI elements.

---

## Admin Portal Screenshots

- [ ] **Employee Management Tab**
  - Full view of employee list with search bar and action buttons
  - Location: `TRAINING_GUIDE.md` - Admin Portal → Employee Management

- [ ] **Employee Creation Form**
  - Dialog/form showing all input fields (Name, Email, Position, Supervisor, Cost Centers)
  - Location: `TRAINING_GUIDE.md` - Admin Portal → Create a New Employee

---

## Finance Portal Screenshots

- [ ] **Finance Portal Main View**
  - Shows all tabs (All Reports, Pending Review, Approved Reports, Needs Revision, Reports & Analytics) and filter section at top
  - Location: `TRAINING_GUIDE.md` - Finance Portal → Overview

- [ ] **All Reports Tab**
  - Full table view with all columns: Employee, Period, Miles, Mileage ($), Total Expenses, Status, Submitted, Actions
  - Location: `TRAINING_GUIDE.md` - Finance Portal → All Reports

- [ ] **Print Preview Dialog**
  - Dialog showing style customization options (Font Size, Spacing, Orientation dropdowns) and preview pane below
  - Location: `TRAINING_GUIDE.md` - Finance Portal → Print Preview

- [ ] **Request Revision Dialog**
  - Dialog showing report details and comment field with example text filled in
  - Location: `TRAINING_GUIDE.md` - Tips for CEO/CFO Demo → Approval Workflow

---

## Supervisor Portal Screenshots

- [ ] **Supervisor Portal Header**
  - Header showing logo, welcome message, toggle switches (Show widgets, Show supervisor dashboard), Refresh and Export buttons
  - Location: `TRAINING_GUIDE.md` - Supervisor Portal → Header Actions

- [ ] **Dashboard Statistics Cards**
  - Four cards showing: Team Members (with count), Active Reports (with count and badge), Monthly Total (with dollar amount), Approval Rate (with percentage)
  - Location: `TRAINING_GUIDE.md` - Supervisor Portal → Dashboard Statistics

- [ ] **Approval Actions**
  - Report row showing action buttons: Approve (green check), Reject (red X), Delegate (blue person), Comment (chat bubble)
  - Location: `TRAINING_GUIDE.md` - Tips for CEO/CFO Demo → Approval Workflow

---

## Reports & Analytics Screenshots

- [ ] **Reports & Analytics Full Dashboard**
  - Complete view showing filter controls at top, summary cards grid, submission funnel chart, and all sections below
  - Location: `TRAINING_GUIDE.md` - Tips for CEO/CFO Demo → Recommended Demo Flow

- [ ] **Filter Controls**
  - Filter section with Date Range set to "This Quarter" and Cost Center filter dropdown open showing selection options
  - Location: `TRAINING_GUIDE.md` - Tips for CEO/CFO Demo → Filtering Capabilities

- [ ] **Summary Cards Grid**
  - Close-up of the 8 summary cards showing: Total Expenses, Total Miles, Active Reports, Pending Approvals, Average per Report, Cost Center Count, Employee Count, Submission Rate (all with formatted values)
  - Location: `TRAINING_GUIDE.md` - Reports & Analytics → Summary Cards

- [ ] **Submission Funnel Chart**
  - Horizontal bar chart showing report counts by status with color-coded bars (Draft-gray, Submitted-blue, Pending Supervisor-orange, Pending Finance-purple, Under Review-brown, Needs Revision-red, Approved-green, Rejected-dark red) with counts and percentages
  - Location: `TRAINING_GUIDE.md` - Reports & Analytics → Submission Funnel

- [ ] **Trends Section**
  - Sparkline chart showing monthly data points connected with a line, with forecast information displayed below the chart showing next month's predicted spend
  - Location: `TRAINING_GUIDE.md` - Reports & Analytics → Trends Section

- [ ] **Top Cost Centers Tables**
  - Two side-by-side tables: "Top Cost Centers by Spend" (left) and "Top Cost Centers by Miles" (right) showing cost center names, totals, percentages, and counts
  - Location: `TRAINING_GUIDE.md` - Reports & Analytics → Top Cost Centers

- [ ] **Mileage Activity Map**
  - Map visualization showing GPS route segments as colored lines, activity clusters as circles, with color intensity indicating frequency (darker = more frequent)
  - Location: `TRAINING_GUIDE.md` - Reports & Analytics → Mileage Activity Map

---

## Report Builder Screenshots

- [ ] **Report Builder Overview**
  - Full Report Builder section showing: column selector dropdown, filters section (Date Range, Status, Cost Centers, etc.), and Run Report button
  - Location: `TRAINING_GUIDE.md` - Report Builder → Overview

- [ ] **Column Selector in Action**
  - Multi-select dropdown open showing available columns, with several columns already selected (shown as chips)
  - Location: `TRAINING_GUIDE.md` - Report Builder → Column Selection

- [ ] **Report Results Data Grid**
  - Data grid showing report results with selected columns, sortable headers (with sort indicators), and properly formatted values (currency with $, dates formatted, etc.)
  - Location: `TRAINING_GUIDE.md` - Report Builder → View Results

- [ ] **Scheduled Deliveries Table**
  - Table showing scheduled reports with columns: Name, Frequency, Recipients, Next Run, Formats (CSV/PDF checkmarks), Status, with Add Schedule button visible
  - Location: `TRAINING_GUIDE.md` - Report Builder → Scheduled Deliveries

- [ ] **Schedule Creation Dialog**
  - Dialog/form showing all fields filled in with example data: Name, Description, Recipients (email addresses), Frequency dropdown (showing Weekly selected), Day/Time selectors, Timezone dropdown, Attachment checkboxes (CSV and PDF both checked), Row Limit field
  - Location: `TRAINING_GUIDE.md` - Report Builder → Create New Schedule

---

## Tips for Screenshots

### Quality Guidelines
- **Resolution**: Capture at full screen resolution or at least 1920x1080
- **Clarity**: Ensure text is readable and UI elements are clearly visible
- **Context**: Include enough surrounding UI to show context (headers, navigation, etc.)
- **Annotations**: Consider adding arrows or highlights for complex features (optional)

### Format
- **File Format**: PNG or JPG (PNG preferred for crisp text)
- **Naming**: Use descriptive names like `finance-portal-all-reports-tab.png`
- **Organization**: Store in a `screenshots/` folder organized by portal/section

### What to Capture
- ✅ Full dialogs and modals
- ✅ Tables with sample data
- ✅ Dropdown menus while open
- ✅ Forms with example data filled in
- ✅ Charts and visualizations
- ✅ Action buttons and toolbars
- ✅ Filter sections with filters applied

### What to Avoid
- ❌ Blurry or pixelated images
- ❌ Screenshots with personal/sensitive data (use anonymized test data)
- ❌ Cropped UI elements (show full context)
- ❌ Multiple overlapping dialogs
- ❌ Browser developer tools or console errors visible

---

## Screenshot Assignment Priority

### High Priority (Essential for Demo)
1. Reports & Analytics Full Dashboard
2. Summary Cards Grid
3. Submission Funnel Chart
4. Report Builder Overview
5. Filter Controls (This Quarter example)

### Medium Priority (Important for Understanding)
6. Finance Portal Main View
7. All Reports Tab
8. Trends Section
9. Scheduled Deliveries Table
10. Supervisor Portal Header

### Low Priority (Nice to Have)
11. Employee Management Tab
12. Dashboard Statistics Cards
13. Mileage Activity Map
14. Approval Actions
15. Print Preview Dialog

---

## Quick Capture Tips

1. **Use Browser Zoom**: Set browser to 100% for consistent sizing
2. **Hide Sensitive Data**: Use test accounts with fake data
3. **Consistent Theme**: Use the same theme/colors throughout (light or dark)
4. **Multiple Views**: Capture both desktop and tablet views if applicable
5. **Error States**: Consider capturing error messages or empty states too

---

**Total Screenshots Needed**: ~15-20  
**Estimated Time**: 30-45 minutes to capture all

