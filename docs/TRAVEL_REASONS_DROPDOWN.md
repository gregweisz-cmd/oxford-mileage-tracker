# Travel Reasons Dropdown - Comprehensive List

This document outlines the comprehensive list of travel reasons/purposes to be used in the dropdown menus for both GPS Tracking and Manual Entry screens.

## Proposed Travel Reasons List

### House/Resident Related
- House Stabilization

### Donations & Supplies
- Donation Pickup
- Donation Delivery

### Meetings & Training
- Team Meeting
- Staff Meeting
- Staff Training
- Community Outreach

### Emergency & Special Situations
- Emergency response
- Crisis intervention
- Urgent visit

### Travel & Logistics
- Return to BA
- Travel between locations
- Route optimization

### Other
- Other (with free text option)
- Custom (allows manual entry)

## Implementation Notes

1. **Dropdown Structure**: 
   - Primary dropdown with categorized options
   - "Other" option that allows free text entry
   - Recent selections at the top (if applicable)

2. **Default Selection**: 
   - No default - user must select
   - Most common: "House stabilization" or "Resident meeting"

3. **Validation**: 
   - Required field
   - If "Other" is selected, require text input

4. **Data Consistency**: 
   - Store exact dropdown value in database
   - Allow for future additions without breaking existing data

5. **User Experience**:
   - Searchable/filterable dropdown
   - Show most frequently used at top
   - Allow custom entry for edge cases

## Implementation (Done)

- **Backend:** `travel_reasons` table and CRUD API:
  - `GET /api/travel-reasons` – list (public, used by mobile and web)
  - `POST /api/admin/travel-reasons` – add (admin)
  - `PUT /api/admin/travel-reasons/:id` – update (admin)
  - `DELETE /api/admin/travel-reasons/:id` – remove (admin)
- **Admin Portal:** “Travel Reasons” tab in Admin Portal – add, edit, remove options, optional category and sort order.
- **Mobile:** Purpose dropdown on GPS Tracking and Manual Entry. Options come from the API; “Other” opens a text field for custom purpose. If the API returns no options, the app falls back to the previous free-text Purpose field.

## Daily Description Options (Same Pattern)

Daily descriptions use the same dropdown pattern for simpler reporting:

- **Backend:** `daily_description_options` table and CRUD API:
  - `GET /api/daily-description-options` – list (public)
  - `POST /api/admin/daily-description-options` – add (admin)
  - `PUT /api/admin/daily-description-options/:id` – update (admin)
  - `DELETE /api/admin/daily-description-options/:id` – remove (admin)
- **Admin Portal:** "Daily Description Options" tab in Admin Portal – add, edit, remove options.
- **Mobile:** Description dropdown on Hours & Description screen when not Day Off. Options from API; "Other" opens custom text. Fallback: Quick Menu + free-text when no options.
- **Web:** Daily Entries description column in Staff Portal uses an Autocomplete (dropdown + type) when options exist; otherwise the original TextField.

## Questions to Consider

1. Should we group these by category in the dropdown (with headers)?
2. Should we track usage frequency and show most common at top?
3. Should "Other" allow free text, or should we have a separate "Custom" option?
4. Do we need different lists for different employee roles/positions?
