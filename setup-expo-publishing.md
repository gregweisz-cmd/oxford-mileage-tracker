# Expo Publishing Setup Guide

## Prerequisites
- Expo account (create at https://expo.dev if needed)
- GitHub account
- Node.js and npm installed

## Step-by-Step Setup

### 1. Login to Expo
```bash
cd "C:\Users\GooseWeisz\oxford-mileage-tracker"
npx expo login
```
- Enter your Expo username/email and password
- Complete 2FA if enabled

### 2. Configure EAS Build
```bash
npx eas build:configure
```
- This creates `eas.json` for build configuration
- Choose "iOS and Android" when prompted

### 3. Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `oxford-mileage-tracker`
3. Description: "Oxford House Staff Mileage and Expense Tracker"
4. Make it Public (recommended for easier sharing)
5. Don't initialize with README (we already have files)

### 4. Push Code to GitHub
```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit - Oxford House Mileage Tracker"

# Set main branch
git branch -M main

# Add GitHub remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/oxford-mileage-tracker.git

# Push to GitHub
git push -u origin main
```

### 5. Publish App with EAS Update
```bash
# Publish initial version
npx eas update --branch main --message "Initial app publish"

# For future updates
npx eas update --branch main --message "Your update message here"
```

## App Configuration

The app is already configured with:
- **Name**: OH Staff Tracker
- **Slug**: oh-staff-tracker
- **Owner**: goosew27
- **Bundle ID**: com.oxfordhouse.ohstafftracker

## Sharing the App

Once published, you can share the app using:

### Option 1: Expo Go App
1. Install Expo Go on your phone
2. Scan the QR code from the terminal output
3. App loads directly in Expo Go

### Option 2: Development Build
```bash
# Build for Android
npx eas build --platform android

# Build for iOS (requires Apple Developer account)
npx eas build --platform ios
```

### Option 3: Web Version
```bash
npx expo start --web
```

## Environment Variables

The app uses these environment variables:
- `GOOGLE_MAPS_API_KEY`: For map functionality
- `EXPO_TOKEN`: For CI/CD authentication

## Troubleshooting

### Common Issues:
1. **Login Issues**: Make sure you're using the correct Expo account
2. **Build Failures**: Check that all dependencies are installed (`npm install`)
3. **Permission Errors**: Ensure you have the right permissions for the repository

### Useful Commands:
```bash
# Check login status
npx expo whoami

# View current configuration
npx expo config

# Check for updates
npx expo doctor

# Clear cache if needed
npx expo start --clear
```

## Next Steps After Publishing

1. **Test the published app** on different devices
2. **Set up Google Maps API** for full functionality
3. **Configure backend URL** for cloud sync
4. **Add app icons and splash screens** if needed
5. **Set up automated builds** for releases
