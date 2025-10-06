# Oxford Mileage Tracker - Debug Log Cleanup Script
# This script removes console.log statements from core files

Write-Host "🧹 Starting debug log cleanup..." -ForegroundColor Green

# List of core files to clean
$coreFiles = @(
    "src\screens\HomeScreen.tsx",
    "src\screens\GpsTrackingScreen.tsx", 
    "src\screens\AddReceiptScreen.tsx",
    "src\screens\HoursWorkedScreen.tsx",
    "src\screens\MileageEntryScreen.tsx",
    "src\services\database.ts",
    "src\services\unifiedDataService.ts",
    "src\services\dashboardService.ts"
)

$totalCleaned = 0

foreach ($file in $coreFiles) {
    if (Test-Path $file) {
        Write-Host "Cleaning $file..." -ForegroundColor Yellow
        
        # Read file content
        $content = Get-Content $file -Raw
        
        # Count console.log statements before cleanup
        $beforeCount = ([regex]::Matches($content, "console\.log")).Count
        
        # Remove console.log statements (including multi-line ones)
        $cleanedContent = $content -replace "console\.log\([^)]*\);?\s*", ""
        $cleanedContent = $cleanedContent -replace "console\.log\([^)]*\);?\s*\n", ""
        
        # Count console.log statements after cleanup
        $afterCount = ([regex]::Matches($cleanedContent, "console\.log")).Count
        $removed = $beforeCount - $afterCount
        
        if ($removed -gt 0) {
            # Write cleaned content back to file
            Set-Content $file -Value $cleanedContent -NoNewline
            Write-Host "  ✅ Removed $removed console.log statements" -ForegroundColor Green
            $totalCleaned += $removed
        } else {
            Write-Host "  ℹ️ No console.log statements found" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ❌ File not found: $file" -ForegroundColor Red
    }
}

Write-Host "`n🎉 Cleanup complete!" -ForegroundColor Green
Write-Host "Total console.log statements removed: $totalCleaned" -ForegroundColor Cyan

# Verify cleanup
Write-Host "`n🔍 Verifying cleanup..." -ForegroundColor Blue
$remainingLogs = 0
foreach ($file in $coreFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $count = ([regex]::Matches($content, "console\.log")).Count
        if ($count -gt 0) {
            Write-Host "  ⚠️ $file still has $count console.log statements" -ForegroundColor Yellow
            $remainingLogs += $count
        }
    }
}

if ($remainingLogs -eq 0) {
    Write-Host "✅ All debug logs cleaned successfully!" -ForegroundColor Green
} else {
    Write-Host "⚠️ $remainingLogs console.log statements still remain" -ForegroundColor Yellow
}

Write-Host "`n🚀 Ready for testing!" -ForegroundColor Magenta
