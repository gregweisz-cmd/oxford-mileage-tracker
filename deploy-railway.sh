#!/bin/bash

# Oxford Mileage Tracker - Railway Deployment Script
# This script deploys the backend to Railway for cloud access

echo "🚀 Deploying Oxford Mileage Tracker to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed. Installing..."
    npm install -g @railway/cli
fi

# Navigate to backend directory
cd admin-web/backend

# Login to Railway
echo "🔐 Logging into Railway..."
railway login

# Initialize Railway project
echo "📦 Initializing Railway project..."
railway init

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up

# Get the public URL
echo "🌐 Getting public URL..."
railway domain

echo "✅ Deployment complete!"
echo "📱 Update your mobile app configuration with the Railway URL"
echo "🔗 Your backend is now accessible from anywhere!"
