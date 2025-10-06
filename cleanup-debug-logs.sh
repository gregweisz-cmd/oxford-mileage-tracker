#!/bin/bash

# Script to remove debug console.log statements from React Native files
# This removes lines containing console.log but keeps console.error for actual error handling

echo "🧹 Cleaning up debug logs..."

# List of files to clean
FILES=(
  "src/screens/HomeScreen.tsx"
  "src/screens/AddReceiptScreen.tsx"
  "src/screens/GpsTrackingScreen.tsx"
  "src/screens/MileageEntryScreen.tsx"
  "src/screens/ReceiptsScreen.tsx"
  "src/screens/DailyDescriptionScreen.tsx"
  "src/screens/HoursWorkedScreen.tsx"
  "src/screens/TimeTrackingScreen.tsx"
  "src/screens/SettingsScreen.tsx"
  "src/services/database.ts"
  "src/services/costCenterAiService.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Cleaning $file..."
    
    # Remove console.log lines but keep console.error
    # This uses a more sophisticated approach to avoid removing console.error
    sed -i '/console\.log/d' "$file"
    
    echo "✅ Cleaned $file"
  else
    echo "⚠️ File not found: $file"
  fi
done

echo "🎉 Debug log cleanup complete!"
