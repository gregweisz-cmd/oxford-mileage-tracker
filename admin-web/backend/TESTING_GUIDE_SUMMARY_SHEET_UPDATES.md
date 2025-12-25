# Testing Guide - Summary Sheet Updates

## 🎯 What Was Changed

1. **Removed Edit Buttons** - Mileage and Per Diem are now read-only
2. **Removed Meals Row** - Meals category removed (included in Per Diem)
3. **Receipt Validation** - Warning when entered amounts don't match receipt totals
4. **Other Expenses Enhancement** - Now supports multiple entries with descriptions
5. **UI Improvements** - All category names centered and proper case formatting
6. **PDF Export** - Other Expenses descriptions appear below entries
7. **Receipt Auto-Population** - Summary Sheet automatically populates from receipts when added/edited
8. **Cost Center Selection** - When editing Summary Sheet amounts, users can select which cost center the edit is for
9. **Receipt Image Improvements** - Fixed broken image display, added edit capability with fallback placeholders
10. **Personalized Portal Naming** - Staff Portal now shows personalized name (e.g., "Greg's Portal")
11. **Preferred Name Clarification** - Clear notes throughout app explaining preferred name usage

---

## Test 1: Summary Sheet Editing - Read-Only Fields

### Steps:
1. **Login to Staff Portal**
   - Navigate to http://localhost:3000
   - Login with a staff account
   - Navigate to Staff Portal → Summary Sheet tab

2. **Verify Read-Only Fields**
   - **Mileage**: Should NOT have an edit button (pencil icon)
   - **Per Diem**: Should NOT have an edit button (pencil icon)
   - Both should display values but be non-editable

3. **Verify Editable Fields**
   - All other categories SHOULD have edit buttons:
     - Air / Rail / Bus ✅
     - Vehicle Rental / Fuel ✅
     - Parking / Tolls ✅
     - Ground Transportation ✅
     - Lodging ✅
     - Phone / Internet / Fax ✅
     - Shipping / Postage ✅
     - Printing / Copying ✅
     - Office Supplies ✅
     - Oxford House E.E.S. ✅

### Expected Results:
- ✅ Mileage has NO edit button
- ✅ Per Diem has NO edit button
- ✅ All other categories have edit buttons

---

## Test 2: Meals Row Removal

### Steps:
1. **Navigate to Summary Sheet**
   - Go to Staff Portal → Summary Sheet tab

2. **Verify Meals Row is Gone**
   - Scroll through the expense categories
   - Look for "Meals" or "MEALS" row
   - Verify it does NOT exist

3. **Verify Other Expenses Section**
   - Find "Other Expenses" section header
   - Verify it's the last section before subtotals

### Expected Results:
- ✅ No "Meals" row anywhere in the table
- ✅ Other Expenses section is present

---

## Test 3: Receipt Validation

### Steps:
1. **Add Receipts First**
   - Go to Receipts tab
   - Add a receipt with category "Air / Rail / Bus" for $50.00
   - Add another receipt with category "Parking" for $25.00

2. **Test Edit with Matching Amount**
   - Go to Summary Sheet tab
   - Click edit button on "Air / Rail / Bus"
   - Enter amount: $50.00
   - Click Save
   - Verify NO warning appears
   - Verify amount saves successfully

3. **Test Edit with Non-Matching Amount**
   - Click edit button on "Air / Rail / Bus"
   - Enter amount: $75.00 (different from receipt total)
   - Click Save
   - Verify warning dialog appears:
     - "Warning: The amount you entered ($75.00) does not match your receipt total for this category ($50.00). Do you want to proceed anyway?"
   - Click "Cancel"
   - Verify amount is NOT saved
   - Click edit again, enter $75.00, click "OK" on warning
   - Verify amount saves

### Expected Results:
- ✅ No warning when amount matches receipt total
- ✅ Warning appears when amount doesn't match
- ✅ User can proceed or cancel
- ✅ Amount saves correctly after confirmation

---

## Test 4: Other Expenses - Multiple Entries with Descriptions

### Steps:
1. **Add First Other Expense**
   - Go to Summary Sheet tab
   - Scroll to "Other Expenses" section
   - Click "+ ADD OTHER EXPENSE" button
   - Enter amount: $100.00
   - Enter description: "Conference registration fee"
   - Click "Add"
   - Verify entry appears in table:
     - Shows "Other Expenses 1"
     - Shows amount: $100.00
     - Has edit and delete buttons

2. **Test Tooltip**
   - Hover over "Other Expenses 1" text
   - Verify tooltip appears showing: "Conference registration fee"
   - If description is long (>30 chars), verify it's truncated in display but full in tooltip

3. **Add Second Other Expense**
   - Click "+ ADD OTHER EXPENSE" button again
   - Enter amount: $50.00
   - Enter description: "Equipment purchase"
   - Click "Add"
   - Verify both entries appear:
     - "Other Expenses 1" - $100.00
     - "Other Expenses 2" - $50.00
   - Verify total shows: $150.00

4. **Edit Other Expense**
   - Click edit button on "Other Expenses 1"
   - Change amount to $120.00
   - Change description to "Updated conference fee"
   - Click "Save"
   - Verify changes appear in table
   - Verify tooltip shows updated description

5. **Delete Other Expense**
   - Click delete button on "Other Expenses 2"
   - Confirm deletion
   - Verify entry is removed
   - Verify total updates to $120.00

6. **Test Empty State**
   - Delete all Other Expenses entries
   - Verify message appears: "No other expenses added"
   - Verify "Add Other Expense" button is still visible

### Expected Results:
- ✅ Can add multiple Other Expenses entries
- ✅ Each entry can have a description
- ✅ Tooltips show descriptions on hover
- ✅ Can edit existing entries
- ✅ Can delete entries
- ✅ Total calculates correctly
- ✅ Empty state displays correctly

---

## Test 5: UI Formatting - Centered and Proper Case

### Steps:
1. **Check Category Names**
   - Navigate to Summary Sheet tab
   - Verify all section headers use proper case:
     - "Transportation" (not "TRANSPORTATION")
     - "Lodging" (not "LODGING")
     - "Per Diem" (not "PER DIEM")
     - "Communications" (not "COMMUNICATIONS")
     - "Supplies" (not "SUPPLIES")
     - "Other Expenses" (not "OTHER EXPENSES")

2. **Check Alignment**
   - Verify all category names are centered in their cells
   - Verify Mileage is centered (no edit button)
   - Verify Per Diem is centered (no edit button)
   - Verify all editable categories are centered (with edit buttons)

3. **Check Consistency**
   - All category names should use Title Case (first letter capitalized)
   - No ALL CAPS text except for section headers in grey background

### Expected Results:
- ✅ All section headers use proper case
- ✅ All category names are centered
- ✅ Consistent formatting throughout

---

## Test 6: PDF Export - Other Expenses Descriptions

### Steps:
1. **Add Other Expenses with Descriptions**
   - Add at least 2 Other Expenses entries with descriptions
   - Example:
     - Entry 1: $100.00 - "Conference registration"
     - Entry 2: $50.00 - "Equipment purchase"

2. **Export PDF**
   - Click "Export PDF" or "Print" button
   - Generate the Summary Sheet PDF

3. **Verify PDF Content**
   - Open the PDF
   - Navigate to Summary Sheet page
   - Find "Other Expenses" section
   - Verify entries appear in table:
     - "Other Expenses 1" - $100.00
     - "Other Expenses 2" - $50.00
   - Scroll below the table
   - Verify descriptions appear below entries:
     - "Other Expenses 1: Conference registration"
     - "Other Expenses 2: Equipment purchase"

4. **Verify Grand Total**
   - Check that grand total includes Other Expenses amounts
   - Verify calculation is correct

### Expected Results:
- ✅ Other Expenses entries appear in PDF table
- ✅ Descriptions appear below table entries
- ✅ Grand total includes Other Expenses
- ✅ Formatting is clean and readable

---

## Test 7: Footer Section - Removed Heading

### Steps:
1. **Navigate to Summary Sheet**
   - Scroll to bottom of Summary Sheet tab

2. **Verify Footer Section**
   - Should see "Payable to:" field
   - Should see "Base Address #1:" field
   - Should see "City, State Zip:" field
   - Should see Signature box
   - Should NOT see "GRAND TOTAL REQUESTED" heading above these fields

3. **Verify Grand Total Location**
   - Grand total should only appear in the subtotals table above
   - Should NOT appear again in footer section

### Expected Results:
- ✅ No "GRAND TOTAL REQUESTED" heading in footer
- ✅ Footer starts directly with "Payable to:"
- ✅ Clean, uncluttered footer section

---

## Test 8: Data Persistence

### Steps:
1. **Make Multiple Changes**
   - Edit several expense categories
   - Add multiple Other Expenses entries
   - Save all changes

2. **Refresh Page**
   - Press F5 or refresh browser
   - Verify all changes persist:
     - Edited amounts are still there
     - Other Expenses entries are still there
     - Descriptions are still there

3. **Check Backend**
   - Open browser DevTools → Network tab
   - Refresh page
   - Look for GET request to load expense report
   - Verify response includes:
     - Updated expense amounts
     - `otherExpenses` array with descriptions

### Expected Results:
- ✅ All changes persist after refresh
- ✅ Other Expenses array is saved correctly
- ✅ Descriptions are preserved

---

## Test Checklist

### Summary Sheet Editing
- [ ] Mileage has NO edit button
- [ ] Per Diem has NO edit button
- [ ] All other categories have edit buttons
- [ ] Meals row is removed
- [ ] Receipt validation works (warning appears)
- [ ] Can proceed or cancel validation warning

### Other Expenses
- [ ] Can add multiple Other Expenses entries
- [ ] Description field appears in edit dialog
- [ ] Tooltips show descriptions on hover
- [ ] Can edit existing entries
- [ ] Can delete entries
- [ ] Total calculates correctly
- [ ] Empty state displays correctly

### UI Formatting
- [ ] All section headers use proper case
- [ ] All category names are centered
- [ ] Consistent formatting throughout

### PDF Export
- [ ] Other Expenses entries appear in PDF
- [ ] Descriptions appear below entries in PDF
- [ ] Grand total includes Other Expenses

### Footer
- [ ] No "GRAND TOTAL REQUESTED" heading in footer
- [ ] Footer is clean and uncluttered

### Data Persistence
- [ ] All changes persist after refresh
- [ ] Other Expenses array saves correctly

---

## Issues to Report

When testing, note any:
- Errors in browser console
- Errors in backend logs
- UI/UX issues
- Validation problems
- Data persistence issues
- PDF export problems
- Tooltip not appearing
- Alignment issues

---

**Status**: Ready for testing

**Last Updated**: December 19, 2025 - All presentation feedback features completed including:
- Summary Sheet editing with receipt validation and auto-population
- Cost center selection for edits
- Receipt image viewing/editing improvements
- Personalized portal naming
- Preferred name clarifications
- Multiple Other Expenses entries with descriptions

