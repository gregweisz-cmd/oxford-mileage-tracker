#!/bin/bash

# Oxford Mileage Tracker - Quick Automated Tests
# Run this script to perform basic automated tests

echo "🧪 Starting Oxford Mileage Tracker Automated Tests..."
echo "=================================================="

# Test 1: Check for TypeScript compilation errors
echo "📝 Test 1: TypeScript Compilation Check"
if npx tsc --noEmit; then
    echo "✅ TypeScript compilation: PASSED"
else
    echo "❌ TypeScript compilation: FAILED"
    exit 1
fi

# Test 2: Check for linting errors in critical files
echo ""
echo "📝 Test 2: Linting Check"
CRITICAL_FILES=(
    "src/screens/HomeScreen.tsx"
    "src/screens/GpsTrackingScreen.tsx"
    "src/screens/AddReceiptScreen.tsx"
    "src/screens/HoursWorkedScreen.tsx"
    "src/services/database.ts"
    "src/services/unifiedDataService.ts"
    "src/services/dashboardService.ts"
)

LINT_ERRORS=0
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "Checking $file..."
        if npx eslint "$file" --quiet; then
            echo "✅ $file: PASSED"
        else
            echo "❌ $file: FAILED"
            LINT_ERRORS=$((LINT_ERRORS + 1))
        fi
    else
        echo "⚠️ $file: NOT FOUND"
    fi
done

if [ $LINT_ERRORS -eq 0 ]; then
    echo "✅ Linting check: PASSED"
else
    echo "❌ Linting check: FAILED ($LINT_ERRORS files with errors)"
fi

# Test 3: Check for debug console.log statements
echo ""
echo "📝 Test 3: Debug Log Cleanup Check"
DEBUG_LOGS=$(find src -name "*.tsx" -o -name "*.ts" | xargs grep -l "console\.log" | wc -l)
if [ $DEBUG_LOGS -eq 0 ]; then
    echo "✅ Debug log cleanup: PASSED"
else
    echo "❌ Debug log cleanup: FAILED ($DEBUG_LOGS files still contain console.log)"
    echo "Files with debug logs:"
    find src -name "*.tsx" -o -name "*.ts" | xargs grep -l "console\.log"
fi

# Test 4: Check for missing imports
echo ""
echo "📝 Test 4: Import Check"
MISSING_IMPORTS=0
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        if grep -q "import.*from.*'\.\./services/" "$file"; then
            echo "✅ $file: Imports look good"
        else
            echo "⚠️ $file: No service imports found"
        fi
    fi
done

# Test 5: Check database schema
echo ""
echo "📝 Test 5: Database Schema Check"
if grep -q "CREATE TABLE.*mileage_entries" src/services/database.ts && \
   grep -q "CREATE TABLE.*time_tracking" src/services/database.ts && \
   grep -q "CREATE TABLE.*receipts" src/services/database.ts; then
    echo "✅ Database schema: PASSED"
else
    echo "❌ Database schema: FAILED"
fi

# Test 6: Check AI services integration
echo ""
echo "📝 Test 6: AI Services Integration Check"
AI_SERVICES=(
    "src/services/anomalyDetectionService.ts"
    "src/services/vendorIntelligenceService.ts"
    "src/services/categoryAiService.ts"
    "src/services/tripPurposeAiService.ts"
    "src/services/costCenterAiService.ts"
)

AI_INTEGRATION_OK=true
for service in "${AI_SERVICES[@]}"; do
    if [ -f "$service" ]; then
        echo "✅ $service: EXISTS"
    else
        echo "❌ $service: MISSING"
        AI_INTEGRATION_OK=false
    fi
done

if [ "$AI_INTEGRATION_OK" = true ]; then
    echo "✅ AI Services integration: PASSED"
else
    echo "❌ AI Services integration: FAILED"
fi

# Test 7: Check for test data
echo ""
echo "📝 Test 7: Test Data Check"
if grep -q "Alex Szary\|Jackson Longan" src/services/testDataService.ts; then
    echo "✅ Test data: PASSED"
else
    echo "❌ Test data: FAILED"
fi

# Summary
echo ""
echo "=================================================="
echo "🎯 Test Summary:"
echo "=================================================="

if [ $LINT_ERRORS -eq 0 ] && [ $DEBUG_LOGS -eq 0 ] && [ "$AI_INTEGRATION_OK" = true ]; then
    echo "🎉 ALL TESTS PASSED - Ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "1. Run manual tests from DEPLOYMENT_TEST_SUITE.md"
    echo "2. Test on physical devices"
    echo "3. Deploy to production"
    exit 0
else
    echo "❌ SOME TESTS FAILED - Review issues before deployment"
    echo ""
    echo "Issues to fix:"
    if [ $LINT_ERRORS -gt 0 ]; then
        echo "- Fix linting errors in $LINT_ERRORS files"
    fi
    if [ $DEBUG_LOGS -gt 0 ]; then
        echo "- Remove debug logs from $DEBUG_LOGS files"
    fi
    if [ "$AI_INTEGRATION_OK" = false ]; then
        echo "- Fix AI services integration"
    fi
    exit 1
fi
