# OH Staff Tracker

A cross-platform mobile and web application for Oxford House employees to track mileage, manage receipts, and export data to Slack.

## Features

### 🚗 Mileage Tracking
- Add, edit, and delete mileage entries
- Track start/end locations, purpose, miles, and vehicle used
- Date picker for easy entry management
- Notes field for additional details

### 📊 Monthly Reports
- Generate monthly mileage reports
- View total miles and entry counts
- Export reports to CSV format
- Share reports locally or export to Slack

### 📱 Cross-Platform Support
- **Mobile**: Native iOS and Android apps via Expo
- **Web**: Responsive web application
- **Offline**: Local SQLite database for offline functionality

### 🔗 Slack Integration
- Export monthly reports directly to Slack channels
- Configurable webhook URLs and bot tokens
- Automatic CSV file generation and upload

## Technology Stack

- **Frontend**: React Native with Expo
- **Navigation**: React Navigation
- **Database**: SQLite (expo-sqlite)
- **UI Components**: Material Icons, Custom Components
- **File Handling**: Expo File System
- **Sharing**: Expo Sharing
- **Date Picking**: React Native Community DateTimePicker

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd oxford-mileage-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

### Running the App

#### Web
```bash
npm run web
```

#### Mobile (iOS)
```bash
npm run ios
```

#### Mobile (Android)
```bash
npm run android
```

## Usage

### Adding Mileage Entries
1. Open the app and tap "Add Mileage Entry"
2. Fill in the required fields:
   - Date of travel
   - Start location
   - End location
   - Purpose of travel
   - Miles traveled
   - Vehicle used
   - Optional notes
3. Tap "Save Entry"

### Generating Reports
1. Navigate to the "Reports" screen
2. Tap "Generate Current Month Report"
3. View your monthly summary
4. Export to Slack or share locally

### Slack Configuration
1. Go to Reports screen
2. Tap the settings icon
3. Enter your Slack webhook URL and channel
4. Optionally add a bot token for enhanced functionality
5. Save configuration

## Project Structure

```
src/
├── components/          # Reusable UI components
├── screens/            # Main app screens
│   ├── HomeScreen.tsx
│   ├── MileageEntryScreen.tsx
│   └── ReportsScreen.tsx
├── services/           # Business logic and API services
│   ├── database.ts     # SQLite database operations
│   └── slackService.ts # Slack integration
├── types/              # TypeScript type definitions
│   └── index.ts
└── utils/              # Utility functions
```

## Database Schema

### Employees Table
- `id`: Primary key
- `name`: Employee name
- `email`: Email address
- `oxfordHouseId`: Associated Oxford House
- `position`: Job title
- `phoneNumber`: Contact number
- `createdAt`, `updatedAt`: Timestamps

### Mileage Entries Table
- `id`: Primary key
- `employeeId`: Foreign key to employees
- `oxfordHouseId`: Associated Oxford House
- `date`: Date of travel
- `startLocation`, `endLocation`: Travel locations
- `purpose`: Reason for travel
- `miles`: Distance traveled
- `vehicleUsed`: Vehicle information
- `notes`: Additional notes
- `createdAt`, `updatedAt`: Timestamps

### Monthly Reports Table
- `id`: Primary key
- `employeeId`: Foreign key to employees
- `month`, `year`: Report period
- `totalMiles`: Sum of miles for the month
- `status`: Report status (draft, submitted, approved)
- `submittedAt`, `approvedAt`: Status timestamps
- `createdAt`, `updatedAt`: Timestamps

## Slack Integration Setup

### Webhook Method
1. Create a Slack app in your workspace
2. Enable Incoming Webhooks
3. Create a webhook URL
4. Configure the channel in the app

### Bot Token Method (Recommended)
1. Create a Slack app
2. Add OAuth scopes: `files:write`, `chat:write`
3. Install the app to your workspace
4. Copy the bot token
5. Configure in the app

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions, please contact the development team or create an issue in the repository.
