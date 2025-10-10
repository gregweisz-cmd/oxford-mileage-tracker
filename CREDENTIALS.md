# System Credentials & Access Information

## 🔐 Employee Logins

### AJ Dunaway (Your Account)
- **Employee ID:** `mggwglbfk9dij3oze8l`
- **Name:** AJ Dunaway
- **Email:** aj@example.com
- **Position:** Regional Director
- **Cost Centers:** 
  - NC.F-SAPTBG (North Carolina - SAPTBG)
  - IL-STATE (Illinois State)
  - MN-STATE (Minnesota State)
  - WI-STATE (Wisconsin State)
- **Base Address:** 230 Wagner St, Troutman, NC 28166
- **Status:** Active, Primary Test Account

### Greg Weisz (Your Account - CEO/Administrator)
- **Employee ID:** `greg-weisz-001`
- **Name:** Greg Weisz
- **Preferred Name:** Greg
- **Email:** greg@oxfordhouse.org
- **Password:** `ImtheBoss5!`
- **Position:** CEO/Administrator
- **Cost Centers:** 
  - NC.F-SAPTBG (North Carolina - SAPTBG)
  - G&A (General & Administrative)
  - Fundraising
- **Default Cost Center:** NC.F-SAPTBG
- **Base Address:** 230 Wagner St, Troutman, NC 28166
- **Mileage Rate:** $0.445/mile
- **Status:** Active, Administrator Account

### Kathleen Gibson (CEO)
- **Employee ID:** `kathleen-gibson-001`
- **Name:** Kathleen Gibson
- **Preferred Name:** Kathleen
- **Email:** kathleen.gibson@oxfordhouse.org
- **Password:** `Kathleenwelcome1`
- **Position:** CEO
- **Cost Centers:** 
  - PS-Unfunded
  - PS-Funded
  - Administrative
- **Default Cost Center:** PS-Unfunded
- **Base Address:** 9016 Mustard Seed Ln, Garner, NC 27529
- **Status:** Active, CEO Account

---

## 🌐 Web Portal Access

### URL
- **Local Development:** http://localhost:3000
- **Production:** (To be configured)

### ✅ Authentication Implemented!
The web portal now requires login with email and password.

### How to Login
1. Go to http://localhost:3000
2. You'll see the login screen
3. Enter email and password
4. System validates credentials and creates session token
5. Token stored in localStorage for auto-login

### Administrator Accounts
- **Greg Weisz (CEO):**
  - Email: `greg@oxfordhouse.org`
  - Password: `ImtheBoss5!`
  - Employee ID: `greg-weisz-001`
  
- **AJ Dunaway (Regional Director):**
  - Employee ID: `mggwglbfk9dij3oze8l`
  - (No password set yet - need to add)

---

## 📱 Mobile App Access

### Login Process
1. Open Oxford Mileage Tracker app
2. First time: Select/create employee profile
3. Credentials stored locally on device

### Available Logins
- **Greg Weisz (You):** `greg-weisz-001`
- **AJ Dunaway (Test):** `mggwglbfk9dij3oze8l`

---

## 🔌 Backend API

### Local Development
- **URL:** http://localhost:3002
- **Database:** SQLite (expense_tracker.db)
- **Location:** `admin-web/backend/expense_tracker.db`

### API Endpoints
- **Employees:** http://localhost:3002/api/employees
- **Mileage:** http://localhost:3002/api/mileage-entries
- **Receipts:** http://localhost:3002/api/receipts
- **Time Tracking:** http://localhost:3002/api/time-tracking
- **Daily Descriptions:** http://localhost:3002/api/daily-descriptions

### Authentication
- Currently no authentication (development mode)
- Uses employee ID for data filtering

---

## 👥 All Imported Employees

Based on your bulk imports, you have the following employees in the system:
(These are from your CSV imports)

### Active Employees
1. AJ Dunaway - Regional Director
2. Aaron Torrance
3. Aaron Vick
4. Aislinne Langston
5. Alex Smith
6. Alex Szary
7. Alexandra Mulvey
8. Alexis Landa
9. Alison Kayrouz
10. Alyssa Robles
11. Amanda Disney
12. Amanda McGuirt
13. Andrea Kissack
14. Andrew Ward
15. Angelica Neighbors
16. Anna Rand
17. Annie Headley
18. Antonio Rivera Jr.
19. April Talbert
20. Ashley Connor
21. Ashley DeNardi
22. Ashley Manges
23. Aspasia Gatchell
24. Avery Simmons
25. Barbara Kidder
26. Bear Jarrells
27. Bethany LeBlanc
28. Bo Byrd
29. Bradley McMahan
30. Brent Erickson
31. Brent Welsh
32. Brianna Haug
33. Bridget Sandstrom
... (and more from your CSV import)

**Note:** Full employee list is stored in the database. Use the web portal's Individual Management screen to view all employees.

---

## 🔑 Admin Portal Access

### Admin Features
- **Individual Management:** View/edit all employee profiles
- **Bulk Import:** Import employees from CSV
- **Expense Reports:** View and manage expense reports
- **Cost Center Management:** Configure cost centers
- **Per Diem Rules:** Set per diem limits by cost center

### Access Level
- Currently no role-based access control
- All features available in development mode

---

## 📊 Database Locations

### Mobile App Database
- **Platform:** SQLite via expo-sqlite
- **Web:** `oxford_tracker_web.db` (browser storage)
- **Native:** `oxford_tracker.db` (device storage)
- **Location:** Device-specific (managed by Expo)

### Backend Database
- **File:** `expense_tracker.db`
- **Location:** `admin-web/backend/expense_tracker.db`
- **Type:** SQLite3
- **Tables:** employees, mileage_entries, receipts, time_tracking, daily_descriptions, expense_reports, etc.

---

## 🔧 Development Credentials

### QR Code Access (Mobile App)
- Generate QR code: Run `npx expo start` in project root
- Scan with Expo Go app
- No credentials needed for development

### Web Portal Development
- No login screen in current version
- Employee ID stored in localStorage
- Access via: `localStorage.setItem('currentEmployeeId', 'mggwglbfk9dij3oze8l')`

---

## 📝 Notes

### Security Reminders
- ⚠️ This is a development build with no authentication
- ⚠️ Do not use in production without implementing proper authentication
- ⚠️ Employee IDs are currently exposed in localStorage
- ⚠️ API endpoints are open (no API keys required)

### Recommended Next Steps
1. Implement proper authentication system
2. Add role-based access control (Admin, Manager, Employee)
3. Secure API endpoints with authentication tokens
4. Add password protection for employee accounts
5. Implement session management

---

## 🎯 Quick Access Summary

### Your Administrator Account
- **Name:** Greg Weisz
- **ID:** `greg-weisz-001`
- **Email:** greg@oxfordhouse.org
- **Password:** `ImtheBoss5!`
- **Position:** CEO/Administrator
- **Use for:** All administrative functions

### CEO Account
- **Name:** Kathleen Gibson
- **ID:** `kathleen-gibson-001`
- **Email:** kathleen.gibson@oxfordhouse.org
- **Password:** `Kathleenwelcome1`
- **Position:** CEO
- **Use for:** CEO review and access

### Test Account
- **Name:** AJ Dunaway
- **ID:** `mggwglbfk9dij3oze8l`
- **Email:** aj@example.com
- **Use for:** Testing employee features

### Web Portal
- **URL:** http://localhost:3000
- **Login as Greg:** Email `greg@oxfordhouse.org` / Password `ImtheBoss5!`
- **Login as Kathleen:** Email `kathleen@oxfordhouse.org` / Password `Kathleenwelcome1`
- **Login as AJ:** Email `aj@example.com` / Password `aj123`

### Backend
- **URL:** http://localhost:3002
- **Database:** `admin-web/backend/expense_tracker.db`

### Mobile App
- **Start:** `npx expo start`
- **Login as Greg:** Select Greg Weisz profile
- **Login as AJ:** Select AJ Dunaway profile

---

## 🧪 Test Accounts for Nationwide Testing

### 1. Greg Weisz (Senior Data Analyst)
- **Email:** greg.weisz@oxfordhouse.org
- **Password:** ImtheBoss5!
- **Position:** Senior Data Analyst
- **Base Address:** 230 Wagner St, Troutman, NC 28166
- **Default Cost Center:** PS-Unfunded
- **Access:** Full system access, all cost centers

### 2. Kathleen Gibson (CEO)
- **Email:** kathleen.gibson@oxfordhouse.org
- **Password:** Kathleenwelcome1
- **Position:** CEO
- **Default Cost Center:** PS-Unfunded
- **Access:** Full system access, all cost centers

### 3. AJ Dunaway (Program Services Director)
- **Email:** ajdunaway@oxfordhouse.org
- **Password:** ajdunaway1!
- **Position:** Program Services Director
- **Default Cost Center:** PS-Funded
- **Access:** Program Services, Direct Care

### 4. Sarah Johnson (Supervisor)
- **Email:** sarah.johnson@oxfordhouse.org
- **Password:** TestSupervisor1!
- **Position:** Supervisor
- **Default Cost Center:** PS-Funded
- **Access:** PS-Funded, Direct Care, Training

### 5. Mike Wilson (Staff)
- **Email:** mike.wilson@oxfordhouse.org
- **Password:** TestStaff1!
- **Position:** Staff
- **Default Cost Center:** Direct Care
- **Access:** Direct Care, PS-Funded

### 6. Lisa Davis (Staff)
- **Email:** lisa.davis@oxfordhouse.org
- **Password:** TestStaff2!
- **Position:** Staff
- **Default Cost Center:** PS-Unfunded
- **Access:** PS-Unfunded, Training

### 7. Jackson Longan (Director of Communication and Information)
- **Email:** jackson.longan@oxfordhouse.org
- **Password:** Jacksonwelcome1
- **Position:** Director of Communication and Information
- **Base Address:** 425 Pergola St, Yukon, OK 73099
- **Phone:** (361) 563-1537
- **Default Cost Center:** PS-Unfunded
- **Access:** Full system access, all cost centers

### 8. Alex Szary (Senior Manager of Data and Analytics)
- **Email:** alex.szary@oxfordhouse.org
- **Password:** Alexwelcome1
- **Position:** Senior Manager of Data and Analytics
- **Base Address:** 7343 Obbligato Ln, San Antonio, TX 78266
- **Phone:** (210) 369-8399
- **Default Cost Center:** PS-Unfunded
- **Access:** Full system access, all cost centers

### 9. Kenneth Norman (Re-entry Coordinator)
- **Email:** kenneth.norman@oxfordhouse.org
- **Password:** Kennethwelcome1
- **Position:** Re-entry Coordinator
- **Base Address:** 1019 Grey Fawn Dr, Omaha, NE 68154
- **Phone:** (402) 669-0608
- **Default Cost Center:** NE-SOR
- **Access:** NE-SOR cost center only

## 📅 Last Updated
Date: October 10, 2025
Status: Ready for Vercel Deployment - All Test Accounts Created

