# Google Cloud Vision API Setup Guide

This guide will help you set up Google Cloud Vision API for automatic receipt OCR in the Oxford House Expense Tracker.

## Prerequisites

- A Google Cloud Platform account
- A credit card for billing (Google Cloud offers a free tier with $300 credit)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "New Project"
4. Enter project name: `oxford-house-expense-tracker`
5. Click "Create"

## Step 2: Enable the Vision API

1. In your new project, go to **APIs & Services** > **Library**
2. Search for "Cloud Vision API"
3. Click on "Cloud Vision API"
4. Click "Enable"

## Step 3: Create a Service Account

1. Go to **IAM & Admin** > **Service Accounts**
2. Click "Create Service Account"
3. Enter service account details:
   - **Name**: `vision-api-service`
   - **Description**: `Service account for Vision API OCR processing`
4. Click "Create and Continue"
5. Grant role: **Cloud Vision API User** (or **Project Editor** for broader access)
6. Click "Continue" and then "Done"

## Step 4: Create and Download Service Account Key

1. Click on the service account you just created
2. Go to the **Keys** tab
3. Click "Add Key" > "Create new key"
4. Choose **JSON** format
5. Click "Create" - the JSON file will be downloaded
6. **IMPORTANT**: Save this file securely - it contains your credentials

## Step 5: Configure Environment Variables

### For Local Development

1. Place the downloaded JSON file in the backend directory:
   - Save it as `admin-web/backend/vision-service-account.json` (or similar name)

2. Create a `.env` file in `admin-web/backend/`:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=vision-service-account.json
   ```

3. **IMPORTANT**: The `.env` file and JSON credentials are already added to `.gitignore` to prevent committing credentials

### For Render.com Production

1. Go to your Render.com dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Add environment variable:
   - **Key**: `GOOGLE_APPLICATION_CREDENTIALS`
   - **Value**: The full path to your JSON file on Render

**Alternative approach for Render:**

Since Render doesn't easily support JSON files, you can:

1. Base64 encode your JSON file:
   ```bash
   cat vision-service-account.json | base64
   ```

2. Store the base64 string in an environment variable on Render:
   - **Key**: `GOOGLE_APPLICATION_CREDENTIALS_B64`
   
3. Update `server.js` to decode this on startup (we can add this helper code)

## Step 6: Test the Integration

Once configured, test the OCR endpoint:

```bash
POST http://localhost:3002/api/receipts/ocr
Content-Type: application/json

{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."  // or
  "imagePath": "path/to/image.jpg"
}
```

## Pricing

Google Cloud Vision API pricing (as of 2024):

- **First 1,000 units per month**: FREE
- **1,001 - 5,000,000 units**: $1.50 per 1,000 units
- **5,000,001+ units**: $0.60 per 1,000 units

1 unit = 1 image processed

**Example monthly costs:**
- 100 receipts/month: FREE
- 500 receipts/month: FREE
- 1,000 receipts/month: FREE
- 5,000 receipts/month: ~$6.00
- 10,000 receipts/month: ~$13.50

## Security Best Practices

1. **Never commit credentials to git** - Add service account JSON files to `.gitignore`
2. **Rotate keys regularly** - Generate new keys every 90 days
3. **Limit permissions** - Only grant necessary roles to service account
4. **Monitor usage** - Set up billing alerts in Google Cloud Console
5. **Use different credentials** for development vs production

## Troubleshooting

### Error: "Could not load the default credentials"

- Make sure `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set
- Verify the path to the JSON file is correct
- Check file permissions (should be readable)

### Error: "API not enabled"

- Go to APIs & Services in Google Cloud Console
- Ensure "Cloud Vision API" is enabled

### Error: "Permission denied"

- Verify the service account has "Cloud Vision API User" role
- Check that billing is enabled for the project

## Next Steps

Once set up, the OCR endpoint is available at:
- **Local**: `http://localhost:3002/api/receipts/ocr`
- **Production**: `https://oxford-mileage-backend.onrender.com/api/receipts/ocr`

The mobile app will automatically use this endpoint when users upload receipt images.

