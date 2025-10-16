# Per Diem and UI Improvements

## Summary of Changes

### 1. Auto-Set Per Diem to $35 ✅

**Problem:**
- When adding a Per Diem receipt, users had to manually enter $35
- This was prone to errors and inconsistencies

**Solution:**
- Modified `handleInputChange()` in `AddReceiptScreen.tsx` to automatically set the amount to "35" when "Per Diem" category is selected
- User can still edit the amount if needed, but it starts at the correct $35 value

**Files Changed:**
- `src/screens/AddReceiptScreen.tsx`
  - Line 235-241: Added auto-fill logic when Per Diem category is selected

**How It Works:**
```typescript
if (field === 'category' && value === 'Per Diem') {
  setFormData(prev => ({ ...prev, [field]: value, amount: '35' }));
}
```

### 2. Moved "Add Receipt" Button to Tile Layout ✅

**Problem:**
- "Add Receipt" button was a "+" icon in the top right corner
- Not as prominent or discoverable as desired
- Inconsistent with the tile-based action buttons on other screens

**Solution:**
- Removed the "+" button from the header (except in multi-select mode where it shows Clear/Delete buttons)
- Added a prominent green "Add Receipt" tile button next to "Generate Monthly PDF"
- Both buttons are now equal-sized tiles with icons and text

**Files Changed:**
- `src/screens/ReceiptsScreen.tsx`
  - Line 287-298: Removed "+" button from header (only shows multi-select buttons now)
  - Line 317-334: Replaced PDF buttons container with action buttons container
  - Line 640-684: Updated styles for new button layout

**Visual Layout:**
```
┌─────────────────────────┬─────────────────────────┐
│  + Add Receipt          │  📄 Generate Monthly PDF│
│  (Green)                │  (Red)                  │
└─────────────────────────┴─────────────────────────┘
```

**Button Colors:**
- **Add Receipt**: Green (#4CAF50) - Positive action
- **Generate Monthly PDF**: Red (#f44336) - Important action

## Testing

### Test Per Diem Auto-Fill:
1. Go to Receipts screen
2. Tap "Add Receipt"
3. Select "Per Diem" category
4. **Expected**: Amount field automatically fills with "35"

### Test New Button Layout:
1. Go to Receipts screen
2. **Expected**: See two equal-sized tile buttons at the top
3. Tap "Add Receipt" button
4. **Expected**: Opens Add Receipt screen
5. Go back, tap "Generate Monthly PDF"
6. **Expected**: Generates PDF as before

### Test Multi-Select Mode:
1. Go to Receipts screen
2. Tap "Select" button
3. **Expected**: Header shows Clear and Delete buttons (no Add Receipt in header)
4. Tap "Cancel"
5. **Expected**: Returns to normal view with Add Receipt tile visible

## User Benefits

1. **Faster Per Diem Entry**: No need to type $35 every time
2. **More Discoverable**: Large green button is easier to find than small "+" icon
3. **Consistent UX**: Matches tile-button pattern used throughout the app
4. **Professional Appearance**: Clean, modern button layout

## Technical Notes

- The Per Diem auto-fill happens in the `handleInputChange` function before state is updated
- Users can still manually change the amount if needed (though $35 is the standard)
- The button layout uses flexbox with `flex: 1` so both buttons are equal width
- Multi-select mode still works correctly with dedicated Clear/Delete buttons in the header
- All changes maintain backward compatibility with existing receipt data

