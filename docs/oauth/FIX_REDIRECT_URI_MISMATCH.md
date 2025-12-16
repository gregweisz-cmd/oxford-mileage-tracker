# Fix Redirect URI Mismatch Error

## The Error
`error 400: redirect_uri_mismatch`

## What This Means
The redirect URI being sent doesn't **exactly** match what's registered in Google Cloud Console.

## The URI Being Sent
From your logs:
```
https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback
```

## Steps to Fix

### Step 1: Go to OAuth Client Settings

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your **Web application** OAuth Client ID:
   `893722301667-bqc8ir7q35omj6s84l7ackvqoqrhtrv6`

### Step 2: Check Authorized Redirect URIs

Look at the **"Authorized redirect URIs"** section.

### Step 3: Verify Exact Match

The URI must match **EXACTLY** (character-for-character):

**Required:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback
```

**Common Mismatches:**

❌ **Trailing slash:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback/
```

❌ **HTTP instead of HTTPS:**
```
http://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback
```

❌ **Extra spaces:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback 
```

❌ **Wrong path:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/callback
```

✅ **Correct:**
```
https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback
```

### Step 4: Add/Update the URI

1. **If the URI exists**: Check it character-by-character
2. **If the URI doesn't exist**: Add it
3. **If you see a similar URI**: Remove it and add the exact one above

### Step 5: Save and Wait

1. Click **"SAVE"**
2. Wait **2-3 minutes** for changes to propagate
3. Try OAuth again

## Quick Copy-Paste

Use this exact URI (no trailing slash, no spaces):
```
https://oxford-mileage-backend.onrender.com/api/auth/google/mobile/callback
```

