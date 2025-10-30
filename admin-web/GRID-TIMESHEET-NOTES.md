# Grid Timesheet Implementation - COMPLETED ✅

## Goal
Implement a grid-style timesheet matching the Oxford House FY 25/26 format shown in the reference screenshot.

## What Was Accomplished
✅ Implemented grid-style timesheet with 30-day layout  
✅ Fixed summary table with dynamic cost center columns  
✅ Implemented dynamic receipt category mappings (Phone/Internet/Fax, Postage/Shipping, Printing/Copying, Outreach Supplies)  
✅ Fixed subtotals calculation to include all categories per cost center  
✅ Positioned "Less Cash Advance" in second-to-last column  
✅ All assigned cost centers display in timesheet, even with zero hours  
✅ Receipt image upload and display in PDF export  
✅ Standard export format for all Export buttons  

## Export Format (Standardized)
All "Export" buttons in the admin portal now use the same PDF export format:

**Endpoint:** `/api/export/expense-report-pdf/:id`

**Structure:**
1. **Approval Cover Sheet** - Employee info, cost centers, summary totals, signatures
2. **Summary Sheet** - Expense categories with dynamic cost center columns:
   - Travel Expenses (MILEAGE, AIR/RAIL/BUS, VEHICLE RENTAL/FUEL, PARKING/TOLLS, GROUND, LODGING, PER DIEM)
   - Other Expenses (OTHER EXPENSES, OXFORD HOUSE E.E.S.)
   - Communications (COMMUNICATIONS, Phone/Internet/Fax, Postage/Shipping, Printing/Copying)
   - Supplies (SUPPLIES, Outreach Supplies)
   - Subtotals, Less Cash Advance, GRAND TOTAL
3. **Cost Center Travel Sheets** - One page per assigned cost center with daily breakdown
4. **Timesheet Grid** - 30-day grid showing hours by cost center and category
5. **Receipts** - Table followed by receipt images

**Used in:**
- FinancePortal.tsx - Export button
- Staff Portal (mobile app) - Export functionality
- All expense report exports

## Key Implementation Details

### Summary Sheet
- Dynamically adjusts columns based on assigned cost centers
- Categories automatically mapped from receipt categories
- Totals calculated per cost center column
- "Less Cash Advance" in second-to-last column
- GRAND TOTAL spans and aligns correctly

### Grid Timesheet
- 80px name column + 14px × 30 days + 70px total = 570px width
- Cell height: 12px
- Font size: 6 for cells
- All assigned cost centers shown (blank if no hours)
- Totals rows with proper styling

### Category Mappings
Phone/Internet/Fax: `Phone/Internet/Fax`, `Phone / Internet / Fax`  
Postage/Shipping: `Postage/Shipping`, `Postage / Shipping`, `Postage`, `Shipping`  
Printing/Copying: `Printing/Copying`, `Printing / Copying`, `Printing`, `Copying`  
Outreach Supplies: `Outreach Supplies`, `Office Supplies`, `Supplies`

## Server Info

### Local Development
- Frontend: http://localhost:3000
- Backend: http://localhost:3002

### Production Deployment
- Backend: https://oxford-mileage-backend.onrender.com (Render.com)
- Frontend: Deployed to Vercel (manual deployment)
- Mobile App: Connected to Render backend for production sync

### Deployment Architecture
1. **Backend (Render.com)**:
   - Node.js API with SQLite database
   - WebSocket real-time sync
   - Image uploads support
   - Health check: /
   - Auto-deploys from render.yaml

2. **Frontend (Vercel)**:
   - React admin web portal
   - Points to Render backend
   - Environment: REACT_APP_API_URL=https://oxford-mileage-backend.onrender.com
   - Auto-deploys from vercel.json

3. **Mobile App (Expo)**:
   - Production mode uses Render backend
   - Development mode uses local network IP
   - Real-time sync via WebSockets
   - OTA updates via Expo Updates

