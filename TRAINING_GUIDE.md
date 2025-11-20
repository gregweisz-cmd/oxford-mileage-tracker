# Oxford House Expense Reporting System - Training Guide

**For CEO/CFO Demonstration**

This guide provides step-by-step instructions for using all features of the expense reporting system across different portals.

> **Note:** Screenshot placeholders are marked with 📸 throughout this guide. Add actual screenshots in those locations for a complete visual reference.

---

## Table of Contents

1. [Admin Portal](#admin-portal)
2. [Finance Portal](#finance-portal)
3. [Supervisor Portal](#supervisor-portal)
4. [Reports & Analytics (Shared)](#reports--analytics-shared)
5. [Report Builder](#report-builder)
6. [Quick Reference](#quick-reference)

---

## Admin Portal

**Access:** Available to administrators with full system access.

### Tab 1: Employee Management

> 📸 **Screenshot Placeholder:** Admin Portal - Employee Management tab showing the employee list with search bar and action buttons

#### View All Employees
1. Navigate to **Admin Portal** → **Employee Management** tab
2. The employee list displays all active employees
3. Use the search bar to find specific employees
4. Click on an employee row to view/edit details

#### Create a New Employee
1. Click the **"Add Employee"** or **"Create Employee"** button
   > 📸 **Screenshot Placeholder:** Employee creation form dialog with all input fields
2. Fill in required fields:
   - Name
   - Email
   - Position
   - Supervisor (optional)
   - Cost Centers (select from dropdown or create new)
3. Click **"Save"** to create the employee

#### Edit Employee Information
1. Find the employee in the list
2. Click the **Edit** icon next to their name
3. Modify any fields (name, email, position, supervisor, cost centers)
4. Click **"Save"** to update

#### Archive/Delete an Employee
1. Select the employee(s) using checkboxes
2. Click **"Archive"** to move to archived list (recommended first step)
3. To permanently delete, go to archived section and use **"Delete"** button
4. Confirm the action in the dialog

#### Bulk Import Employees
1. Click **"Import Employees"** button
2. Download the template CSV file
3. Fill in employee data following the template format
4. Upload the completed CSV file
5. Review import results (successful/failed imports)
6. Fix any errors and re-import if needed

#### Filter and Search
- Use the search bar to filter by name, email, or position
- Use status filters (Active/Archived)
- Use cost center filters to show employees by department

---

### Tab 2: Supervisor Management

#### Assign Supervisors
1. Navigate to **Supervisor Management** tab
2. View list of all employees and their current supervisor assignments
3. Select employee(s) using checkboxes
4. Click **"Assign Supervisor"** or use the dropdown in each row
5. Select the supervisor from the list
6. Click **"Save"** to assign

#### Bulk Assign Supervisors
1. Select multiple employees using checkboxes
2. Click **"Bulk Update"** button
3. Select a supervisor from the dropdown
4. Click **"Apply"** to assign supervisor to all selected employees

#### View Supervisor Hierarchy
- The table shows each employee with their assigned supervisor
- Click on a supervisor name to view their team members
- View supervisor delegation chains if applicable

#### Remove Supervisor Assignment
1. Find the employee in the list
2. Click **Edit** or use the supervisor dropdown
3. Clear the supervisor field or select "None"
4. Click **"Save"**

---

### Tab 3: Cost Center Management

#### View All Cost Centers
1. Navigate to **Cost Center Management** tab
2. View list of all cost centers with their details:
   - Name
   - Code (if applicable)
   - Description
   - Number of employees assigned

#### Create a New Cost Center
1. Click **"Add Cost Center"** button
2. Enter:
   - Cost Center Name (required)
   - Code (optional)
   - Description (optional)
3. Click **"Save"** to create

#### Edit Cost Center
1. Find the cost center in the list
2. Click the **Edit** icon
3. Modify name, code, or description
4. Click **"Save"** to update

#### Delete Cost Center
1. Find the cost center in the list
2. Click the **Delete** icon
3. Confirm deletion (note: cannot delete if employees are assigned)
4. If employees are assigned, reassign them first

#### Assign Cost Centers to Employees
- Cost centers are typically assigned through Employee Management
- Or use bulk assignment in Employee Management tab

---

### Tab 4: Reports & Analytics

See the [Reports & Analytics (Shared)](#reports--analytics-shared) section below for detailed instructions.

---

### Tab 5: System Settings

1. Navigate to **System Settings** tab
2. This section will contain system configuration options
3. Currently shows "Coming soon!" message

---

## Finance Portal

**Access:** Available to finance department staff for expense report review and approval.

### Overview
The Finance Portal provides comprehensive tools for reviewing, approving, and managing expense reports across the organization.

> 📸 **Screenshot Placeholder:** Finance Portal main view showing tabs (All Reports, Pending Review, Approved Reports, Needs Revision, Reports & Analytics) and filter section

---

### Filtering and Searching Reports

#### Use Date Range Filters
1. At the top of the portal, locate the filter section
2. Select a **Date Range** preset:
   - This Week
   - Last Week
   - This Month (default)
   - Last Month
   - This Quarter
   - Last Quarter
   - This Year
   - Custom Range
3. For **Custom Range**:
   - Select **Start Date** using date picker
   - Select **End Date** using date picker
   - Or use **Month** and **Year** dropdowns

#### Filter by Status
1. Use the **Status** dropdown
2. Select from:
   - All Statuses
   - Draft
   - Submitted
   - Approved
   - Needs Revision

#### Filter by Employee
1. Use the **Employee** dropdown
2. Select a specific employee or "All Employees"

#### Filter by State
1. Use the **State** dropdown (if applicable)
2. Select a state or "All States"

#### Filter by Cost Center
1. Use the **Cost Center** dropdown
2. Select a specific cost center or "All Cost Centers"

#### Sort Reports
- Click any column header to sort by that field
- Click again to reverse sort order
- Sortable columns: Employee, Period, Miles, Mileage ($), Total Expenses ($), Status, Submitted

---

### Tab 1: All Reports

> 📸 **Screenshot Placeholder:** All Reports tab showing the full table with columns (Employee, Period, Miles, Mileage ($), Total Expenses, Status, Submitted, Actions)

#### View All Expense Reports
1. Click **"All Reports"** tab (default)
2. View comprehensive list of all reports matching current filters
3. Each row shows:
   - Employee name
   - Period (Month/Year)
   - Total miles
   - Mileage reimbursement amount
   - Total expenses
   - Status (color-coded chip)
   - Submission date

#### View Report Details
1. Find the report in the table
2. Click the **View** icon (eye icon) in the Actions column
3. Review report details in the dialog:
   - Summary information
   - Daily breakdown
   - Expense categories
   - Receipt summary (if applicable)
4. Close dialog when done

#### Print Preview
1. Find the report in the table
2. Click the **Print** icon (printer icon)
3. In the print preview dialog:
   > 📸 **Screenshot Placeholder:** Print Preview dialog showing style customization options (Font Size, Spacing, Orientation) and preview pane
   - Customize print styles:
     - Font Size (Small/Normal/Large)
     - Spacing (Compact/Normal/Relaxed)
     - Orientation (Portrait/Landscape)
   - Review the formatted report
4. Click **"Print"** to print or **"Close"** to exit

#### Export to PDF
1. Find the report in the table
2. Click the **Download** icon (download/Excel icon)
3. PDF will automatically download with filename format:
   - `LASTNAME,FIRSTNAME EXPENSES MMM-YY.pdf`
   - Example: `SMITH,JOHN EXPENSES NOV-24.pdf`

#### Request Revision
1. Find a report with status **"Submitted"**
2. Click the **Send** icon (paper airplane icon)
3. In the dialog, enter comments explaining what needs to be revised
4. Click **"Send Revision Request"**
5. The employee will be notified and report status changes to "Needs Revision"

#### Refresh Data
1. Click the **"Refresh"** button in the filter section
2. Data will reload from the server

---

### Tab 2: Pending Review

#### View Reports Needing Review
1. Click **"Pending Review"** tab
2. View only reports with status "Submitted"
3. These are reports awaiting finance department review
4. Use same actions as "All Reports" tab:
   - View details
   - Request revision
   - Approve (if implemented)

---

### Tab 3: Approved Reports

#### View Approved Reports
1. Click **"Approved Reports"** tab
2. View all reports that have been approved
3. Useful for:
   - Historical review
   - Generating reports
   - Auditing purposes
4. Actions available:
   - View details
   - Print preview
   - Export to PDF

---

### Tab 4: Needs Revision

#### View Reports Requiring Changes
1. Click **"Needs Revision"** tab
2. View reports that were sent back to employees for corrections
3. Click **View** icon to see revision comments
4. Monitor when employees resubmit revised reports

---

### Tab 5: Reports & Analytics

See the [Reports & Analytics (Shared)](#reports--analytics-shared) section below for detailed instructions.

---

## Supervisor Portal

**Access:** Available to supervisors to review and approve team member expense reports.

### Overview
The Supervisor Portal provides tools for managing team members, reviewing their expense reports, and approving submissions before they reach finance.

> 📸 **Screenshot Placeholder:** Supervisor Portal header showing logo, welcome message, toggle switches (Show widgets, Show supervisor dashboard), Refresh and Export buttons

---

### Header Actions

#### Toggle Dashboard Widgets
1. In the header, find **"Show widgets"** toggle
2. Toggle on/off to show/hide dashboard statistics cards
3. Preference is saved in browser

#### Toggle Supervisor Dashboard
1. In the header, find **"Show supervisor dashboard"** toggle
2. Toggle on/off to show/hide the detailed supervisor dashboard
3. Preference is saved in browser

#### Refresh Data
1. Click **"Refresh"** button to reload all data
2. Data auto-refreshes every 30 seconds

#### Export Reports
1. Click **"Export Reports"** button
2. Exports team report data (format depends on implementation)

---

### Dashboard Statistics (if enabled)

> 📸 **Screenshot Placeholder:** Dashboard statistics cards showing Team Members, Active Reports, Monthly Total, and Approval Rate with icons and numbers

View at-a-glance metrics:
- **Team Members**: Total count of direct reports
- **Active Reports**: Reports currently in progress
- **Pending Reviews**: Reports waiting for your approval (with badge count)
- **Monthly Total**: Total expenses for current month
- **Approval Rate**: Percentage of approved reports

---

### Tab 1: Approvals

#### View Approval Dashboard
1. Click **"Approvals"** tab (default)
2. View supervisor-specific dashboard (if enabled)
3. Review pending approvals and workflow status

#### Approve a Report
1. Navigate to **"Reports"** tab (see below for detailed steps)
2. Find report with status "Pending Supervisor" or "Submitted"
3. Click the **View** icon
4. Review report details in the dialog
5. Click **"Approve Report"** button (green checkmark)
6. Report moves to next approval stage (typically Finance)

#### Request Changes (Reject)
1. Find report awaiting your approval
2. Click **"View"** icon
3. In the review dialog, enter comments explaining what needs to be changed
4. Click **"Reject Report"** button (red X)
5. Report status changes to "Needs Revision" and employee is notified

#### Add Comments (Without Rejecting)
1. Find any report
2. Click the **Comment** icon (chat bubble)
3. Enter your comment in the dialog
4. Click **"Add Comment"**
5. Comment is saved and visible to other supervisors and finance

#### Delegate Approval
1. Find report awaiting your approval
2. Click the **Delegate** icon (person with plus sign)
3. In the dialog, select another supervisor from the dropdown
4. Click **"Delegate"**
5. The selected supervisor will receive the approval request

#### Send Reminder
1. Find report that is overdue or approaching deadline
2. Click the **Schedule** icon (clock icon)
3. A reminder notification is sent to the appropriate approver

---

### Tab 2: Reports

#### View All Team Reports
1. Click **"Reports"** tab
2. View all expense reports from your team members
3. The tab shows count: **Reports (X)**

#### Filter Reports
1. Use **Search** box to find reports by employee name
2. Use **Status** filter:
   - All Status
   - Pending Supervisor
   - Pending Finance
   - Approved
   - Needs Revision
   - Rejected
   - Drafts
3. Use **Month** filter:
   - Current Month
   - All Months
   - Specific month (September, October, November, December)

#### Understanding Report Status Colors
- **Gray**: Draft
- **Orange**: Submitted / Pending Supervisor
- **Blue**: Under Review / Pending Finance
- **Green**: Approved
- **Red**: Rejected / Needs Revision

#### View Report Details
1. Click on an **employee name** (blue, clickable link) to view their full expense report in a modal
2. Or click the **View** icon (eye icon) for a quick review dialog
3. The employee name opens the full Staff Portal view in supervisor mode

#### Quick Approval Actions
For reports awaiting your approval, use action buttons:
- **✓ (Green Check)**: Approve immediately
- **✗ (Red X)**: Request changes/reject
- **👤 (Blue Person)**: Delegate to another supervisor
- **💬 (Comment)**: Add a comment
- **⏰ (Clock)**: Send reminder

#### View Approval Workflow
- Reports show approval workflow status
- View current step in the approval process
- See who the report is delegated to (if applicable)
- Check due dates and overdue indicators

---

### Tab 3: Team

#### View Team Members
1. Click **"Team"** tab
2. View list of all your direct reports
3. The tab shows count: **Team (X)**

#### View Team Member Details
1. Click on a **team member's name** (blue, clickable link)
2. Opens their expense report in supervisor view
3. Review their current month's report

#### Team Member Information Displayed
- Avatar with initials
- Name (clickable)
- Active/Inactive status chip
- Position
- Email address
- Assigned cost centers (as chips)

---

### Tab 4: Analytics

1. Click **"Analytics"** tab
2. View team performance analytics (if implemented)
3. Currently shows "Coming soon!" message
4. Future features:
   - Approval rates
   - Submission patterns
   - Expense trends
   - Team productivity metrics

---

## Reports & Analytics (Shared)

**Access:** Available in both Admin Portal and Finance Portal.

### Overview
The Reports & Analytics tab provides comprehensive insights into expense reporting across the organization, including visualizations, trend analysis, and hotspot identification.

> 📸 **Screenshot Placeholder:** Reports & Analytics tab showing filter controls at top, summary cards grid, and submission funnel chart

---

### Filter Controls

#### Set Date Range
1. At the top, find **Start Date** and **End Date** fields
2. Click date pickers to select dates
3. Default is current month (1st to today)

#### Set Attention Threshold
1. Find **"Attention Threshold (days)"** field
2. Enter number of days (default: 5)
3. Reports older than this threshold appear in "Needs Attention" list

#### Filter by Cost Centers
1. Use **Cost Center** multi-select dropdown
2. Select one or more cost centers
3. Or select "Unassigned" to see reports without cost centers
4. Leave empty to include all cost centers

#### Apply Filters
1. Click **"Refresh"** button to load data with current filters
2. Or click **"Reset"** to clear all filters and return to defaults
3. Click **"Export CSV"** to download filtered data

---

### Summary Cards Section

> 📸 **Screenshot Placeholder:** Grid of summary cards showing Total Expenses, Total Miles, Active Reports, Pending Approvals, Average per Report, Cost Center Count, Employee Count, and Submission Rate with formatted values

View key metrics at a glance:
- **Total Expenses**: Sum of all expenses in date range
- **Total Miles**: Total miles traveled
- **Active Reports**: Number of reports in progress
- **Pending Approvals**: Reports awaiting approval
- **Average per Report**: Average expense amount per report
- **Cost Center Count**: Number of unique cost centers
- **Employee Count**: Number of employees with reports
- **Submission Rate**: Percentage of reports submitted on time

Each card shows:
- Label
- Value (formatted appropriately: currency, miles, percentages)
- Color coding for quick identification

---

### Submission Funnel Chart

> 📸 **Screenshot Placeholder:** Horizontal bar chart (funnel) showing report counts by status with color-coded bars (Draft, Submitted, Pending Supervisor, etc.) with counts and percentages

#### View Submission Status Breakdown
1. Scroll to **"Submission Funnel"** section
2. View horizontal bar chart showing report counts by status
3. Statuses displayed:
   - Draft (gray)
   - Submitted (blue)
   - Pending Supervisor (orange)
   - Pending Finance (purple)
   - Under Review (brown)
   - Needs Revision (red)
   - Approved (green)
   - Rejected (dark red)
4. Each bar shows count and percentage of total

#### Understanding the Funnel
- Left side: Total reports
- Right side: Approved reports
- Shows where reports are in the approval pipeline
- Identify bottlenecks (where reports are piling up)

---

### Reports Needing Attention

#### View Problem Reports
1. Scroll to **"Reports Needing Attention"** section
2. View table of reports that need review based on:
   - Age (older than threshold days)
   - Status issues
   - Unusual amounts
3. Table shows:
   - Employee name
   - Period (Month/Year)
   - Status
   - Days since submission
   - Total amount
   - Cost centers

#### Take Action on Attention Reports
- Review each report individually
- Contact employees if needed
- Use Finance Portal to request revisions

---

### Top Cost Centers Section

#### Top Cost Centers by Spend
1. Scroll to **"Top Cost Centers by Spend"** section (left side)
2. View table showing:
   - Cost center name
   - Total expenses (formatted as currency)
   - Percentage of total
   - Number of reports
   - Number of employees
3. Sorted by highest spend first

#### Top Cost Centers by Miles
1. Scroll to **"Top Cost Centers by Miles"** section (right side)
2. View table showing:
   - Cost center name
   - Total miles
   - Percentage of total
   - Number of reports
3. Sorted by highest miles first

#### Use for Analysis
- Identify high-spending departments
- Compare cost centers
- Track mileage patterns
- Budget planning

---

### Trends Section

> 📸 **Screenshot Placeholder:** Trends section showing Sparkline chart with monthly data points and forecast information below the chart

#### View Expense Trends
1. Scroll to **"Trends"** section
2. View multi-month trend visualization:
   - Sparkline chart showing expense trend over time
   - Forecast for next month's spend (if available)
   - Period labels (Month-Year format)

#### Understanding Trends
- **Chart**: Line graph showing monthly expense totals
- **Forecast**: Predicted next month spend based on historical data
- **Trend Direction**: Visual indication if spending is increasing/decreasing

#### Forecast Information
- Shows predicted total expenses for next month
- Based on historical patterns
- Useful for budget planning

---

### Mileage Activity Map

> 📸 **Screenshot Placeholder:** Map visualization showing GPS route segments as lines, activity clusters as circles, with color intensity indicating frequency

#### View Geographic Activity
1. Scroll to **"Mileage Activity Map"** section
2. View map visualization of GPS-tracked mileage (if data available)
3. Map shows:
   - Route segments (lines)
   - Activity clusters (circles)
   - Heat intensity based on frequency

#### Understanding the Map
- **Routes**: GPS-tracked mileage segments
- **Clusters**: Aggregated activity points
- **Colors**: Intensity of activity (darker = more frequent)
- **Privacy**: Data is aggregated and anonymized

#### Interact with Map
- Hover over segments/clusters for details
- Zoom in/out if controls available
- View totals in map legend

#### No Data Available?
- Message displays: "No GPS-tracked mileage data found for the selected range"
- Ensure date range includes periods with GPS data
- Check that employees are using GPS tracking features

---

## Report Builder

**Access:** Available in Reports & Analytics tab (bottom section).

### Overview
The Report Builder allows you to create custom reports with selected columns, filters, and save configurations for future use.

> 📸 **Screenshot Placeholder:** Report Builder section showing column selector dropdown, filters section, and Run Report button

---

### Column Selection

#### Select Columns to Include
1. Scroll to **"Report Builder"** section
2. Find **"Selected Columns"** field
3. Click the multi-select dropdown
4. Select columns you want in your report:
   - Employee Name
   - Employee Email
   - Report ID
   - Month/Year
   - Status
   - Total Expenses
   - Total Miles
   - Mileage Amount
   - Hours Worked
   - Cost Centers
   - Submitted Date
   - Approved Date
   - And more...
5. Selected columns appear as chips
6. Click X on a chip to remove that column

#### Default Columns
- The system suggests default columns if you haven't selected any
- Typically includes: Employee Name, Period, Status, Total Expenses

---

### Filters Section

#### Date Range Filter
1. Find **"Date Range"** in Filters
2. Set **Start Date** and **End Date**
3. Reports within this range will be included

#### Status Filter
1. Find **"Status"** multi-select
2. Select one or more statuses:
   - Draft
   - Submitted
   - Approved
   - Needs Revision
   - Rejected
3. Leave empty to include all statuses

#### Cost Center Filter
1. Find **"Cost Centers"** multi-select
2. Select one or more cost centers
3. Leave empty to include all cost centers

#### Employee Filter
1. Find **"Employee IDs"** field
2. Enter employee IDs separated by commas
3. Or leave empty to include all employees

#### Search Filter
1. Find **"Search"** field
2. Enter text to search in report descriptions, employee names, etc.
3. Case-insensitive search

#### Total Expenses Filter
1. Find **"Total Expenses"** fields
2. Enter **Min** amount (optional)
3. Enter **Max** amount (optional)
4. Reports within this range will be included

---

### Row Limit

1. Find **"Row Limit"** field
2. Enter maximum number of rows to return (default: 100)
3. Higher limits may take longer to load

---

### Run Report

#### Execute Query
1. After selecting columns and filters, click **"Run Report"** button
2. Wait for data to load (progress indicator shows)
3. Results appear in the data grid below

#### View Results
- Data grid shows selected columns only
  > 📸 **Screenshot Placeholder:** Data grid showing report results with selected columns, sortable headers, and formatted values (currency, dates)
- Sort by clicking column headers
- Scroll horizontally to see all columns
- Values are formatted appropriately (currency, dates, etc.)

#### Handle Errors
- If error occurs, message displays at top
- Check filters and try again
- Reduce row limit if query is too large

---

### Export to CSV

#### Download Results
1. After running a report, click **"Export to CSV"** button
2. CSV file downloads with current results
3. Filename includes timestamp: `report_YYYY-MM-DD_HHMMSS.csv`
4. Open in Excel or other spreadsheet software

---

### Presets Management

#### Save Current Configuration as Preset
1. Configure columns and filters as desired
2. Enter a preset name in **"Preset Name"** field (if visible)
3. Click **"Save New"** button
4. Enter name and optional description in dialog
5. Click **"Save"** to create preset

#### Load Saved Preset
1. Find **"Presets"** dropdown (above column selection)
2. Select a saved preset from the list
3. Columns and filters automatically populate
4. Click **"Run Report"** to execute with preset settings

#### Update Existing Preset
1. Load a preset
2. Modify columns or filters
3. Click **"Update"** button
4. Confirm update in dialog
5. Preset is saved with new configuration

#### Delete Preset
1. Select the preset you want to delete
2. Click **"Delete"** button
3. Confirm deletion in dialog
4. Preset is permanently removed

---

### Scheduled Deliveries

> 📸 **Screenshot Placeholder:** Scheduled Deliveries section showing table of schedules with columns (Name, Frequency, Recipients, Next Run, Formats, Status) and Add Schedule button

#### View Scheduled Reports
1. Scroll to **"Scheduled Deliveries"** section
2. View table of all scheduled report deliveries
3. Table shows:
   - Schedule name
   - Frequency (Daily/Weekly/Monthly)
   - Recipients
   - Next run time
   - Formats (CSV/PDF)
   - Status (Active/Paused)

#### Create New Schedule
1. Click **"Add Schedule"** or **"New Schedule"** button
   > 📸 **Screenshot Placeholder:** Schedule creation dialog/form showing all fields: Name, Description, Recipients, Frequency dropdown, Day/Time selectors, Timezone, Attachment checkboxes (CSV/PDF), Row Limit
2. Fill in the form:
   - **Name**: Descriptive name for the schedule
   - **Description**: Optional description
   - **Recipients**: Comma-separated email addresses
   - **Frequency**: Daily, Weekly, or Monthly
   - **Day/Time**: 
     - Daily: Select time
     - Weekly: Select day of week and time
     - Monthly: Select day of month and time
   - **Timezone**: Select timezone (default: system timezone)
   - **Attachment Formats**: Check CSV and/or PDF
   - **Row Limit**: Maximum rows to include (optional)
3. Configure report filters (same as Report Builder)
4. Select columns to include
5. Click **"Save Schedule"** to create

#### Edit Schedule
1. Find the schedule in the table
2. Click **"Edit"** icon
3. Modify any settings in the form
4. Click **"Update Schedule"** to save changes

#### Delete Schedule
1. Find the schedule in the table
2. Click **"Delete"** icon
3. Confirm deletion in dialog
4. Schedule is permanently removed and will not run again

#### Run Schedule Now
1. Find the schedule in the table
2. Click **"Run Now"** or **"Trigger"** button
3. Report is generated immediately and emailed to recipients
4. Useful for testing schedules or generating on-demand reports

#### Pause/Resume Schedule
- Some implementations may allow pausing schedules
- Check for Pause/Resume buttons or toggles
- Paused schedules do not run automatically

---

## Quick Reference

### Status Definitions

- **Draft**: Employee is still working on the report, not submitted
- **Submitted**: Employee submitted the report, awaiting supervisor approval
- **Pending Supervisor**: Report is waiting for supervisor approval
- **Pending Finance**: Report approved by supervisor, awaiting finance review
- **Under Review**: Finance is actively reviewing the report
- **Approved**: Report has been fully approved and is ready for payment
- **Needs Revision**: Report was sent back to employee for corrections
- **Rejected**: Report was rejected and will not be paid

### Color Coding

- **Gray/Default**: Draft or inactive
- **Blue**: Submitted or informational
- **Orange**: Pending action (supervisor)
- **Purple**: Pending finance review
- **Green**: Approved or successful
- **Red**: Rejected, needs revision, or error
- **Yellow/Warning**: Attention needed

### Keyboard Shortcuts (if applicable)

- **Ctrl+F** or **Cmd+F**: Focus search/filter fields
- **Esc**: Close dialogs
- **Enter**: Submit forms
- **Tab**: Navigate between fields

### Common Workflows

#### Employee Submits Report → Supervisor Approves → Finance Approves → Payment

1. Employee creates and submits expense report
2. Supervisor receives notification
3. Supervisor reviews and approves (or requests changes)
4. If approved, report moves to Finance
5. Finance reviews and approves
6. Report is marked approved and ready for payment processing

#### Requesting Revisions

1. Reviewer (Supervisor or Finance) opens report
2. Identifies issues
3. Clicks "Request Revision" or "Reject"
4. Enters detailed comments explaining what needs to be fixed
5. Employee receives notification
6. Employee makes corrections and resubmits
7. Report goes back through approval workflow

#### Generating Reports for CEO/CFO

1. Navigate to **Reports & Analytics** tab
2. Set appropriate date range (e.g., This Quarter, This Year)
3. Review summary cards for key metrics
4. Export overview data to CSV if needed
5. Use Report Builder for custom analysis:
   - Select relevant columns
   - Apply filters (cost centers, departments, etc.)
   - Run report
   - Export to CSV or PDF
6. Schedule regular reports for automatic delivery

---

## Tips for CEO/CFO Demonstration

> 📸 **Screenshot Placeholder:** Full-page view of Reports & Analytics tab showing complete dashboard with all sections visible

### Recommended Demo Flow

1. **Start with Overview**
   - Show Reports & Analytics tab
   - Highlight summary cards (Total Expenses, Active Reports)
   - Show submission funnel to demonstrate workflow
   > 📸 **Screenshot Placeholder:** Close-up of summary cards section for emphasis during demo

2. **Show Filtering Capabilities**
   - Filter by date range (This Quarter)
   - Filter by cost center
   - Show how data updates in real-time
   > 📸 **Screenshot Placeholder:** Filter section with Date Range set to "This Quarter" and Cost Center filter dropdown open showing selection options

3. **Demonstrate Trend Analysis**
   - Show trends section with forecast
   - Explain how this helps with budget planning
   > 📸 **Screenshot Placeholder:** Trends section expanded showing Sparkline chart and forecast details clearly visible

4. **Show Top Cost Centers**
   - Highlight which departments are spending the most
   - Show both by spend and by miles

5. **Demonstrate Report Builder**
   - Create a custom report
   - Show column selection
   - Apply filters
   - Export to CSV
   > 📸 **Screenshot Placeholder:** Report Builder showing column selector with multiple columns selected, filters applied, and Export to CSV button visible

6. **Show Scheduled Reports**
   - Explain how reports can be automatically delivered
   - Show example schedule configuration
   > 📸 **Screenshot Placeholder:** Scheduled Deliveries table with at least one active schedule showing, and the schedule creation/edit dialog open with example configuration filled in

7. **Walk Through Approval Workflow**
   - Show Supervisor Portal approval process
   - Show Finance Portal review process
   - Demonstrate request revision feature
   > 📸 **Screenshot Placeholder:** Supervisor Portal showing a report with approval buttons (Approve, Reject, Delegate, Comment)
   > 📸 **Screenshot Placeholder:** Finance Portal showing request revision dialog with comment field filled in

### Key Points to Emphasize

- **Real-time Data**: All data is current and updates automatically
- **Comprehensive Filtering**: Can analyze by any dimension (date, cost center, employee, status)
- **Automation**: Scheduled reports reduce manual work
- **Audit Trail**: Full history of approvals and changes
- **Scalability**: System handles large volumes of reports and employees
- **User-Friendly**: Intuitive interface reduces training time
- **Compliance**: Ensures proper approval workflow and documentation

### Questions to Address

- "How do we track expenses by department?" → Show cost center filtering
- "Can we see spending trends?" → Show trends section
- "How do we export data for analysis?" → Show CSV export and Report Builder
- "Can reports be automatically sent to us?" → Show scheduled deliveries
- "How do we ensure proper approvals?" → Show approval workflow in Supervisor/Finance portals

---

## Troubleshooting

### Data Not Loading
1. Check internet connection
2. Click "Refresh" button
3. Clear browser cache and reload
4. Check that backend server is running

### Filters Not Working
1. Click "Reset" to clear all filters
2. Re-apply filters one at a time
3. Check date format (YYYY-MM-DD)
4. Ensure date range is logical (start before end)

### Export Not Working
1. Ensure report has been run successfully
2. Check browser download permissions
3. Try different browser if issues persist
4. Check browser console for errors

### Scheduled Reports Not Sending
1. Verify email configuration in system settings
2. Check that schedule is set to "Active"
3. Verify recipient email addresses are correct
4. Check next run time is in the future
5. Use "Run Now" to test schedule manually

---

## Support and Additional Resources

For technical issues or questions:
- Contact your system administrator
- Refer to system documentation
- Check system logs for error messages

**Last Updated:** [Current Date]
**Version:** 1.0

