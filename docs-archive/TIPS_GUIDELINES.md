# 📚 Tips System Guidelines

## Overview
The Oxford House Staff Tracker includes a comprehensive tips system to help users discover and learn about new features. This guide explains how to add tips for new features and pages.

## 🎯 When to Add Tips

### Always Add Tips For:
- ✅ **New Screens/Pages** - Every new screen should have at least one introductory tip
- ✅ **New Features** - Any new functionality should be explained with tips
- ✅ **Complex Workflows** - Multi-step processes benefit from guidance
- ✅ **UI Changes** - Significant interface changes should be explained
- ✅ **New Buttons/Actions** - New interactive elements should have tips

### Tip Categories
- `getting_started` - Basic app usage and new user guidance
- `gps_tracking` - GPS and location-related features
- `receipts` - Receipt scanning and management
- `mileage` - Manual mileage entry and tracking
- `reports` - Reporting and data export features
- `settings` - Configuration and preferences
- `advanced` - Power user features and optimizations

### Tip Priorities
- `high` - Critical features users must know about
- `medium` - Important features that improve user experience
- `low` - Nice-to-know features and optimizations

### Tip Triggers
- `on_load` - Show when screen loads (most common)
- `after_action` - Show after user performs an action
- `manual` - Show only when manually triggered
- `condition_met` - Show when specific conditions are met

## 🛠️ How to Add Tips

### Step 1: Add Tips to TipsService
Edit `src/services/tipsService.ts` and add new tips to the `defaultTips` array:

```typescript
{
  id: 'unique_tip_id',
  title: 'Tip Title 🎯',
  message: 'Detailed explanation of the feature and how to use it.',
  category: 'getting_started', // or appropriate category
  priority: 'medium', // high, medium, or low
  screen: 'YourScreenName', // Screen where tip appears
  trigger: 'on_load', // When to show the tip
  icon: 'material-icon-name', // Optional Material icon
  dismissible: true // Whether user can dismiss
}
```

### Step 2: Add Tips Integration to Screen
In your new screen component, add tips integration:

```typescript
import { useTips } from '../contexts/TipsContext';

export default function YourNewScreen() {
  const { tips, loadTipsForScreen, dismissTip, markTipAsSeen, showTips, setCurrentEmployee } = useTips();
  
  useEffect(() => {
    loadEmployee();
    // Load tips for this screen
    if (showTips) {
      loadTipsForScreen('YourScreenName', 'on_load');
    }
  }, []);

  // In your JSX, add tips display:
  {showTips && tips.length > 0 && (
    <View style={styles.tipsContainer}>
      <ScrollView 
        style={styles.tipsScrollView} 
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {tips.map((tip) => (
          <TipCard
            key={tip.id}
            tip={tip}
            onDismiss={dismissTip}
            onMarkSeen={markTipAsSeen}
          />
        ))}
      </ScrollView>
    </View>
  )}
}
```

### Step 3: Add Required Styles
Add these styles to your screen's StyleSheet:

```typescript
tipsContainer: {
  marginBottom: 16,
},
tipsScrollView: {
  maxHeight: 200,
},
```

## 📋 Checklist for New Features

When creating a new feature, ensure you:

- [ ] **Add introductory tip** explaining the feature
- [ ] **Add usage tip** showing how to use it
- [ ] **Add tips to TipsService** with proper categorization
- [ ] **Integrate tips in screen** with proper loading
- [ ] **Test tips display** on the new screen
- [ ] **Verify tip dismissal** works correctly
- [ ] **Check tip priority** is appropriate
- [ ] **Ensure tip icons** are relevant

## 🎨 Tip Writing Guidelines

### Title Guidelines:
- Keep under 50 characters
- Use action-oriented language
- Include relevant emoji
- Be specific and clear

### Message Guidelines:
- Keep under 200 characters
- Explain the "why" not just the "what"
- Use simple, clear language
- Include specific instructions
- Mention benefits to the user

### Examples:

**Good Title:** "Edit Hours Directly ⏰"
**Bad Title:** "Hours"

**Good Message:** "Tap any day to edit hours. Use the cost center selector if you have multiple cost centers. All changes save automatically."
**Bad Message:** "You can edit hours."

## 🔧 Advanced Tips Features

### Conditional Tips
Add conditions to show tips only when relevant:

```typescript
{
  id: 'advanced_feature_tip',
  title: 'Advanced Feature 🚀',
  message: 'This feature is available when you have multiple cost centers.',
  condition: 'user.hasMultipleCostCenters',
  // ... other properties
}
```

### Action Tips
Add action buttons to tips:

```typescript
{
  id: 'action_tip',
  title: 'Try This Feature 🎯',
  message: 'This feature can help you save time.',
  actionText: 'Try Now',
  // ... other properties
}
```

## 🧪 Testing Tips

### Test Checklist:
- [ ] Tips appear on screen load
- [ ] Tips can be dismissed
- [ ] Tips don't reappear after dismissal
- [ ] Tips show correct content
- [ ] Tips have proper styling
- [ ] Tips work with different user states

### Reset Tips for Testing:
```typescript
// In development, you can reset all tips for testing:
const { resetAllTips } = useTips();
await resetAllTips();
```

## 📊 Tips Analytics

The system tracks:
- Which tips users see
- Which tips users dismiss
- How many times tips are shown
- User completion rates

This data helps improve the tips system and identify areas where users need more guidance.

## 🚀 Future Enhancements

Consider these future improvements:
- **Smart Tips** - AI-powered tips based on user behavior
- **Interactive Tips** - Tips with embedded tutorials
- **Video Tips** - Short video explanations
- **Contextual Tips** - Tips that appear based on user actions
- **Personalized Tips** - Tips tailored to user role and usage patterns

---

## 📝 Quick Reference

**File to Edit:** `src/services/tipsService.ts`
**Context to Use:** `useTips()` from `src/contexts/TipsContext.tsx`
**Component to Use:** `TipCard` from `src/components/TipCard.tsx`

**Required Integration:**
1. Import `useTips`
2. Call `loadTipsForScreen()` in `useEffect`
3. Add tips display JSX
4. Add required styles

**Remember:** Every new feature deserves helpful tips! 🎯
