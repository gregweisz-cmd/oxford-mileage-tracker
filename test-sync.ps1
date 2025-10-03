# Mobile App Data Sync Test Script (PowerShell)
# This script tests the mobile app data sync functionality

Write-Host "🧪 Mobile App Data Sync Test Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Test functions
function Test-BackendConnection {
    Write-Host "`n1. Testing Backend Connection..." -ForegroundColor Blue
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3002/api/stats" -Method Get
        Write-Host "✅ Backend connection successful" -ForegroundColor Green
        Write-Host "   Backend Stats: $($response | ConvertTo-Json -Compress)" -ForegroundColor Blue
        return $true
    }
    catch {
        Write-Host "❌ Backend connection failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-ApiEndpoints {
    Write-Host "`n2. Testing API Endpoints..." -ForegroundColor Blue
    
    $endpoints = @("employees", "mileage-entries", "receipts", "time-tracking")
    
    foreach ($endpoint in $endpoints) {
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:3002/api/$endpoint" -Method Get
            Write-Host "✅ /api/$endpoint - OK" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ /api/$endpoint - Failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

function Test-CreateTestData {
    Write-Host "`n3. Creating Test Data..." -ForegroundColor Blue
    
    # Create test employee
    $testEmployee = @{
        name = "Sync Test Employee $(Get-Date -Format 'yyyyMMddHHmmss')"
        email = "synctest$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
        oxfordHouseId = "test-house"
        position = "Test Position"
        phoneNumber = "555-9999"
        baseAddress = "123 Test St, Test City, TC 12345"
        costCenters = @("TEST-CC")
    }
    
    try {
        $employeeResponse = Invoke-RestMethod -Uri "http://localhost:3002/api/employees" -Method Post -Body ($testEmployee | ConvertTo-Json) -ContentType "application/json"
        Write-Host "✅ Test employee created successfully" -ForegroundColor Green
        Write-Host "   Employee ID: $($employeeResponse.id)" -ForegroundColor Blue
        
        # Create test mileage entry
        $testMileage = @{
            employeeId = $employeeResponse.id
            oxfordHouseId = "test-house"
            date = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            odometerReading = 50000
            startLocation = "Test Start Location"
            endLocation = "Test End Location"
            purpose = "Sync Test Purpose"
            miles = 25.5
            notes = "Test mileage entry for sync testing"
            hoursWorked = 2.5
            isGpsTracked = $false
        }
        
        $mileageResponse = Invoke-RestMethod -Uri "http://localhost:3002/api/mileage-entries" -Method Post -Body ($testMileage | ConvertTo-Json) -ContentType "application/json"
        Write-Host "✅ Test mileage entry created successfully" -ForegroundColor Green
        
    }
    catch {
        Write-Host "❌ Test data creation failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Test-DataRetrieval {
    Write-Host "`n4. Testing Data Retrieval..." -ForegroundColor Blue
    
    try {
        # Test employees endpoint
        $employees = Invoke-RestMethod -Uri "http://localhost:3002/api/employees" -Method Get
        Write-Host "   Total employees: $($employees.Count)" -ForegroundColor Blue
        
        # Test mileage entries endpoint
        $mileageEntries = Invoke-RestMethod -Uri "http://localhost:3002/api/mileage-entries" -Method Get
        Write-Host "   Total mileage entries: $($mileageEntries.Count)" -ForegroundColor Blue
        
        # Test receipts endpoint
        $receipts = Invoke-RestMethod -Uri "http://localhost:3002/api/receipts" -Method Get
        Write-Host "   Total receipts: $($receipts.Count)" -ForegroundColor Blue
        
        # Test time tracking endpoint
        $timeTracking = Invoke-RestMethod -Uri "http://localhost:3002/api/time-tracking" -Method Get
        Write-Host "   Total time tracking entries: $($timeTracking.Count)" -ForegroundColor Blue
        
    }
    catch {
        Write-Host "❌ Data retrieval failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Show-TestInstructions {
    Write-Host "`n5. Manual Testing Instructions" -ForegroundColor Blue
    Write-Host "To complete the sync testing:" -ForegroundColor Yellow
    Write-Host "1. Open mobile app (web or device)" -ForegroundColor Blue
    Write-Host "2. Navigate to Sync Tester component" -ForegroundColor Blue
    Write-Host "3. Click 'Test Connection' - should show ✅" -ForegroundColor Blue
    Write-Host "4. Click 'Create Test Employee' - should create and queue for sync" -ForegroundColor Blue
    Write-Host "5. Wait 30 seconds for auto-sync" -ForegroundColor Blue
    Write-Host "6. Click 'Sync to Backend' - should upload all data" -ForegroundColor Blue
    Write-Host "7. Open web portal at http://localhost:3000" -ForegroundColor Blue
    Write-Host "8. Navigate to Sync Tester component" -ForegroundColor Blue
    Write-Host "9. Click 'Refresh Data' - should show mobile data" -ForegroundColor Blue
    Write-Host "10. Click 'Sync from Backend' in mobile app" -ForegroundColor Blue
    Write-Host "11. Verify bidirectional sync works" -ForegroundColor Blue
}

# Main test execution
function Main {
    Write-Host "Starting mobile app data sync tests..." -ForegroundColor Yellow
    
    # Run tests
    if (Test-BackendConnection) {
        Test-ApiEndpoints
        Test-CreateTestData
        Test-DataRetrieval
        Show-TestInstructions
        
        Write-Host "`n🎉 Backend API tests completed!" -ForegroundColor Green
        Write-Host "Next: Test mobile app sync components manually" -ForegroundColor Yellow
    }
    else {
        Write-Host "`n❌ Backend not available. Please start the backend server first:" -ForegroundColor Red
        Write-Host "   cd admin-web/backend && npm start" -ForegroundColor Blue
        exit 1
    }
}

# Run main function
Main
