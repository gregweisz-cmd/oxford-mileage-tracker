# Content Guide for PDF How-To Templates

This document outlines the specific content that should be included in each portal template.

## Template Structure

All templates follow this structure:
1. Cover Page
2. Table of Contents
3. Quick Start Guide
4. Comprehensive Reference
5. Tips & Best Practices
6. Troubleshooting
7. Footer

## Supervisor Portal Content

### Quick Start
- Accessing supervisor portal (portal switcher)
- Approving first report (step-by-step)
- Viewing team dashboard (KPIs overview)

### Comprehensive Reference
- **Portal Overview**: Tabs (Approvals, Reports, Team, Analytics)
- **Team Dashboard**: KPIs, pending reviews, monthly totals
- **Viewing Team Reports**: Filtering, search, status indicators
- **Report Approval**: Review process, approve button, certification
- **Requesting Revisions**: Select items, add comments, send revision request
- **Individual Employee Reports**: Viewing detailed reports, navigation
- **Analytics**: Team performance metrics, approval rates
- **Notifications**: Approval alerts, revision requests
- **Team Management**: Viewing team members, assignments

### Tips & Best Practices
- When to approve vs request revision
- Reviewing report completeness
- Managing team performance
- Response time expectations

### Troubleshooting
- Can't see team members
- Approval button not working
- Reports not showing up
- Filter/search issues

## Finance Portal Content

### Quick Start
- Accessing finance portal
- Exporting first report (PDF with maps)
- Understanding report statuses

### Comprehensive Reference
- **Portal Overview**: Tabs, report builder
- **Report Builder**: Advanced filtering (employee, date range, status, cost center, state)
- **Viewing Reports**: Detailed report view, navigation
- **PDF Export**: Export dialog, map view modes (by day, by cost center), Google Maps integration
- **Excel Export**: Export to Excel format
- **Analytics**: Reports & Analytics tab, statistics, charts
- **Per Diem Rules**: Managing per diem rules
- **Cost Center Management**: View-only access
- **Map View Modes**: Understanding by day vs by cost center
- **Notifications**: Finance-specific alerts

### Tips & Best Practices
- When to use different export formats
- Understanding Google Maps integration
- Filtering large datasets efficiently
- Export best practices

### Troubleshooting
- Export failing
- Maps not showing
- Filter not working
- Report builder issues

## Admin Portal Content

### Quick Start
- Accessing admin portal
- Creating first employee
- Managing cost centers

### Comprehensive Reference
- **Portal Overview**: All tabs (Employee Management, Supervisor Management, Cost Centers, Reports & Analytics, System Settings)
- **Employee Management**:
  - **Sync from HR API** (Individual Management tab): One-click sync of current employees from the external HR API (Appwarmer). Creates or updates employees by email, assigns cost centers from HR. **HR is the source of truth**—any local employee not in the HR list is archived. Requires `EMPLOYEE_API_TOKEN` (or `APPWARMER_EMPLOYEE_API_TOKEN`) in the backend environment (local `.env` or Render → backend service → Environment). See `admin-web/backend/docs/HR_SYNC_SETUP.md`.
  - Creating employees (form fields, validation)
  - Editing employee records
  - Bulk operations (import/export CSV)
  - Archiving employees
  - Viewing archived employees (and restoring if needed)
  - Password management (reset, set)
- **Supervisor Management**:
  - Assigning supervisors
  - Managing supervisor relationships
  - Bulk supervisor assignment
- **Cost Center Management**:
  - Creating cost centers
  - Editing cost centers
  - Enabling/disabling Google Maps per cost center
  - Cost center codes and names
- **Reports & Analytics**: System-wide reporting, analytics dashboards
- **System Settings**: Configuration options, system preferences

### Tips & Best Practices
- Best practices for employee management
- Cost center organization
- Bulk import tips
- Supervisor assignment strategies

### Troubleshooting
- Employee creation issues
- Import errors
- System configuration problems
- Bulk operation failures

## Contracts Portal Content

### Quick Start
- Accessing contracts portal
- Reviewing reports for audit
- Understanding audit workflow

### Comprehensive Reference
- **Portal Overview**: Tabs (All Reports, Pending Review, Approved, Needs Revision, Reports & Analytics)
- **Report Filtering**: Advanced filters for audit purposes
- **Quarterly Audit Workflow**: Step-by-step audit process
- **Report Review Process**: Reviewing reports, checking compliance
- **Exporting for Audit**: Export options for audit documentation

### Tips & Best Practices
- Audit preparation
- Report review checklist
- Compliance verification
- Documentation best practices

### Troubleshooting
- Missing reports
- Export issues
- Filter problems
- Access issues

## Screenshot Requirements

Each template includes screenshot placeholders. Key screenshots needed:

### Supervisor Portal
- Portal overview with tabs
- Team dashboard with KPIs
- Approvals tab with pending reports
- Report approval dialog
- Revision request dialog

### Finance Portal
- Portal overview
- Report builder with filters
- PDF export dialog with map options
- Analytics dashboard
- Per diem rules management

### Admin Portal
- Portal overview
- Employee Management interface
- **Sync from HR API** button (Individual Management tab)
- Employee creation form
- Bulk import interface
- Cost Center Management
- System Settings

### Contracts Portal
- Portal overview
- Report filtering interface
- Audit review interface
- Export options

## Mobile App Content (additions)

### Go to today
- **Daily Hours & Descriptions**: A “Go to today” control in the month navigation scrolls the view to today’s date. Use it when viewing another month to jump back to today.
- **Per Diem**: A “Go to today” control in the month navigation does the same—scrolls to today’s row when viewing the current month, or switches to the current month then scrolls.

### Screenshot note
- When capturing `daily-hours-screen.png` and `per-diem-screen.png`, include the “Go to today” control in the frame so the how-to matches the current UI.

## Content Updates

When updating templates:
1. Keep the same structure and styling
2. Update content to match current features
3. Replace screenshot placeholders with actual images
4. Test PDF generation after updates
5. Update version number and date
