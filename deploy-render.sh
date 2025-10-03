#!/bin/bash

# Oxford Mileage Tracker - Render Deployment Script
# This script prepares the project for Render deployment

echo "🚀 Preparing Oxford Mileage Tracker for Render deployment..."

# Navigate to backend directory
cd admin-web/backend

# Create render.yaml if it doesn't exist
if [ ! -f "render.yaml" ]; then
    echo "📝 Creating render.yaml configuration..."
    cat > render.yaml << EOF
services:
  - type: web
    name: oxford-mileage-backend
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3002
    healthCheckPath: /
EOF
fi

# Update package.json for Render
echo "📦 Updating package.json for Render..."
npm pkg set engines.node=">=16.0.0"
npm pkg set engines.npm=">=8.0.0"

echo "✅ Project prepared for Render deployment!"
echo ""
echo "📋 Next steps:"
echo "1. Push your code to GitHub"
echo "2. Go to https://render.com"
echo "3. Create a new Web Service"
echo "4. Connect your GitHub repository"
echo "5. Select the backend folder"
echo "6. Deploy!"
echo ""
echo "🔗 Your backend will be accessible from anywhere!"
