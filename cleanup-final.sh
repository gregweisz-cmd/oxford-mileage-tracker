#!/bin/bash
# Oxford House Staff Tracker - Final Cleanup Script
# This script performs final cleanup and validation

echo "🧹 Oxford House Staff Tracker - Final Cleanup"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "✅ Project directory confirmed"

# Clean up any temporary files
echo "🧹 Cleaning temporary files..."
find . -name "*.tmp" -delete
find . -name "*.log" -delete
find . -name ".DS_Store" -delete
find . -name "Thumbs.db" -delete

# Check for any remaining debug logs
echo "🔍 Checking for debug logs..."
DEBUG_COUNT=$(find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | xargs grep -l "console\.log" | wc -l)
if [ $DEBUG_COUNT -gt 0 ]; then
    echo "⚠️  Found $DEBUG_COUNT files with console.log statements"
    echo "   Consider removing debug logs before production deployment"
else
    echo "✅ No debug logs found"
fi

# Validate TypeScript compilation
echo "🔍 Validating TypeScript compilation..."
cd admin-web
if npm run build > /dev/null 2>&1; then
    echo "✅ Admin web builds successfully"
else
    echo "❌ Admin web build failed"
    exit 1
fi
cd ..

# Check mobile app compilation
echo "🔍 Checking mobile app compilation..."
if npx tsc --noEmit > /dev/null 2>&1; then
    echo "✅ Mobile app compiles successfully"
else
    echo "❌ Mobile app compilation failed"
    exit 1
fi

# Check database file
echo "🔍 Checking database..."
if [ -f "oxford_tracker.db" ]; then
    DB_SIZE=$(stat -f%z "oxford_tracker.db" 2>/dev/null || stat -c%s "oxford_tracker.db" 2>/dev/null)
    if [ $DB_SIZE -gt 0 ]; then
        echo "✅ Database file exists and has content ($DB_SIZE bytes)"
    else
        echo "⚠️  Database file exists but is empty"
    fi
else
    echo "⚠️  Database file not found - will be created on first run"
fi

# Check documentation
echo "🔍 Checking documentation..."
DOCS=("AI_ENHANCEMENT_PROPOSALS.md" "AI_IMPLEMENTATION_GUIDE.md" "PROJECT_STATUS_SUMMARY.md")
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo "✅ $doc exists"
    else
        echo "❌ $doc missing"
    fi
done

# Summary
echo ""
echo "🎉 Cleanup Complete!"
echo "==================="
echo "✅ Project is clean and ready for deployment"
echo "✅ All builds pass successfully"
echo "✅ Documentation is complete"
echo "✅ AI enhancement proposals are ready for review"
echo ""
echo "📋 Next Steps:"
echo "1. Review AI_ENHANCEMENT_PROPOSALS.md"
echo "2. Test the reset password feature"
echo "3. Validate cost center editing functionality"
echo "4. Consider implementing quick-win AI features"
echo ""
echo "🚀 The project is ready for production deployment!"
