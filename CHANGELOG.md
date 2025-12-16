# Changelog

All notable changes to the Oxford House Expense Tracker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Documentation organization into `docs/` folder structure
- Error boundaries for React error handling
- CHANGELOG.md for version tracking

## [1.0.0] - December 2024

### Added
- **Notifications System**
  - Unified notification table for all user roles
  - In-app notification bell with unread counts
  - Email notifications for key events
  - Clickable notifications with direct navigation to reports
  - Editable Sunday reminder preferences

- **Approval Workflow**
  - Multi-level approval (Employee → Supervisor → Finance)
  - Revision request system with comments
  - Approval history and audit trail
  - Status tracking (Draft, Submitted, Needs Revision, Approved)

- **Mobile App Features**
  - Real-time bidirectional sync via WebSocket
  - Receipt image upload with OCR
  - Grid timesheet (30-day layout)
  - PDF export with receipts and images
  - Offline-first architecture with local SQLite

- **Web Portal Enhancements**
  - Supervisor Portal with KPIs dashboard
  - Finance Portal with detailed reporting
  - Staff Portal with daily descriptions
  - Admin Portal with employee management
  - Real-time data updates

- **Security & Infrastructure**
  - Password hashing with bcryptjs
  - Password audit and migration tools
  - API rate limiting middleware
  - Comprehensive health check endpoint
  - Automated database backup scripts

- **Reporting**
  - Grid timesheet with cost center breakdown
  - Monthly expense reports
  - PDF export with proper formatting
  - Supervisor performance metrics
  - Cost center analysis

### Changed
- Refactored notification system from multiple tables to unified table
- Updated mobile app API configuration for production/development switching
- Improved address formatting (Base Addresses show as "BA", "BA1", etc.)
- Enhanced date normalization for consistent storage
- Updated README.md with current architecture and features

### Fixed
- Mileage entries disappearing after reload (date normalization)
- Supervisor Portal KPI errors (added missing endpoints)
- Day off checkbox behavior and description clearing
- HTML nesting errors in notification components
- Drive entries not syncing between mobile and web

### Security
- Migrated plain text passwords to bcrypt hashes
- Added password security audit script
- Implemented rate limiting for all API endpoints
- Added input sanitization improvements

## [0.9.0] - October 2024

### Added
- Receipt image upload from mobile app
- Grid timesheet implementation (30-day layout)
- Cost center breakdown in reports
- Receipt category mappings
- PDF export improvements with images

### Changed
- Standardized all export buttons to use same format
- Enhanced PDF generation with proper page breaks
- Improved cost center column handling

## [0.8.0] - October 2024

### Added
- Real-time synchronization via WebSocket
- Web portal for staff, supervisors, finance, and admins
- Approval workflow system
- Monthly report generation
- Employee management system

### Changed
- Migrated from Slack integration to web-based system
- Improved mobile app UI/UX
- Enhanced data entry forms

## [0.7.0] - September 2024

### Added
- Mobile app (iOS and Android)
- Mileage tracking
- Receipt capture
- Time tracking
- Monthly reports

---

## Version History Summary

- **v1.0.0** - Production-ready with notifications, approvals, and full feature set
- **v0.9.0** - Grid timesheet and receipt images
- **v0.8.0** - Web portal and approval workflow
- **v0.7.0** - Initial mobile app release

---

## Types of Changes

- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` for vulnerability fixes

