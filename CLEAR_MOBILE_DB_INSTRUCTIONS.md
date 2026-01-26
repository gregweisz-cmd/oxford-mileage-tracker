# How to Clear Mobile App Local Database

## The Problem
The mobile app's local SQLite database still contains old data (like the 5520-mile entry). Even though we cleared the backend, the mobile app is syncing its old local data BACK to the backend, which then restores it.

## Solution: Clear Mobile App Database

### Option 1: Delete and Reinstall App (Easiest)
1. Delete the app from your device
2. Reinstall from Expo.dev
3. Login again
4. The database will be fresh

### Option 2: Clear App Data (Android)
1. Settings → Apps → Oxford Mileage Tracker
2. Storage → Clear Data
3. Reopen app and login

### Option 3: Clear App Data (iOS)
1. Settings → General → iPhone Storage
2. Find Oxford Mileage Tracker
3. Delete App
4. Reinstall from Expo.dev
5. Login again

## After Clearing
Once you clear the database:
1. ✅ Backend is already cleared (we did that)
2. ✅ Mobile app database will be fresh
3. ✅ New entries will sync correctly
4. ✅ Deleted entries won't come back

## What We Fixed
- ✅ Stopped syncing mileage entries FROM backend (mobile is now truly source of truth)
- ✅ This prevents deleted data from being restored
