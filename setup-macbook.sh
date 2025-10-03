#!/bin/bash

# Oxford Mileage Tracker - MacBook Setup Script
# This script sets up the backend server on MacBook

echo "🚀 Setting up Oxford Mileage Tracker Backend Server on MacBook..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Navigate to backend directory
cd admin-web/backend

# Install dependencies
echo "📦 Installing backend dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Check if database file exists
if [ ! -f "../../oxford_tracker.db" ]; then
    echo "⚠️  Database file not found. The server will create a sample database."
else
    echo "✅ Database file found"
fi

# Get MacBook IP address
MACBOOK_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
echo "🌐 MacBook IP address: $MACBOOK_IP"

# Create environment file
cat > .env << EOF
PORT=3002
NODE_ENV=development
MACBOOK_IP=$MACBOOK_IP
EOF

echo "✅ Environment file created"

# Start the server
echo "🚀 Starting backend server..."
echo "📊 Server will be available at: http://localhost:3002"
echo "📱 Mobile app should connect to: http://$MACBOOK_IP:3002"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start
