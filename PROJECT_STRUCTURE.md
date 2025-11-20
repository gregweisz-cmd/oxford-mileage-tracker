# Oxford House Expense Tracker - Project Structure

This document provides a comprehensive overview of all files and folders in the Oxford House Expense Tracker project.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Root Directory](#root-directory)
3. [Mobile App (React Native/Expo)](#mobile-app-react-nativeexpo)
4. [Admin Web Portal](#admin-web-portal)
5. [Backend Server](#backend-server)
6. [Configuration Files](#configuration-files)
7. [Documentation](#documentation)
8. [Test Files](#test-files)

---

## Project Overview

The Oxford House Expense Tracker is a full-stack expense tracking application with:
- **Mobile App**: React Native/Expo application for field employees
- **Admin Web Portal**: React web application for administrators
- **Backend API**: Node.js/Express server with SQLite database

---

## Root Directory

### Configuration Files

#### `package.json`
- **Type**: Node.js package configuration
- **Purpose**: Main project configuration for the mobile app (Expo)
- **Key Scripts**:
  - `npm start`: Start Expo development server
  - `npm run android`: Run on Android emulator/device
  - `npm run ios`: Run on iOS simulator/device
  - `npm run web`: Run web version
- **Dependencies**: React Native, Expo, navigation libraries, camera, location, SQLite, etc.

#### `argv.json`
- **Type**: JSON configuration
- **Purpose**: Cursor IDE configuration/arguments

#### `.gitignore`
- **Type**: Git ignore rules
- **Purpose**: Specifies files/folders to exclude from version control

---

## Mobile App (React Native/Expo)

### `src/` - Main Mobile App Source Code

This directory contains all the source code for the mobile React Native application.

#### `src/screens/` - Screen Components

##### `TimeTrackingScreen.tsx`
- **Purpose**: Main time tracking interface for employees
- **Features**: Clock in/out, view time entries, GPS tracking

##### `SettingsScreen.tsx`
- **Purpose**: User settings and preferences
- **Features**: 
  - Theme selection
  - Two-Factor Authentication (2FA) management
  - Preferred name
  - App preferences
  - Device settings
- **Key Features**: Keyboard avoidance, 2FA phone number input, password dialogs

##### `LoginScreen.tsx`
- **Purpose**: Employee authentication screen
- **Features**: 
  - Email/password login
  - Two-factor authentication code input
  - Stay logged in option
  - Employee selection (for local mode)

##### Other Screen Files
- Additional screen components for receipts, mileage, reports, etc.

#### `src/components/` - Reusable UI Components

##### `UnifiedHeader.tsx`
- **Purpose**: Standardized header component used across screens
- **Features**: Back button, title, consistent styling

##### Other Component Files
- Various reusable UI components (buttons, cards, forms, etc.)

#### `src/services/` - Business Logic Services

##### `database.ts` / `DatabaseService.ts`
- **Purpose**: SQLite database operations
- **Features**: 
  - Employee CRUD operations
  - Receipt storage and retrieval
  - Time entry management
  - Local data persistence
- **Key Methods**: `getCurrentEmployee()`, `getEmployeeById()`, `saveReceipt()`, etc.

##### `twoFactorService.ts`
- **Purpose**: Two-Factor Authentication API integration
- **Features**: 
  - Send verification codes
  - Verify phone numbers
  - Enable/disable 2FA
  - Get 2FA status
- **API Endpoints**: `/api/auth/two-factor/*`

##### `deviceIntelligenceService.ts`
- **Purpose**: Device and user preference management
- **Features**: 
  - Device settings storage
  - UI preferences
  - Input method preferences
  - Offline sync patterns

##### `performanceOptimizationService.ts`
- **Purpose**: Performance optimization and caching strategies
- **Features**: Loading strategies, caching recommendations

##### `deviceControlService.ts`
- **Purpose**: Device-level controls (vibration, notifications, etc.)
- **Features**: Settings for device behavior

##### `smartNotificationService.ts`
- **Purpose**: Contextual notification system
- **Features**: Smart reminders for receipts, mileage, per diem

##### `costCenterAutoSelectionService.ts`
- **Purpose**: Intelligent cost center suggestions
- **Features**: History-based recommendations, location-based suggestions

##### `receiptPhotoQualityService.ts`
- **Purpose**: Receipt photo quality analysis
- **Features**: Quality warnings, blur detection

##### `perDiemDashboardService.ts`
- **Purpose**: Per diem calculation and statistics
- **Features**: Monthly limits, eligibility checks, dashboard widgets

##### `perDiemRulesService.ts`
- **Purpose**: Per diem rules management
- **Features**: Fetch rules from backend, eligibility criteria

##### `apiService.ts` / `ApiService.ts`
- **Purpose**: Backend API communication
- **Features**: HTTP requests, authentication, error handling

##### Other Service Files
- Additional services for specific features

#### `src/contexts/` - React Context Providers

##### `ThemeContext.tsx`
- **Purpose**: Global theme management (light/dark/auto)
- **Features**: Theme switching, color scheme access

##### `TipsContext.tsx`
- **Purpose**: Contextual tips and help system
- **Features**: Show/hide tips, reset tips

##### Other Context Files
- Additional context providers for app-wide state

#### `src/types/` - TypeScript Type Definitions

##### `index.ts` / Type Definition Files
- **Purpose**: TypeScript interfaces and types
- **Common Types**: 
  - `Employee`: Employee data structure
  - `Receipt`: Receipt/expense data
  - `TimeEntry`: Time tracking data
  - `CostCenter`: Cost center information
  - Service-specific types

#### `src/utils/` - Utility Functions
- Helper functions, formatters, validators, etc.

---

## Admin Web Portal

### `admin-web/` - Web Portal Root

#### `admin-web/src/` - React Web Application Source

##### `src/components/` - React Components

##### `Login.tsx`
- **Purpose**: Admin portal login screen
- **Features**: 
  - Email/password authentication
  - Two-factor authentication support
  - Error handling

##### `UserSettings.tsx`
- **Purpose**: User settings for web portal
- **Features**: 
  - Password change
  - Two-Factor Authentication management
  - Profile settings

##### `EmployeeManagementComponent.tsx`
- **Purpose**: Employee CRUD operations
- **Features**: 
  - Create/edit employees
  - Archive employees (soft delete)
  - View archived employees
  - Delete confirmation for archived employees

##### Other Component Files
- Dashboard, reports, receipt management, etc.

##### `src/services/` - Frontend Services

##### `twoFactorService.ts`
- **Purpose**: Web portal 2FA API integration
- **Features**: Same as mobile app service, but for web

##### `employeeApiService.ts`
- **Purpose**: Employee API calls
- **Features**: CRUD operations, archiving

##### Other Service Files
- Additional API services

##### `src/App.tsx`
- **Purpose**: Main React application component
- **Features**: Routing, layout, authentication guards

##### `src/index.tsx`
- **Purpose**: Application entry point
- **Features**: React DOM rendering, providers

#### `admin-web/backend/` - Backend Server (See Backend Server section)

#### `admin-web/.gitignore`
- **Purpose**: Git ignore rules for web portal

---

## Backend Server

### `admin-web/backend/` - Node.js/Express Backend

#### `server.js`
- **Purpose**: Main Express server file
- **Features**: 
  - API routes and endpoints
  - Database initialization and migrations
  - WebSocket support for real-time updates
  - File upload handling (Multer)
  - Authentication and authorization
  - Two-factor authentication endpoints
  - Employee management endpoints
  - Receipt management
  - Report generation
  - PDF generation
  - Excel export
- **Key Endpoints**:
  - `/api/auth/login` - Admin login
  - `/api/employee-login` - Employee login
  - `/api/auth/two-factor/*` - 2FA endpoints
  - `/api/employees/*` - Employee CRUD
  - `/api/receipts/*` - Receipt management
  - `/api/reports/*` - Report generation
- **Database**: SQLite (`database.sqlite`)
- **Port**: 3002 (default)

#### `twoFactorService.js`
- **Purpose**: Twilio SMS integration for 2FA
- **Features**: 
  - Generate verification codes
  - Send SMS via Twilio
  - Format phone numbers (E.164)
  - Validate phone numbers
  - Development mode (logs codes when Twilio not configured)
- **Environment Variables**:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`

#### `debug.js`
- **Purpose**: Debug logging utility
- **Features**: Console logging with timestamps, error logging

#### `check-receipt-revisions.js`
- **Purpose**: Utility script for checking receipt revisions
- **Features**: Database query tool

#### `package.json`
- **Purpose**: Backend dependencies and scripts
- **Key Dependencies**:
  - `express`: Web framework
  - `sqlite3`: Database
  - `twilio`: SMS service
  - `@google-cloud/vision`: OCR for receipts
  - `multer`: File uploads
  - `jspdf`: PDF generation
  - `xlsx`: Excel export
  - `ws`: WebSocket support
  - `cors`: CORS middleware
  - `body-parser`: Request parsing
  - `dotenv`: Environment variables
- **Scripts**:
  - `npm start` / `npm run dev`: Start server

#### `.env`
- **Purpose**: Environment variables (NOT in git)
- **Required Variables**:
  - `TWILIO_ACCOUNT_SID`: Twilio account ID
  - `TWILIO_AUTH_TOKEN`: Twilio authentication token
  - `TWILIO_PHONE_NUMBER`: Twilio phone number (E.164 format)
  - `GOOGLE_CLOUD_VISION_API_KEY`: Google Cloud Vision API key (optional)
  - Other configuration variables

#### `database.sqlite`
- **Purpose**: SQLite database file
- **Tables**:
  - `employees`: Employee data (includes 2FA fields)
  - `receipts`: Receipt/expense records
  - `time_entries`: Time tracking data
  - `cost_centers`: Cost center information
  - Other business tables
- **Note**: Database is created automatically on first server start

---

## Configuration Files

### Root Level

#### `babel.config.js` / `.babelrc`
- **Purpose**: Babel transpiler configuration for React Native
- **Features**: Expo preset, TypeScript support

#### `tsconfig.json`
- **Purpose**: TypeScript compiler configuration
- **Features**: Type checking rules, path mappings

#### `app.json` / `app.config.js`
- **Purpose**: Expo application configuration
- **Features**: App name, version, icons, splash screen, permissions

#### `.expo/`
- **Purpose**: Expo build cache and configuration
- **Note**: Auto-generated, typically gitignored

---

## Documentation

### Root Level Documentation Files

#### `PROJECT_STRUCTURE.md` (This File)
- **Purpose**: Comprehensive project structure documentation

#### `TWILIO_SETUP_GUIDE.md`
- **Purpose**: Step-by-step guide for configuring Twilio SMS
- **Contents**: Account setup, credentials, environment variables, testing

#### `TWO_FACTOR_AUTH_SETUP.md`
- **Purpose**: 2FA implementation documentation
- **Contents**: Feature overview, API endpoints, usage flow

#### `DEPLOYMENT_GUIDE.md`
- **Purpose**: Deployment instructions
- **Contents**: Production deployment steps, environment setup

#### `DEPLOYMENT_READY.md`
- **Purpose**: Deployment checklist
- **Contents**: Pre-deployment verification steps

#### `DEPLOYMENT_SUMMARY.md`
- **Purpose**: Deployment summary
- **Contents**: Deployment overview, changes

#### `EXPO_UPDATE_INSTRUCTIONS.md`
- **Purpose**: Expo SDK update instructions
- **Contents**: Step-by-step update process

#### `FEATURES_TABLE_OF_CONTENTS.md` (if exists)
- **Purpose**: Feature documentation index
- **Contents**: List of implemented features

---

## Test Files

### Root Level Test PDFs

These are test/example PDF files generated during development:

#### `test-*.pdf`
- **Purpose**: Test PDFs for report generation
- **Examples**:
  - `test-timesheet-centered.pdf`: Centered timesheet layout
  - `test-cost-center-improved.pdf`: Cost center report
  - `test-personal-info-tables.pdf`: Personal information tables
  - `test-all-tables-improved.pdf`: All table formats
  - `test-dynamic-height.pdf`: Dynamic height testing
  - `test-with-buffer.pdf`: Buffer/margin testing
  - `test-after-restart.pdf`: Post-restart verification

#### `test-excel-enhanced.xlsx`
- **Purpose**: Test Excel export file
- **Features**: Enhanced formatting, multiple sheets

---

## Development Workflow

### Starting Development Servers

#### Backend Server
```bash
cd admin-web/backend
npm install  # First time only
npm start
# Server runs on http://localhost:3002
```

#### Mobile App (Expo)
```bash
# From root directory
npm install  # First time only
npm start
# Opens Expo DevTools
# Press 'a' for Android, 'i' for iOS, 'w' for web
```

#### Web Portal
```bash
cd admin-web/src  # (if separate frontend server needed)
npm install
npm start
# Usually served by backend or separate React dev server
```

### Environment Setup

1. **Backend Environment Variables** (`admin-web/backend/.env`):
   ```env
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+15551234567
   GOOGLE_CLOUD_VISION_API_KEY=your_api_key
   ```

2. **Mobile App Configuration**:
   - Update API URLs in service files for production
   - Development mode uses local IP: `http://192.168.86.101:3002`
   - Production mode uses: `https://oxford-mileage-backend.onrender.com`

### Database

- **Location**: `admin-web/backend/database.sqlite`
- **Initialization**: Automatic on first server start
- **Migrations**: Handled in `server.js` on startup
- **Backup**: Manual SQLite backup recommended before major changes

---

## Key Technologies

### Mobile App
- **Framework**: React Native (Expo)
- **Language**: TypeScript
- **Navigation**: React Navigation
- **State Management**: React Context API
- **Database**: Expo SQLite
- **Location**: Expo Location
- **Camera**: Expo Camera/ImagePicker
- **Maps**: React Native Maps

### Web Portal
- **Framework**: React
- **Language**: TypeScript
- **UI Library**: Material-UI (MUI)
- **State Management**: React Hooks/Context

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite3
- **File Upload**: Multer
- **WebSocket**: ws
- **SMS**: Twilio
- **OCR**: Google Cloud Vision API
- **PDF**: jsPDF
- **Excel**: xlsx

---

## Important Notes

### Security
- **`.env` files are NOT committed to git** (should be in `.gitignore`)
- **Sensitive credentials** should never be committed
- **Database file** may contain sensitive data (consider gitignoring)

### Development vs Production
- **Mobile App**: Uses `__DEV__` flag to switch API URLs
- **Backend**: Uses environment variables for configuration
- **Twilio**: Development mode logs codes instead of sending SMS (when not configured)

### Testing
- **2FA Testing**: Use development mode (logs codes to console) until Twilio is configured
- **Phone Numbers**: Trial Twilio accounts require verified phone numbers
- **Backend Logs**: Check console for debug information and error messages

---

## Quick Reference

### Common Commands

```bash
# Start backend
cd admin-web/backend && npm start

# Start mobile app
npm start

# Install dependencies (backend)
cd admin-web/backend && npm install

# Install dependencies (mobile)
npm install

# Check running servers
netstat -ano | findstr ":3002\|:3000"
```

### Key File Locations

- **Backend Server**: `admin-web/backend/server.js`
- **Mobile Entry**: `src/App.tsx` (or `App.tsx` in root)
- **Web Portal Entry**: `admin-web/src/index.tsx`
- **Database**: `admin-web/backend/database.sqlite`
- **Environment Config**: `admin-web/backend/.env`
- **2FA Service (Backend)**: `admin-web/backend/twoFactorService.js`
- **2FA Service (Mobile)**: `src/services/twoFactorService.ts`
- **2FA Service (Web)**: `admin-web/src/services/twoFactorService.ts`

---

## Future Enhancements

Refer to `FEATURES_TABLE_OF_CONTENTS.md` (if exists) for planned features and improvements.

---

**Last Updated**: November 2025
**Project Version**: 1.0.0
