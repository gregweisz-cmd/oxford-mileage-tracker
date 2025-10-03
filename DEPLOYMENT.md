# OH Staff Tracker - Deployment Guide

## 📱 Cross-Platform Deployment Options

Your **OH Staff Tracker** app is built with React Native and Expo, making it compatible with both iOS and Android platforms.

## 🚀 Option 1: Expo Go (Immediate Testing)

### **For iOS:**
1. Install **Expo Go** from the App Store
2. Scan the QR code with your iPhone camera
3. The app loads instantly!

### **For Android:**
1. Install **Expo Go** from Google Play Store
2. Scan the QR code with the Expo Go app
3. The app loads instantly!

**Advantages:**
- ✅ Instant testing on both platforms
- ✅ No app store approval needed
- ✅ Easy to share with team members
- ✅ Real-time updates

## 🏗️ Option 2: Standalone Apps (Production)

### **Prerequisites:**
- Expo account (free at [expo.dev](https://expo.dev))
- Apple Developer account (for iOS) - $99/year
- Google Play Console account (for Android) - $25 one-time

### **Build Process:**

#### **For Android:**
```bash
# Build Android APK
npx expo build:android

# Or build Android App Bundle (recommended)
npx expo build:android --type app-bundle
```

#### **For iOS:**
```bash
# Build iOS app (requires macOS)
npx expo build:ios
```

### **Modern Expo Build Service (EAS Build):**
```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build for both platforms
eas build --platform all
```

## 📋 App Store Submission

### **iOS App Store:**
1. Build the app using EAS Build
2. Download the `.ipa` file
3. Upload to App Store Connect
4. Submit for review
5. Wait for Apple approval (1-7 days)

### **Google Play Store:**
1. Build the app using EAS Build
2. Download the `.aab` file
3. Upload to Google Play Console
4. Submit for review
5. Wait for Google approval (1-3 days)

## 🔧 Configuration Details

### **App Identifiers:**
- **iOS Bundle ID**: `com.oxfordhouse.ohstafftracker`
- **Android Package**: `com.oxfordhouse.ohstafftracker`

### **Permissions:**
- **Location**: For GPS tracking
- **Camera**: For receipt photos
- **Storage**: For saving files

### **Features:**
- ✅ GPS Tracking
- ✅ Receipt Management
- ✅ PDF Generation
- ✅ Base Address (BA)
- ✅ Slack Integration
- ✅ Cross-Platform Support

## 🎯 Recommended Deployment Strategy

### **Phase 1: Testing (Expo Go)**
- Deploy immediately using Expo Go
- Test with Oxford House staff
- Gather feedback and make improvements

### **Phase 2: Internal Distribution**
- Build standalone apps using EAS Build
- Distribute via TestFlight (iOS) and Internal Testing (Android)
- Test with larger group

### **Phase 3: Public Release**
- Submit to App Store and Google Play
- Launch publicly for all Oxford House staff

## 📞 Support

For deployment assistance:
- Expo Documentation: [docs.expo.dev](https://docs.expo.dev)
- EAS Build Guide: [docs.expo.dev/build/introduction](https://docs.expo.dev/build/introduction)
- App Store Guidelines: [developer.apple.com/app-store](https://developer.apple.com/app-store)

## 🎉 Your App is Ready!

**OH Staff Tracker** is fully configured for both iOS and Android deployment. The app includes all necessary permissions and configurations for:

- 📱 **Mobile Apps**: Native iOS and Android
- 🌐 **Web App**: Responsive web version
- 📊 **Reports**: PDF and CSV generation
- 🔗 **Integration**: Slack export functionality

Choose your deployment method and get **OH Staff Tracker** into the hands of Oxford House staff!

