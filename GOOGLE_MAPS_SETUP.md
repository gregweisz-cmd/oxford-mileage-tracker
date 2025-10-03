# Google Maps API Setup Guide

## Why Set Up Google Maps API?

The distance calculator in OH Staff Tracker can work in two modes:

1. **With Google Maps API** (Recommended): Provides accurate route-based distances using real driving directions
2. **Without Google Maps API** (Fallback): Uses free geocoding services with estimated driving distances (40% buffer over straight-line distance)

## Current Status

The app is currently using the **fallback method** because the Google Maps API key is not configured. This provides reasonable estimates but may not be as accurate as Google Maps routing.

## How to Set Up Google Maps API

### Step 1: Get a Google Maps API Key

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create or Select a Project**
   - Click "Select a project" at the top
   - Click "New Project" if you don't have one
   - Give it a name like "OH Staff Tracker"

3. **Enable Required APIs**
   - Go to "APIs & Services" > "Library"
   - Search for and enable these APIs:
     - **Maps JavaScript API**
     - **Distance Matrix API**
     - **Geocoding API**

4. **Create API Key**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key

### Step 2: Configure the App

1. **Open the app configuration file**
   - Navigate to: `oxford-mileage-tracker/app.json`

2. **Replace the placeholder API key**
   - Find the line: `"googleMapsApiKey": "YOUR_GOOGLE_MAPS_API_KEY_HERE"`
   - Replace `YOUR_GOOGLE_MAPS_API_KEY_HERE` with your actual API key
   - Example: `"googleMapsApiKey": "AIzaSyBvOkBwvBwvBwvBwvBwvBwvBwvBwvBwvBw"`

3. **Save the file**

### Step 3: Restart the App

1. **Stop the development server** (Ctrl+C)
2. **Start it again**: `npx expo start --clear`
3. **Test the distance calculator** using the "Test" button

## Testing the Setup

### Method 1: Use the Test Button
1. Go to **Mileage Entry** screen
2. Tap the **"Test"** button next to the Calculate button
3. The test will show you:
   - Whether Google Maps API is working
   - What method is being used
   - A sample distance calculation

### Method 2: Try Distance Calculation
1. Enter two addresses in the Mileage Entry screen
2. Tap **"Calculate"**
3. If Google Maps is working, you'll see "Method: Google Maps route"
4. If not, you'll see "Method: estimated driving distance"

## API Key Security (Important!)

### Restrict Your API Key
1. **Go back to Google Cloud Console**
2. **Click on your API key** in the Credentials section
3. **Set Application Restrictions**:
   - Choose "Android apps" or "iOS apps"
   - Add your app's bundle ID: `com.oxfordhouse.ohstafftracker`
4. **Set API Restrictions**:
   - Choose "Restrict key"
   - Select only the APIs you enabled:
     - Maps JavaScript API
     - Distance Matrix API
     - Geocoding API

### Monitor Usage
- Go to "APIs & Services" > "Dashboard" to monitor usage
- Set up billing alerts if needed
- Google provides $200 free credit per month for most APIs

## Troubleshooting

### Common Issues

1. **"API key not valid"**
   - Check that you copied the key correctly
   - Ensure the APIs are enabled
   - Wait a few minutes for changes to propagate

2. **"This API project is not authorized"**
   - Make sure you enabled the required APIs
   - Check that billing is enabled (even with free credits)

3. **"Quota exceeded"**
   - You've hit the free tier limits
   - Consider upgrading to a paid plan
   - Or use the fallback method for now

4. **Distance calculation still not working**
   - Check your internet connection
   - Try the "Test" button to diagnose the issue
   - Check the console logs for detailed error messages

### Fallback Method Details

If Google Maps API is not available, the app uses:
- **Nominatim (OpenStreetMap)** for free geocoding
- **Haversine formula** for straight-line distance
- **40% buffer** to estimate driving distance
- **Keyword matching** for common locations

This provides reasonable estimates but may not be as accurate as Google Maps routing.

## Cost Information

### Google Maps API Pricing (as of 2024)
- **Distance Matrix API**: $5 per 1,000 requests
- **Geocoding API**: $5 per 1,000 requests
- **Free tier**: $200 credit per month (40,000 requests)

### Typical Usage
- Each distance calculation = 2 geocoding requests + 1 distance matrix request
- Cost per calculation: ~$0.015
- With free tier: ~13,000 calculations per month

## Support

If you need help with the setup:
1. Check the console logs for detailed error messages
2. Use the "Test" button to diagnose issues
3. Verify your API key is working at: https://developers.google.com/maps/documentation/distance-matrix/overview

---

**Note**: The app will work fine without Google Maps API, but setting it up will provide the most accurate distance calculations for your Oxford House mileage tracking.