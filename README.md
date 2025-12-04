# Oxford House Expense Tracker

A comprehensive cross-platform expense tracking system for Oxford House employees, featuring mobile apps, web portals, real-time synchronization, and automated approval workflows.

## 🎯 Overview

The Oxford House Expense Tracker is a full-stack application that enables employees to track mileage, receipts, and work hours, with automated workflows for supervisor and finance approvals. The system consists of:

- **Mobile App** (React Native/Expo) - iOS and Android
- **Web Portal** (React) - Staff, Supervisor, Finance, and Admin portals
- **Backend API** (Node.js/Express) - RESTful API with WebSocket real-time sync
- **Database** (SQLite) - Local and cloud database

## ✨ Key Features

### 📱 Mobile App (Expo)
- **Mileage Tracking** - Log trips with GPS location, purpose, and distance
- **Receipt Capture** - Photo capture and OCR for receipt processing
- **Time Tracking** - Track work hours with cost center categorization
- **Offline Support** - Local SQLite database with automatic sync
- **Real-time Sync** - WebSocket-based bidirectional data synchronization
- **PDF Export** - Generate monthly expense reports with receipts

### 🌐 Web Portal
- **Staff Portal** - Employees can view/edit entries, submit reports, view notifications
- **Supervisor Portal** - Approve/reject reports, view team KPIs, manage revisions
- **Finance Portal** - Final approval, detailed reporting, analytics
- **Admin Portal** - Employee management, system configuration, oversight

### 🔔 Notifications System
- **In-App Notifications** - Real-time notification bell with unread counts
- **Email Notifications** - Automatic emails for:
  - Report submissions
  - Approval requests
  - Revision requests
  - Sunday expense reminders (editable preference)
- **Clickable Notifications** - Direct navigation to relevant reports

### 📊 Approval Workflow
- **Multi-Level Approval** - Employee → Supervisor → Finance
- **Revision System** - Request changes at any level with comments
- **Status Tracking** - Draft, Submitted, Needs Revision, Approved
- **History & Audit Trail** - Complete approval history with timestamps

### 📈 Reporting & Analytics
- **Grid Timesheet** - 30-day layout with cost center breakdown
- **Monthly Reports** - Comprehensive expense reports with totals
- **PDF Export** - Professional PDFs with receipts, timesheets, and summaries
- **Supervisor KPIs** - Team performance metrics and approval rates
- **Cost Center Analysis** - Detailed breakdown by cost center and category

### 🔐 Security & Infrastructure
- **Password Security** - bcrypt hashing with password audit tools
- **Rate Limiting** - API protection against abuse
- **Health Checks** - Comprehensive system health monitoring
- **Automated Backups** - Database backup scripts with compression
- **Error Tracking** - Structured error logging and monitoring

## 🏗️ Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Mobile App    │◄───────►│  Backend API     │◄───────►│  Web Portal     │
│    (Expo)       │         │   (Render.com)   │         │    (Vercel)     │
│                 │         │                  │         │                 │
│ • React Native  │         │ • Node.js        │         │ • React         │
│ • SQLite (local)│         │ • Express        │         │ • Material-UI   │
│ • WebSocket     │         │ • SQLite (cloud) │         │ • Real-time UI  │
│ • Offline-first │         │ • WebSocket      │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

### Technology Stack

**Mobile:**
- React Native with Expo
- SQLite (expo-sqlite)
- React Navigation
- WebSocket client

**Web:**
- React 18
- TypeScript
- Material-UI (MUI)
- React Router

**Backend:**
- Node.js
- Express.js
- SQLite3
- WebSocket (ws)
- Nodemailer (email)
- bcryptjs (password hashing)

**Deployment:**
- Mobile: Expo OTA Updates + App Store/Play Store
- Backend: Render.com
- Frontend: Vercel

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- Git

### Quick Start

1. **Clone the repository:**
```bash
git clone <repository-url>
cd oxford-mileage-tracker
```

2. **Install dependencies:**

```bash
# Root dependencies (for mobile app)
npm install

# Web portal dependencies
cd admin-web
npm install

# Backend dependencies
cd backend
npm install
```

3. **Start development servers:**

**Terminal 1 - Backend:**
```bash
cd admin-web/backend
npm start
```

**Terminal 2 - Web Portal:**
```bash
cd admin-web
npm start
```

**Terminal 3 - Mobile App:**
```bash
cd oxford-mileage-tracker
npm start
```

### Environment Setup

Create `.env` files as needed:

**Backend** (`admin-web/backend/.env`):
```
NODE_ENV=development
PORT=3002
DATABASE_PATH=./expense_tracker.db
```

**Frontend** (`admin-web/.env`):
```
REACT_APP_API_URL=http://localhost:3002
```

## 📖 Documentation

Comprehensive documentation is organized in the `docs/` folder:

- **[Developer Guides](docs/developer/)** - Architecture, database, API, setup guides
- **[Admin Guides](docs/admin-guides/)** - Supervisor management, user administration
- **[Deployment Guides](docs/deployment/)** - Production deployment instructions
- **[User Guides](docs/user-guides/)** - End-user documentation (coming soon)

### Key Documentation Files

- [Startup Guide](docs/developer/STARTUP_GUIDE.md) - How to start all services
- [Database Quick Start](docs/developer/DATABASE_QUICK_START.md) - Database setup
- [Deployment Guide](docs/deployment/DEPLOY.md) - Production deployment
- [Architecture Overview](docs/developer/ARCHITECTURE.md) - System architecture

## 🔧 Development

### Project Structure

```
oxford-mileage-tracker/
├── src/                    # Mobile app source
│   ├── components/         # React Native components
│   ├── screens/            # App screens
│   ├── services/           # API and database services
│   └── config/             # Configuration
├── admin-web/              # Web portal
│   ├── src/                # React source
│   │   ├── components/     # Portal components
│   │   └── services/       # API services
│   └── backend/            # Backend API
│       ├── routes/         # API routes
│       ├── services/       # Business logic
│       └── scripts/        # Utility scripts
└── docs/                   # Documentation
```

### Database Schema

Key tables:
- `employees` - User accounts and profiles
- `mileage_entries` - Mileage tracking records
- `receipts` - Receipt records with images
- `time_tracking` - Work hour entries
- `expense_reports` - Monthly reports with approval workflow
- `notifications` - Unified notification system
- `report_approvals` - Approval history

See [Database Management Guide](docs/developer/DATABASE_MANAGEMENT_GUIDE.md) for details.

## 🧪 Testing

### Local Testing

1. Start all services (see Quick Start)
2. Use test credentials (see admin portal)
3. Test mobile app with Expo Go or development build
4. Verify real-time sync between mobile and web

### Production Testing

- Backend: https://oxford-mileage-backend.onrender.com
- Frontend: Deployed on Vercel
- Mobile: Production build via Expo

## 📦 Deployment

See [Deployment Guide](docs/deployment/DEPLOY.md) for detailed instructions.

### Quick Deploy

```bash
# Deploy backend and frontend
cd admin-web/backend
npm run deploy
```

This will:
1. Commit all changes
2. Push to GitHub
3. Trigger Render and Vercel auto-deployment

### Mobile App Deployment

```bash
# Publish OTA update
eas update --branch production --message "Your update message"

# Build new native version (if needed)
eas build --platform all --profile production
```

## 🔒 Security Features

- Password hashing with bcryptjs
- API rate limiting
- Input sanitization
- CORS protection
- Health check endpoints
- Automated password audits

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary software for Oxford House.

## 🔗 Production URLs

- **Backend API**: https://oxford-mileage-backend.onrender.com
- **Web Portal**: [Your Vercel URL]
- **Mobile App**: Available via Expo Updates

## 📞 Support

For support or questions:
- Check documentation in `docs/` folder
- Review [Known Issues](admin-web/backend/KNOWN_ISSUES.md)
- Contact development team

## 🎉 Recent Updates

- ✅ Unified notification system with email support
- ✅ Clickable notifications with direct navigation
- ✅ Supervisor KPIs and analytics dashboard
- ✅ Comprehensive health checks and monitoring
- ✅ Automated database backups
- ✅ Password security audit tools
- ✅ API rate limiting
- ✅ Documentation organization

See [CHANGELOG.md](CHANGELOG.md) for full version history.

---

**Version**: 1.0.0  
**Last Updated**: December 2024
