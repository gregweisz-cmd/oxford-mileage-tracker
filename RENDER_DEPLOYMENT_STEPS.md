# Render Deployment Steps

## Project Status: ✅ Ready for Deployment

Your project is already configured for Render deployment with:
- ✅ `render.yaml` configuration file
- ✅ `package.json` with proper engines
- ✅ `Procfile` for Heroku compatibility
- ✅ Backend server code

## Step-by-Step Deployment

### 1. Push to GitHub (if not already done)

```bash
# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Commit changes
git commit -m "Prepare for Render deployment"

# Add remote repository (replace with your GitHub repo URL)
git remote add origin https://github.com/yourusername/oxford-mileage-tracker.git

# Push to GitHub
git push -u origin main
```

### 2. Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account
3. Verify your email address

### 3. Deploy Backend Service

1. **Click "New +"** in the Render dashboard
2. **Select "Web Service"**
3. **Connect your GitHub repository**
4. **Configure the service:**
   - **Name**: `oxford-mileage-backend`
   - **Root Directory**: `admin-web/backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

5. **Environment Variables:**
   - `NODE_ENV` = `production`
   - `PORT` = `3002`

6. **Click "Create Web Service"**

### 4. Wait for Deployment

- Render will automatically build and deploy your service
- This process takes 5-10 minutes
- You'll see build logs in real-time

### 5. Get Your Public URL

- Once deployed, you'll get a URL like: `https://oxford-mileage-backend.onrender.com`
- This is your backend API endpoint

### 6. Update Mobile App Configuration

Update `src/services/apiSyncService.ts` in your mobile app:

```javascript
const API_BASE_URL = Platform.OS === 'web' 
  ? 'http://localhost:3002/api' 
  : 'https://oxford-mileage-backend.onrender.com/api';
```

Replace `oxford-mileage-backend.onrender.com` with your actual Render URL.

### 7. Test the Connection

1. **Test the API endpoint:**
   - Visit: `https://your-app.onrender.com/api/stats`
   - Should return server statistics

2. **Test from mobile app:**
   - Open the mobile app
   - Go to Data Sync tab
   - Try manual sync (should work now!)

## Render Free Tier Limitations

- **750 hours/month** (enough for testing)
- **Sleeps after 15 minutes** of inactivity
- **512MB RAM**
- **No custom domains**

## Troubleshooting

### Common Issues:

1. **Build fails:**
   - Check build logs in Render dashboard
   - Ensure all dependencies are in `package.json`

2. **Service won't start:**
   - Check start command is correct
   - Verify port configuration

3. **API not accessible:**
   - Check if service is running
   - Verify environment variables

4. **CORS errors:**
   - Update CORS configuration in server.js
   - Add your mobile app domain to allowed origins

### Support:
- Render Documentation: [render.com/docs](https://render.com/docs)
- Render Community: [community.render.com](https://community.render.com)

## Next Steps After Deployment

1. ✅ Test the API endpoints
2. ✅ Update mobile app configuration
3. ✅ Test mobile app connection
4. ✅ Verify data sync works
5. ✅ Test from different locations

## Cost: $0/month (Free Tier)

Your backend will be accessible from anywhere with internet connection!
