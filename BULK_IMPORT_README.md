# Employee Bulk Import System

## Overview

The Employee Bulk Import System provides comprehensive employee management capabilities for the Oxford House Admin Portal. It includes individual employee management, bulk import from CSV files, and mass operations for efficient employee administration.

## Features

### 1. Individual Employee Management
- **Add Employee**: Create new employees one at a time with full form validation
- **Edit Employee**: Update existing employee information
- **Delete Employee**: Remove employees with confirmation
- **View All Employees**: Comprehensive table view with sorting and filtering

### 2. Bulk Import from CSV
- **CSV Upload**: Upload employee data from CSV files
- **Template Download**: Download a pre-formatted CSV template
- **Data Preview**: Preview imported data before processing
- **Validation**: Comprehensive data validation with error reporting
- **Batch Processing**: Process multiple employees simultaneously

### 3. Mass Operations
- **Multi-Select**: Select multiple employees for bulk operations
- **Bulk Edit**: Update multiple employees with the same changes
- **Bulk Delete**: Remove multiple employees at once
- **Select All/Clear**: Quick selection controls

### 4. Data Export
- **Export Current Employees**: Download existing employee data as CSV
- **Template Generation**: Create import templates with current data structure

## CSV Format

The system expects CSV files with the following columns:

| Column | Description | Required | Example |
|--------|-------------|----------|---------|
| EMPLOYEE_ID | Unique identifier for the employee | Yes | `5d60325822954e074a4cf6e1` |
| FULL_NAME | Employee's full name | Yes | `John Smith` |
| WORK_EMAIL | Employee's email address | Yes | `john.smith@oxfordhouse.org` |
| EMPLOYEE_TITLE | Job title/position | Yes | `Outreach Worker` |
| PHONE | Phone number | No | `1234567890` |
| COST_CENTER | Cost center(s) - comma separated | Yes | `IL-STATE, MN-STATE` |
| ROLE_LEVEL | Additional role information | No | `Senior` |

### Cost Center Format

Cost centers can be specified in several formats:
- **Single**: `IL-STATE`
- **Multiple**: `IL-STATE, MN-STATE, WI-STATE`
- **Complex**: `NC.F-SOR` (for specific programs)
- **Special**: `Program Services`, `Finance`, `G&A`, `Fundraising`

## API Endpoints

### Employee Management
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Create single employee
- `PUT /api/employees/:id` - Update single employee
- `DELETE /api/employees/:id` - Delete single employee

### Bulk Operations
- `POST /api/employees/bulk-create` - Create multiple employees
- `PUT /api/employees/bulk-update` - Update multiple employees
- `DELETE /api/employees/bulk-delete` - Delete multiple employees

## Usage Instructions

### 1. Accessing the Admin Portal

1. Navigate to the Admin Web Portal
2. Login with admin credentials (Greg Weisz: `greg.weisz@oxfordhouse.org`)
3. Select "Employee Management" tab

### 2. Individual Employee Management

1. Click "Add Employee" to create a new employee
2. Fill in the required information
3. Click "Save" to create the employee
4. Use the table to view, edit, or delete existing employees

### 3. Bulk Import Process

1. **Prepare CSV File**:
   - Use the provided template or create your own
   - Ensure all required fields are populated
   - Use proper cost center format

2. **Upload and Preview**:
   - Click "Upload CSV File"
   - Select your prepared CSV file
   - Review the preview table for accuracy

3. **Import**:
   - Click "Import Employees" to process the data
   - Review the import results
   - Address any errors if they occur

### 4. Mass Operations

1. **Select Employees**:
   - Use checkboxes to select individual employees
   - Use "Select All" to select all employees
   - Use "Clear Selection" to deselect all

2. **Bulk Edit**:
   - Click "Bulk Edit Selected"
   - Choose fields to update
   - Click "Apply to X Employees"

3. **Bulk Delete**:
   - Click "Delete Selected"
   - Confirm the deletion

## Password Generation

The system automatically generates passwords using the format: `{FirstName}welcome1`

Examples:
- `John Smith` → `Johnwelcome1`
- `Mary Johnson` → `Marywelcome1`

## Error Handling

The system provides comprehensive error reporting:

- **Validation Errors**: Missing required fields, invalid formats
- **Duplicate Errors**: Employees with existing email addresses
- **Database Errors**: Connection or constraint violations
- **Import Summary**: Success/failure counts with detailed error messages

## Security Features

- **Role-Based Access**: Only admin users can access bulk import features
- **Data Validation**: Comprehensive input validation
- **Audit Trail**: All operations are logged
- **Confirmation Dialogs**: Prevent accidental deletions

## Sample Data

A sample CSV file (`sample_employees.csv`) is provided with 30+ real Oxford House employees for testing purposes.

## Technical Implementation

### Frontend Components
- `EmployeeManagementComponent.tsx` - Main management interface
- `AdminPortal.tsx` - Admin portal wrapper
- `BulkImportService.ts` - CSV parsing and validation
- `EmployeeApiService.ts` - API communication

### Backend Endpoints
- Express.js server with SQLite database
- Bulk operation endpoints for efficient processing
- Comprehensive error handling and validation

### Database Schema
The system uses the existing `employees` table with additional fields:
- `selectedCostCenters` - JSON array of assigned cost centers
- `defaultCostCenter` - Primary cost center for the employee

## Troubleshooting

### Common Issues

1. **CSV Upload Fails**:
   - Check file format (must be .csv)
   - Ensure all required columns are present
   - Verify data format matches expected types

2. **Import Errors**:
   - Review error messages in the import results
   - Check for duplicate email addresses
   - Verify cost center format

3. **Permission Errors**:
   - Ensure you're logged in as an admin user
   - Check user role in the system

### Support

For technical support or questions about the bulk import system, contact the development team or refer to the system documentation.
