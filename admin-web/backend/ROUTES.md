# API Routes Documentation

Complete list of API endpoints organized by domain.

## Base URL
- Local: `http://localhost:3002/api`
- Production: `https://oxford-mileage-backend.onrender.com/api`

## Authentication Routes (`routes/auth.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | User login |
| POST | `/api/logout` | User logout |
| POST | `/api/verify-token` | Verify authentication token |

## Employee Routes (`routes/employees.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | Get all employees (with filters) |
| GET | `/api/employees/archived` | Get archived employees |
| GET | `/api/employees/:id` | Get employee by ID |
| POST | `/api/employees` | Create new employee |
| PUT | `/api/employees/:id` | Update employee |
| DELETE | `/api/employees/:id` | Delete employee |
| PUT | `/api/employees/bulk-update` | Bulk update employees |
| DELETE | `/api/employees/bulk-delete` | Bulk delete employees |
| POST | `/api/employees/bulk-create` | Bulk create employees |
| POST | `/api/employees/:id/archive` | Archive employee |
| POST | `/api/employees/:id/restore` | Restore archived employee |
| PUT | `/api/employees/:id/password` | Update employee password |
| GET | `/api/current-employees` | Get active employees |
| GET | `/api/supervisors` | Get all supervisors |
| GET | `/api/supervisors/:supervisorId/team` | Get supervisor's team |

## Data Entry Routes (`routes/dataEntries.js`)

### Mileage Entries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mileage-entries` | Get mileage entries |
| POST | `/api/mileage-entries` | Create mileage entry |
| PUT | `/api/mileage-entries/:id` | Update mileage entry |
| DELETE | `/api/mileage-entries/:id` | Delete mileage entry |

### Receipts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/receipts` | Get receipts |
| POST | `/api/receipts` | Create receipt |
| PUT | `/api/receipts/:id` | Update receipt |
| DELETE | `/api/receipts/:id` | Delete receipt |
| POST | `/api/receipts/upload-image` | Upload receipt image |
| POST | `/api/receipts/ocr` | Extract text from receipt image (OCR) |

### Time Tracking
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/time-tracking` | Get time entries |
| POST | `/api/time-tracking` | Create time entry |
| PUT | `/api/time-tracking/:id` | Update time entry |
| DELETE | `/api/time-tracking/:id` | Delete time entry |

### Daily Descriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/daily-descriptions` | Get daily descriptions |
| POST | `/api/daily-descriptions` | Create daily description |
| DELETE | `/api/daily-descriptions/:id` | Delete daily description |

## Expense Report Routes (`routes/expenseReports.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/expense-reports` | Get expense reports |
| GET | `/api/expense-reports/:id` | Get expense report by ID |
| GET | `/api/expense-reports/:id/detailed` | Get detailed report data |
| POST | `/api/expense-reports` | Create expense report |
| PUT | `/api/expense-reports/:id` | Update expense report |
| DELETE | `/api/expense-reports/:id` | Delete expense report |
| POST | `/api/expense-reports/:id/submit` | Submit report for approval |
| POST | `/api/monthly-reports` | Create/update monthly report |
| GET | `/api/monthly-reports/:employeeId/:year/:month` | Get monthly report |
| GET | `/api/biweekly-reports` | Get biweekly reports |

## Dashboard Routes (`routes/dashboard.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard-preferences/:userId` | Get user dashboard preferences |
| PUT | `/api/dashboard-preferences/:userId` | Save dashboard preferences |
| GET | `/api/dashboard-statistics` | Get dashboard statistics |

## Admin Reporting Routes (`routes/dashboard.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/reporting/overview` | Admin reporting overview |
| GET | `/api/admin/reporting/trends` | Reporting trends data |
| GET | `/api/admin/reporting/map-data` | Map visualization data |
| GET | `/api/admin/reporting/report-builder/fields` | Report builder fields |
| GET | `/api/admin/reporting/report-builder/presets` | Get report presets |
| POST | `/api/admin/reporting/report-builder/presets` | Create report preset |
| PUT | `/api/admin/reporting/report-builder/presets/:id` | Update report preset |
| DELETE | `/api/admin/reporting/report-builder/presets/:id` | Delete report preset |
| POST | `/api/admin/reporting/report-builder/query` | Execute report query |
| GET | `/api/admin/reporting/schedules` | Get report schedules |
| POST | `/api/admin/reporting/schedules` | Create report schedule |
| PUT | `/api/admin/reporting/schedules/:id` | Update report schedule |
| DELETE | `/api/admin/reporting/schedules/:id` | Delete report schedule |
| POST | `/api/admin/reporting/schedules/:id/trigger` | Trigger schedule manually |

## Cost Center Routes (`routes/costCenters.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cost-centers` | Get all cost centers |
| GET | `/api/per-diem-rules` | Get per diem rules |
| POST | `/api/per-diem-rules` | Create per diem rule |
| PUT | `/api/per-diem-rules/:id` | Update per diem rule |
| DELETE | `/api/per-diem-rules/:id` | Delete per diem rule |

## Approval Routes (`routes/approval.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/approvals/pending` | Get pending approvals |
| POST | `/api/approvals/:reportId/approve` | Approve report |
| POST | `/api/approvals/:reportId/reject` | Reject report |
| POST | `/api/approvals/:reportId/request-revision` | Request revision |
| GET | `/api/approvals/history` | Get approval history |

## Supervisor Routes (`routes/supervisor.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/supervisor/dashboard` | Get supervisor dashboard |
| GET | `/api/supervisor/team/:supervisorId` | Get supervisor's team |

## Notification Routes (`routes/notifications.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get notifications |
| POST | `/api/notifications` | Create notification |
| PUT | `/api/notifications/:id/read` | Mark notification as read |
| GET | `/api/messages` | Get messages |
| POST | `/api/messages` | Send message |

## Utility Routes (`routes/utility.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Server statistics |
| GET | `/api/health` | Health check |
| GET | `/api/saved-addresses` | Get saved addresses |
| GET | `/api/oxford-houses` | Get Oxford Houses list |

## System Routes (`routes/system.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/system/init-database` | Initialize database |
| GET | `/api/system/settings` | Get system settings |
| PUT | `/api/system/settings` | Update system settings |
| POST | `/api/system/backup` | Create database backup |

## Export Routes (`routes/export.js`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/export/pdf/:reportId` | Export report as PDF |
| GET | `/api/export/excel/:reportId` | Export report as Excel |

## Weekly/Biweekly Reports

- Weekly reports: `routes/weeklyReports.js`
- Biweekly reports: `routes/biweeklyReports.js`

## Response Format

### Success Response
```json
{
  "data": {...},
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "error": "Error message",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "path": "/api/endpoint",
  "method": "GET"
}
```

## Authentication

Most endpoints require authentication via headers:
- `x-user-id`: Current user's ID
- `x-user-role`: User's role (admin, supervisor, employee)

## WebSocket Endpoints

- `/ws` - WebSocket connection for real-time updates
- Messages broadcast data changes to connected clients

