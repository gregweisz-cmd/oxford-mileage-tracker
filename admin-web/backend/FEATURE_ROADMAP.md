# Feature Roadmap - Oxford House Mileage Tracker

## Overview
This document outlines the upcoming features and improvements based on recent presentation feedback. These enhancements will improve usability, add new functionality, and enhance safety features for our expense tracking system.

---

## 1. Summary Sheet Editing
**Status:** ✅ Completed  
**Priority:** High

Staff members can now edit expense amounts directly in the Summary Sheet. This allows for manual adjustments when needed, with validation to ensure accuracy. Includes receipt validation warnings, cost center selection, and auto-population from receipts.

**Features Implemented:**
- Edit buttons for all expense categories (except Mileage and Per Diem which are read-only)
- Receipt validation warnings when amounts don't match receipt totals
- Cost center selection when editing amounts
- Auto-population of Summary Sheet from receipts
- Multiple "Other Expenses" entries with descriptions
- Proper case formatting and centered category names

**Benefits:**
- Quick corrections without navigating to individual entries
- Better control over expense reporting
- Maintains data integrity with validation
- Automatic population from receipt entries

---

## 2. Mandatory Descriptions for Other Expenses
**Status:** ✅ Completed  
**Priority:** High

When staff members add expenses in the "Other Expenses" category, a description is now required. This ensures Finance has clear information about what the expense was for. Multiple "Other Expenses" entries are supported, each with its own description.

**Features Implemented:**
- Required description field for "Other" category receipts
- Multiple "Other Expenses" entries on Summary Sheet
- Description tooltips on hover
- Descriptions appear in PDF exports below entries

**Benefits:**
- Better expense documentation
- Easier review and approval process
- Clearer audit trail

---

## 3. Receipt Image Viewing & Editing
**Status:** ✅ Completed  
**Priority:** High

Fixed the issue where receipt images appeared as broken file icons in the mobile app. Added the ability to view and edit receipt images properly with improved error handling.

**Features Implemented:**
- Improved image URI resolution (handles local files, backend URLs, and various formats)
- Fallback placeholder icons for broken/missing images
- "Edit Image" button in receipt image modal
- Support for taking new photos or choosing from library with built-in cropping
- Better error handling and user feedback

**Benefits:**
- Reliable receipt image access
- Ability to review and verify receipts
- Better mobile app experience
- Easy image replacement when needed

---

## 4. Contracts Portal
**Status:** ✅ Completed  
**Priority:** Medium

Created a new portal specifically for the Contracts team for reviewing expense reports. Unlike the Finance portal, Contracts has read-only access for review purposes (no approval functionality). This supports their quarterly audit process.

**Features Implemented:**
- Review-only portal (no approve/reject buttons)
- All viewing, filtering, and reporting capabilities
- Per Diem Rules management tab
- Accessible via portal switcher for contracts role

**Benefits:**
- Dedicated workspace for Contracts team
- Review capabilities without approval workflow
- Supports quarterly audit requirements
- Better organization of workflow

**Future Enhancement:** Quarterly audit functionality will be added in a future phase to support the Contracts team's audit process.

---

## 5. Per Diem Rules Management
**Status:** ✅ Completed  
**Priority:** Medium

Finance and Contracts teams can now add and edit Cost Center per diem rules directly from their portals, without needing Admin access.

**Features Implemented:**
- Per Diem Rules management tab in Finance Portal
- Per Diem Rules management tab in Contracts Portal
- Full CRUD operations for per diem rules
- Accessible to finance and contracts roles

**Benefits:**
- More flexible rule management
- Faster updates to per diem policies
- Better delegation of responsibilities

---

## 6. Persistent 50+ Hours Alerts
**Status:** ✅ Completed  
**Priority:** High

When employees work 50+ hours, supervisors receive persistent alerts (both in notifications and dashboard) that remain visible until addressed. This helps ensure employees aren't overworking.

**Features Implemented:**
- Automatic detection when employees log 50+ hours in a week
- Persistent notifications that don't auto-dismiss
- Prominent display on Supervisor Dashboard
- Notification bell integration with high priority

**Benefits:**
- Better work-life balance monitoring
- Proactive supervisor intervention
- Prevents employee burnout
- Alerts don't get missed

---

## 7. Persistent Mileage Tracking Notification
**Status:** ✅ Completed  
**Priority:** Medium

When GPS tracking detects no movement for 5 minutes, a persistent notification appears and remains visible until the user stops tracking or dismisses it. This prevents forgotten active tracking sessions.

**Features Implemented:**
- Persistent modal that shows stationary duration
- Real-time updates of stationary time
- "Keep Tracking" and "Stop Tracking" buttons
- Remains visible until explicitly dismissed or tracking stops

**Benefits:**
- Prevents accidental mileage tracking
- Saves battery life
- Reduces incorrect mileage entries
- Clear reminder to stop tracking

---

## 8. Clock In/Clock Out Functionality
**Status:** Under Consideration  
**Priority:** Low

Adding a simple clock in/clock out feature for staff to use on both mobile app and web portal. This would automatically track work hours.

**Benefits:**
- Simplified time tracking
- Automatic hour calculation
- Available on all platforms

**Note:** This feature is being evaluated and may be implemented in a future phase.

---

## 9. Preferred Name Clarification
**Status:** ✅ Completed  
**Priority:** Low

Added clear notes throughout the app explaining that preferred names are only used for addressing users in the app and web portal, and will not appear on expense reports.

**Features Implemented:**
- Helper text in User Settings explaining preferred name usage
- Info alert in Setup Wizard with clarification
- Tooltip on preferred name display in Staff Portal
- Clarification in mobile app Settings screen and edit prompt

**Benefits:**
- Clearer user expectations
- Reduces confusion
- Better user experience

---

## 10. Personalized Portal Naming
**Status:** ✅ Completed  
**Priority:** Low

Changed "Staff Portal" to show the user's preferred name (e.g., "Greg's Portal"). This personalizes the experience while maintaining clarity.

**Features Implemented:**
- Portal switcher displays personalized name (e.g., "Greg's Portal")
- Uses preferred name if available, otherwise first name from full name
- Keyboard shortcuts dialog also uses personalized name
- Consistent throughout the application

**Benefits:**
- More personalized experience
- Easier to identify your workspace
- Better user engagement

---

## Implementation Timeline

✅ **All planned features have been completed!**

**Completion Date:** December 19, 2025

All features from the presentation feedback have been successfully implemented and are ready for testing.

---

## Questions or Feedback?

If you have questions about any of these features or would like to provide additional feedback, please reach out to the development team.

---

*Last Updated: December 19, 2025*

