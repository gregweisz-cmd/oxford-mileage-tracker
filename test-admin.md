# Admin Page Testing Guide

## Quick Access
1. Open app in Expo Go
2. Login as Jackson Longan (demo manager)
3. Tap "Employee Management" on home screen

## Test Files Created
- `test-employee-import.csv` - Valid employee data for import testing
- `test-mileage-import.csv` - Valid mileage data for import testing  
- `test-employee-errors.csv` - Invalid data for error testing

## Key Features to Test

### 1. Employee Management
- View employee list (Jackson, Alex, Greg)
- Filter by cost center and state
- Search by name/email/position
- Select employees for bulk operations

### 2. Excel Export
- Tap download icon (📥) in header
- Select data types to export
- Generate and share Excel files
- Verify exported data is correct

### 3. Template Generation
- Tap template icon (📄) in header
- Generate Employee template
- Generate Mileage template
- Check templates contain instructions and examples

### 4. Import Functionality
- Tap upload icon (📤) in header
- Select import type (Employee/Mileage)
- Choose CSV file from device
- Watch import progress
- Review import results and errors

### 5. Error Handling
- Try importing invalid CSV files
- Check error messages are clear
- Verify validation works correctly

## Expected Results
- All buttons should be responsive
- Modals should open and close properly
- Excel files should generate and share
- Import should validate data correctly
- Error messages should be helpful

## Troubleshooting
- If buttons don't work, check console for errors
- If Excel generation fails, check xlsx library installation
- If import fails, check CSV file format
- If file picker doesn't work, check expo-document-picker installation




