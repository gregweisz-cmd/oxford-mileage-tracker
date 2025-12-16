# Features & Files Table of Contents

This document provides an overview of all features and files created/modified during recent development sessions.

---

## 📋 Table of Contents

1. [Smart Notifications Feature](#smart-notifications-feature)
2. [Cost Center Auto-Selection Feature](#cost-center-auto-selection-feature)
3. [Receipt Photo Quality Warning Feature](#receipt-photo-quality-warning-feature)
4. [Per Diem Dashboard Widget Feature](#per-diem-dashboard-widget-feature)
5. [Onboarding Flow](#onboarding-flow)
6. [Testing Documentation](#testing-documentation)
7. [Modified Files](#modified-files)

---

## 🎯 Smart Notifications Feature

### Purpose
Provides contextual, intelligent reminders and alerts to users based on their activity and report status.

### Files Created

#### `src/services/smartNotificationService.ts`
**Type**: Service/Utility  
**Description**: Core service that generates smart notifications based on various conditions and user data.  
**Key Features**:
- Checks for missing receipt photos on large expenses (>$50)
- Sends month-end reminders (3 days before)
- Detects per diem eligibility (8+ hours worked AND 100+ miles driven, OR overnight stay 50+ miles from base)
- Monitors report approval status
- Uses `DatabaseService` to fetch relevant data
- Returns structured notification objects with priority levels
- Uses Haversine formula to calculate distance from base address for overnight per diem checks

**Interfaces**:
- `SmartNotification`: Defines notification structure (id, type, priority, title, message, actionLabel, actionRoute, timestamp)

**Methods**:
- `checkNotifications(employeeId)`: Main method that orchestrates all notification checks
- `checkMissingReceipts(employeeId)`: Finds large expenses without receipt photos
- `checkMonthEndReminder(employeeId)`: Alerts users before month-end
- `checkPerDiemEligibility(employeeId)`: Detects per diem opportunities (work hours + mileage OR overnight distance)
- `checkReportStatus(employeeId)`: Notifies about pending approvals (status: 'submitted')
- `calculateDistance(lat1, lon1, lat2, lon2)`: Private helper using Haversine formula

---

## 🎯 Cost Center Auto-Selection Feature

### Purpose
Automatically suggests and selects cost centers for mileage entries based on previous usage patterns.

### Files Created

#### `src/services/costCenterAutoSelectionService.ts`
**Type**: Service/Utility  
**Description**: Service that provides intelligent cost center suggestions based on historical data and employee preferences.  
**Key Features**:
- Suggests cost centers based on same destination (most frequently used cost center for that location)
- Falls back to most frequently used cost center overall
- Uses employee's default cost center as final fallback
- Calculates location similarity for fuzzy matching
- Returns suggestions with confidence levels and reasons

**Interfaces**:
- `CostCenterSuggestion`: Contains cost center, reason (same_destination | most_frequent | default), and confidence level

**Methods**:
- `getSuggestion(employeeId, endLocation, employee?)`: Main method that returns the best cost center suggestion
- `getSuggestionReasonText(suggestion)`: Converts suggestion reason to human-readable text
- `calculateLocationSimilarity(loc1, loc2)`: Private method that calculates similarity between location strings

**Strategy Priority**:
1. Same destination (exact or 80%+ similarity match)
2. Most frequently used cost center overall
3. Employee's default cost center
4. First selected cost center (fallback)

---

## 🎯 Receipt Photo Quality Warning Feature

### Purpose
Analyzes receipt photo quality and provides non-intrusive warnings to help users capture better quality images for OCR and record-keeping.

### Files Created

#### `src/services/receiptPhotoQualityService.ts`
**Type**: Service/Utility  
**Description**: Service that analyzes receipt photo quality and provides feedback on resolution, file size, orientation, and other quality metrics.  
**Key Features**:
- Checks image resolution (minimum 800px, recommended 1200px+)
- Analyzes file size (flags if < 30KB AND low resolution)
- Detects extreme aspect ratios (flags >2.5:1 landscape or >4:1 portrait)
- Calculates quality score (0-100)
- Provides actionable suggestions for improvement
- Uses Expo FileSystem legacy API for file operations
- Uses React Native Image API for dimension checking

**Interfaces**:
- `PhotoQualityResult`: Contains isValid, score (0-100), issues, warnings, suggestions
- `PhotoQualityIssue`: Contains type, severity (low | medium | high), message

**Methods**:
- `analyzePhotoQuality(imageUri)`: Main method that analyzes photo and returns quality result
- `getImageDimensions(imageUri)`: Private helper to get image width/height
- `checkResolution(dimensions)`: Private helper to check resolution thresholds
- `getQualityMessage(result)`: Returns user-friendly quality message (only shows if score < 70)
- `getPrimarySuggestion(result)`: Returns primary suggestion for improvement

**Quality Checks**:
- **Resolution**: Minimum 800px, recommended 1200px+ (medium severity if significantly below recommended)
- **File Size**: Only flags if < 30KB AND resolution is low (avoids false positives from cropped images)
- **Orientation**: Only flags extreme aspect ratios (>2.5:1 landscape, >4:1 portrait)

**Quality Score Thresholds**:
- Score < 70: Shows warning message
- Score < 60: Shows medium severity messages
- Score < 50: Shows high severity (red) warning

---

## 🎯 Per Diem Dashboard Widget Feature

### Purpose
Displays Per Diem statistics and eligibility information on the home screen dashboard to help users track their monthly per diem usage.

### Files Created

#### `src/services/perDiemDashboardService.ts`
**Type**: Service/Utility  
**Description**: Service that calculates and provides comprehensive Per Diem statistics for dashboard display.  
**Key Features**:
- Calculates current month Per Diem total
- Fetches monthly limit from PerDiemRulesService based on employee's cost center
- Calculates remaining balance and percentage used
- Analyzes eligibility for the month
- Checks if eligible today with reason
- Projects month-end total based on current average
- Determines status (safe | warning | limit_reached)
- Falls back to default limit (350) if no rule found

**Interfaces**:
- `PerDiemDashboardStats`: Contains currentMonthTotal, monthlyLimit, remaining, percentUsed, daysEligible, daysClaimed, isEligibleToday, todayEligibilityReason, receipts, averagePerDay, projectedMonthEnd, status

**Methods**:
- `getPerDiemStats(employee, month, year)`: Main method that returns comprehensive Per Diem statistics
- `analyzeEligibilityForMonth(employee, month, year)`: Private method to analyze eligibility for entire month
- `checkEligibilityForToday(employee)`: Private method to check today's eligibility
- `getEmptyStats()`: Returns empty stats object with default values

**Status Logic**:
- `limit_reached`: currentMonthTotal >= monthlyLimit
- `warning`: currentMonthTotal >= monthlyLimit * 0.85
- `safe`: Otherwise

#### `src/components/PerDiemWidget.tsx`
**Type**: React Native Component  
**Description**: Dashboard widget component that displays Per Diem statistics in a visual, interactive card format.  
**Key Features**:
- Displays current month total with status-based color coding
- Shows progress bar with percentage used
- Displays monthly limit and remaining balance
- Shows status badges (limit reached, warning, eligible today)
- Displays days eligible vs days claimed (if provided)
- Navigates to filtered receipts view on press
- Includes safety checks for division by zero

**Props**:
- `currentTotal`: Current month Per Diem total
- `monthlyLimit`: Monthly Per Diem limit
- `daysEligible`: Number of eligible days (optional)
- `daysClaimed`: Number of days claimed (optional)
- `isEligibleToday`: Whether eligible today (optional)
- `onPress`: Callback when widget is pressed
- `colors`: Optional color overrides (card, text, textSecondary)

**Status Colors**:
- **Red** (#f44336): Limit reached
- **Orange** (#FF9800): Approaching limit (85%+)
- **Green** (#4CAF50): Good status or eligible today

**UI Elements**:
- Header with restaurant icon and "Per Diem" label
- Large amount display with status color
- Progress bar with fill percentage
- Status badge with icon and message
- Days statistics (if provided)

---

## 🎯 Onboarding Flow

### Purpose
Provides a guided first-time user experience for both mobile app and web portal.

### Files Created

#### `admin-web/src/components/OnboardingScreen.tsx`
**Type**: React Component (Web)  
**Description**: Interactive onboarding carousel component for the web portal.  
**Key Features**:
- Multi-step carousel interface with navigation
- Slides covering: Mileage Tracking, Receipt Capture, Time Logging, Report Generation, Smart Per Diem
- Dynamic background colors per slide
- Skip and Back/Next navigation
- Completion callback to mark onboarding as done
- Stores completion status in `localStorage`

**Props**:
- `onComplete`: Callback function triggered when user completes onboarding

**Slides**:
1. Mileage Tracking
2. Receipt Capture
3. Time Logging
4. Report Generation
5. Smart Per Diem

---

## 📚 Testing Documentation

### Files Created

#### `SMART_NOTIFICATIONS_TESTING.md`
**Type**: Documentation  
**Description**: Comprehensive guide for manually testing each type of smart notification.  
**Contents**:
- Step-by-step instructions for triggering each notification type
- Expected behaviors and outcomes
- Edge cases and special scenarios
- Troubleshooting tips

**Notification Types Covered**:
- Missing Receipt Photos
- Month-End Reminder
- Per Diem Eligibility
- Report Approval Status

#### `REAL_TIME_TESTING_GUIDE.md`
**Type**: Documentation  
**Description**: Quick reference guide for testing smart notifications with real data in the app.  
**Contents**:
- Quick test steps for each notification type
- Minimum data requirements
- Expected results
- Tips for creating test scenarios

---

## 📝 Modified Files

### Mobile App (React Native)

#### `src/screens/HomeScreen.tsx`
**Modifications**:
- Added smart notifications display section
- Integrated `SmartNotificationService` to check for notifications
- Added notification state management (`smartNotifications`, `dismissedNotifications`)
- Created UI components for displaying notifications with priority-based styling
- Added dismiss and action handlers for notifications
- Modified `refreshLocalDataOnly` to refresh notifications when returning to home screen
- **Per Diem Dashboard Widget Integration**:
  - Imported `PerDiemWidget` component and `PerDiemDashboardService`
  - Added `perDiemStats` state to store Per Diem statistics
  - Integrated `PerDiemDashboardService.getPerDiemStats` in `loadData` function
  - Always renders `PerDiemWidget` (removed conditional rendering)
  - Widget navigates to Receipts screen filtered by 'Per Diem' category
  - Uses optional chaining for default values
- **Month/Year Navigation to ReceiptsScreen**:
  - Modified `handleViewReceipts` to pass `selectedMonth` and `selectedYear` parameters
  - Modified Per Diem widget `onPress` to pass `selectedMonth`, `selectedYear`, and `filterCategory: 'Per Diem'`
  - Modified "Other Receipts" stat card `onPress` to pass `selectedMonth` and `selectedYear`

**New State**:
- `smartNotifications`: Array of active notifications
- `dismissedNotifications`: Set of dismissed notification IDs
- `perDiemStats`: Per Diem statistics object

**New Functions**:
- `checkSmartNotifications(employeeId)`: Fetches and filters notifications
- `handleDismissNotification(id)`: Dismisses a notification
- `handleNotificationAction(notification)`: Handles notification action buttons

#### `src/screens/MileageEntryScreen.tsx`
**Modifications**:
- Integrated `CostCenterAutoSelectionService` for automatic cost center selection
- Added auto-selection state management (`costCenterSuggestion`, `isCostCenterAutoSelected`)
- Created `useEffect` hook that auto-selects cost center when end location changes (debounced 500ms)
- Enhanced cost center selector UI with:
  - Badge showing suggestion reason
  - Sparkle icon on auto-selected option
  - Manual override capability
- Added new styles for auto-selection indicators

**New State**:
- `costCenterSuggestion`: Current suggestion object
- `isCostCenterAutoSelected`: Boolean flag for auto-selection status

**New useEffect**:
- Watches `formData.endLocation` changes and auto-selects cost center after 500ms debounce

**New UI Components**:
- `labelRow`: Container for label and auto-selected badge
- `autoSelectedBadge`: Badge showing why cost center was suggested
- Sparkle icon on auto-selected cost center option

#### `src/screens/AddReceiptScreen.tsx`
**Modifications**:
- **Receipt Photo Quality Warning Integration**:
  - Imported `ReceiptPhotoQualityService` and `PhotoQualityResult`
  - Added `photoQualityResult` and `dismissedQualityWarning` states
  - Integrated quality analysis in `takePicture` and `selectFromGallery` functions
  - Added quality warning banner UI below receipt image
  - Warning displays only if score < 70 and not dismissed
  - Color-coded warnings (orange for score < 70, red for score < 50)
  - Includes dismiss button and actionable suggestions
  - Added debug logging for quality analysis results
- **Per Diem Photo and Vendor Optional**:
  - Modified `validateForm` to make `imageUri` and `formData.vendor` optional if category is 'Per Diem'
  - Modified `handleSave` and `proceedWithSave` to allow saving without photo/vendor for Per Diem
  - Updated UI labels to show "(Optional)" for photo and vendor when category is 'Per Diem'
  - Defaults `imageUri` to empty string and `vendor` to 'Per Diem' or 'Rental Car Fuel' when saving
- **Cost Center Auto-Selection Fix**:
  - Removed calls to non-existent `CostCenterAutoSelectionService.suggestCostCenter` and `saveLastUsedCostCenter`
  - Implemented custom logic to suggest cost center based on most frequently used cost center from past receipts
  - Falls back to employee's `defaultCostCenter` or first `selectedCostCenters`
  - Added null check for `receipt.costCenter` to resolve TypeScript errors

**New State**:
- `photoQualityResult`: Photo quality analysis result
- `dismissedQualityWarning`: Boolean flag to track if user dismissed the warning

**New UI Components**:
- Quality warning banner with color-coded styling
- Dismiss button for quality warnings

**New Styles**:
- `qualityWarning`, `qualityWarningHigh`: Warning banner containers
- `qualityWarningContent`, `qualityWarningText`: Warning text styling
- `qualityWarningTitle`, `qualityWarningTitleHigh`: Warning title styling
- `qualityWarningSuggestion`: Suggestion text styling
- `qualityWarningDismiss`: Dismiss button styling

#### `src/screens/ReceiptsScreen.tsx`
**Modifications**:
- **Month/Year Filtering**:
  - Updated `ReceiptsScreenProps` interface to include `route` with `selectedMonth`, `selectedYear`, and `filterCategory` params
  - Destructured `navigation` and `route` from props
  - Initialized `selectedMonth`, `selectedYear`, and `filterCategory` from `route.params`, defaulting to current month/year if not provided
  - Modified `useEffect` and `useFocusEffect` dependencies to include these params
  - Updated `loadData` to call `DatabaseService.getReceipts(employee.id, selectedMonth, selectedYear)` with specific month/year
  - Added logic to further filter receipts by `filterCategory` if provided
  - Updated header title to display selected month/year and category filter
  - Modified `generateMonthlyReceiptsPdf` to use `selectedMonth` and `selectedYear` instead of current date

**New Props/Params**:
- `route.params.selectedMonth`: Month to filter receipts (1-12)
- `route.params.selectedYear`: Year to filter receipts
- `route.params.filterCategory`: Optional category filter (e.g., 'Per Diem')

**Updated Functions**:
- `loadData`: Now filters by month/year and optionally by category
- `generateMonthlyReceiptsPdf`: Uses selected month/year instead of current date

### Web Portal (React)

#### `admin-web/src/App.tsx`
**Modifications**:
- Integrated `OnboardingScreen` component
- Added `showOnboarding` state to control onboarding visibility
- Modified login flow to check for `hasCompletedOnboarding` in `localStorage`
- Conditionally renders onboarding screen before main portal if not completed
- Sets `hasCompletedOnboarding` flag in `localStorage` when onboarding completes

**New Logic**:
- Checks `localStorage.getItem('hasCompletedOnboarding')` on login
- Shows onboarding if flag is not set or is false
- Hides onboarding and shows portal once onboarding is completed

---

## 🔗 Dependencies

### Services Used
- `DatabaseService`: For fetching mileage entries, receipts, time tracking, and monthly reports
- `PerDiemRulesService`: For fetching Per Diem rules and monthly limits
- `debugLog`: For conditional logging
- `getCostCenters`: For loading available cost centers

### Expo Modules Used
- `expo-file-system/legacy`: For file system operations (photo quality checks)
- `expo-image-picker`: For camera and gallery access

### React Native APIs Used
- `Image`: For getting image dimensions (photo quality checks)

### Types Used
- `MileageEntry`
- `Employee`
- `Receipt`
- `TimeTracking`
- `MonthlyReport`
- `LocationDetails`

---

## 📊 Feature Summary

| Feature | Type | Status | Priority |
|---------|------|--------|----------|
| Smart Notifications | New Service + UI | ✅ Complete | High |
| Cost Center Auto-Selection | New Service + UI | ✅ Complete | Medium |
| Receipt Photo Quality Warning | New Service + UI | ✅ Complete | Medium |
| Per Diem Dashboard Widget | New Service + Component | ✅ Complete | Medium |
| Optional Photo/Vendor for Per Diem | Feature Enhancement | ✅ Complete | Medium |
| Month/Year Receipt Filtering | Feature Enhancement | ✅ Complete | Medium |
| Web Onboarding | New Component | ✅ Complete | High |
| Mobile Onboarding | Not Implemented | ⏳ Pending | Medium |
| Testing Documentation | Documentation | ✅ Complete | Low |

---

## 🚀 Next Steps / Future Enhancements

1. **Mobile Onboarding Flow**: Create onboarding component for React Native mobile app
2. **Setup Wizard**: Create profile/preferences setup wizard
3. **Sample Data**: Add feature to populate sample data for exploring features

---

## 📖 Usage Examples

### Using Smart Notifications
```typescript
import { SmartNotificationService } from '../services/smartNotificationService';

const notifications = await SmartNotificationService.checkNotifications(employeeId);
// Returns array of SmartNotification objects
```

### Using Cost Center Auto-Selection
```typescript
import { CostCenterAutoSelectionService } from '../services/costCenterAutoSelectionService';

const suggestion = await CostCenterAutoSelectionService.getSuggestion(
  employeeId,
  endLocation,
  employee
);
// Returns CostCenterSuggestion | null
```

### Using Receipt Photo Quality Service
```typescript
import { ReceiptPhotoQualityService } from '../services/receiptPhotoQualityService';

const qualityResult = await ReceiptPhotoQualityService.analyzePhotoQuality(imageUri);
// Returns PhotoQualityResult with score, issues, warnings, suggestions

if (qualityResult.score < 70) {
  // Show warning to user
  console.log(ReceiptPhotoQualityService.getQualityMessage(qualityResult));
  console.log(ReceiptPhotoQualityService.getPrimarySuggestion(qualityResult));
}
```

### Using Per Diem Dashboard Service
```typescript
import { PerDiemDashboardService } from '../services/perDiemDashboardService';

const stats = await PerDiemDashboardService.getPerDiemStats(employee, month, year);
// Returns PerDiemDashboardStats with comprehensive Per Diem statistics
```

### Using Per Diem Widget Component
```typescript
import PerDiemWidget from '../components/PerDiemWidget';

<PerDiemWidget
  currentTotal={stats.currentMonthTotal}
  monthlyLimit={stats.monthlyLimit}
  daysEligible={stats.daysEligible}
  daysClaimed={stats.daysClaimed}
  isEligibleToday={stats.isEligibleToday}
  onPress={() => navigation.navigate('Receipts', { filterCategory: 'Per Diem' })}
/>
```

---

*Last Updated: December 2024*
