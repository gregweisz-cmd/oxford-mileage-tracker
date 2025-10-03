#!/bin/bash

# Mobile App Data Sync Test Script
# This script tests the mobile app data sync functionality

echo "🧪 Mobile App Data Sync Test Script"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test functions
test_backend_connection() {
    echo -e "\n${BLUE}1. Testing Backend Connection...${NC}"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/stats)
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ Backend connection successful (HTTP $response)${NC}"
        
        # Get stats
        stats=$(curl -s http://localhost:3002/api/stats)
        echo -e "${BLUE}   Backend Stats: $stats${NC}"
        return 0
    else
        echo -e "${RED}❌ Backend connection failed (HTTP $response)${NC}"
        return 1
    fi
}

test_api_endpoints() {
    echo -e "\n${BLUE}2. Testing API Endpoints...${NC}"
    
    endpoints=("employees" "mileage-entries" "receipts" "time-tracking")
    
    for endpoint in "${endpoints[@]}"; do
        response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/$endpoint)
        
        if [ "$response" = "200" ]; then
            echo -e "${GREEN}✅ /api/$endpoint - OK${NC}"
        else
            echo -e "${RED}❌ /api/$endpoint - Failed (HTTP $response)${NC}"
        fi
    done
}

test_create_test_data() {
    echo -e "\n${BLUE}3. Creating Test Data...${NC}"
    
    # Create test employee
    test_employee='{
        "name": "Sync Test Employee",
        "email": "synctest@example.com",
        "oxfordHouseId": "test-house",
        "position": "Test Position",
        "phoneNumber": "555-9999",
        "baseAddress": "123 Test St, Test City, TC 12345",
        "costCenters": ["TEST-CC"]
    }'
    
    response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d "$test_employee" \
        -w "%{http_code}" \
        http://localhost:3002/api/employees)
    
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✅ Test employee created successfully${NC}"
        
        # Extract employee ID from response
        employee_id=$(echo "${response%???}" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
        echo -e "${BLUE}   Employee ID: $employee_id${NC}"
        
        # Create test mileage entry
        test_mileage='{
            "employeeId": "'$employee_id'",
            "oxfordHouseId": "test-house",
            "date": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
            "odometerReading": 50000,
            "startLocation": "Test Start Location",
            "endLocation": "Test End Location",
            "purpose": "Sync Test Purpose",
            "miles": 25.5,
            "notes": "Test mileage entry for sync testing",
            "hoursWorked": 2.5,
            "isGpsTracked": false
        }'
        
        mileage_response=$(curl -s -X POST -H "Content-Type: application/json" \
            -d "$test_mileage" \
            -w "%{http_code}" \
            http://localhost:3002/api/mileage-entries)
        
        mileage_http_code="${mileage_response: -3}"
        
        if [ "$mileage_http_code" = "200" ] || [ "$mileage_http_code" = "201" ]; then
            echo -e "${GREEN}✅ Test mileage entry created successfully${NC}"
        else
            echo -e "${RED}❌ Test mileage entry creation failed (HTTP $mileage_http_code)${NC}"
        fi
        
    else
        echo -e "${RED}❌ Test employee creation failed (HTTP $http_code)${NC}"
    fi
}

test_data_retrieval() {
    echo -e "\n${BLUE}4. Testing Data Retrieval...${NC}"
    
    # Test employees endpoint
    employees_count=$(curl -s http://localhost:3002/api/employees | grep -o '"id"' | wc -l)
    echo -e "${BLUE}   Total employees: $employees_count${NC}"
    
    # Test mileage entries endpoint
    mileage_count=$(curl -s http://localhost:3002/api/mileage-entries | grep -o '"id"' | wc -l)
    echo -e "${BLUE}   Total mileage entries: $mileage_count${NC}"
    
    # Test receipts endpoint
    receipts_count=$(curl -s http://localhost:3002/api/receipts | grep -o '"id"' | wc -l)
    echo -e "${BLUE}   Total receipts: $receipts_count${NC}"
    
    # Test time tracking endpoint
    time_count=$(curl -s http://localhost:3002/api/time-tracking | grep -o '"id"' | wc -l)
    echo -e "${BLUE}   Total time tracking entries: $time_count${NC}"
}

cleanup_test_data() {
    echo -e "\n${BLUE}5. Cleaning Up Test Data...${NC}"
    
    # Note: In a real implementation, you would need DELETE endpoints
    # For now, we'll just show what would be cleaned up
    echo -e "${YELLOW}⚠️  Note: Test data cleanup requires DELETE endpoints${NC}"
    echo -e "${BLUE}   Test data created:${NC}"
    echo -e "${BLUE}   - Sync Test Employee${NC}"
    echo -e "${BLUE}   - Test mileage entry${NC}"
}

show_test_instructions() {
    echo -e "\n${BLUE}6. Manual Testing Instructions${NC}"
    echo -e "${YELLOW}To complete the sync testing:${NC}"
    echo -e "${BLUE}1. Open mobile app (web or device)${NC}"
    echo -e "${BLUE}2. Navigate to Sync Tester component${NC}"
    echo -e "${BLUE}3. Click 'Test Connection' - should show ✅${NC}"
    echo -e "${BLUE}4. Click 'Create Test Employee' - should create and queue for sync${NC}"
    echo -e "${BLUE}5. Wait 30 seconds for auto-sync${NC}"
    echo -e "${BLUE}6. Click 'Sync to Backend' - should upload all data${NC}"
    echo -e "${BLUE}7. Open web portal at http://localhost:3000${NC}"
    echo -e "${BLUE}8. Navigate to Sync Tester component${NC}"
    echo -e "${BLUE}9. Click 'Refresh Data' - should show mobile data${NC}"
    echo -e "${BLUE}10. Click 'Sync from Backend' in mobile app${NC}"
    echo -e "${BLUE}11. Verify bidirectional sync works${NC}"
}

# Main test execution
main() {
    echo -e "${YELLOW}Starting mobile app data sync tests...${NC}"
    
    # Run tests
    test_backend_connection
    if [ $? -eq 0 ]; then
        test_api_endpoints
        test_create_test_data
        test_data_retrieval
        cleanup_test_data
        show_test_instructions
        
        echo -e "\n${GREEN}🎉 Backend API tests completed!${NC}"
        echo -e "${YELLOW}Next: Test mobile app sync components manually${NC}"
    else
        echo -e "\n${RED}❌ Backend not available. Please start the backend server first:${NC}"
        echo -e "${BLUE}   cd admin-web/backend && npm start${NC}"
        exit 1
    fi
}

# Run main function
main
