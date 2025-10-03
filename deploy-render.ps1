# Oxford Mileage Tracker - Render Deployment Script (PowerShell)
# This script prepares the project for Render deployment

Write-Host "🚀 Preparing Oxford Mileage Tracker for Render deployment..." -ForegroundColor Green

# Navigate to backend directory
Set-Location "admin-web\backend"

# Create render.yaml if it doesn't exist
if (-not (Test-Path "render.yaml")) {
    Write-Host "📝 Creating render.yaml configuration..." -ForegroundColor Yellow
    @"
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
"@ | Out-File -FilePath "render.yaml" -Encoding UTF8
}

# Update package.json for Render
Write-Host "📦 Updating package.json for Render..." -ForegroundColor Yellow

# Read package.json
$packageJson = Get-Content "package.json" | ConvertFrom-Json

# Add engines if not present
if (-not $packageJson.engines) {
    $packageJson | Add-Member -MemberType NoteProperty -Name "engines" -Value @{
        node = ">=16.0.0"
        npm = ">=8.0.0"
    }
} else {
    $packageJson.engines.node = ">=16.0.0"
    $packageJson.engines.npm = ">=8.0.0"
}

# Save updated package.json
$packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json" -Encoding UTF8

Write-Host "✅ Project prepared for Render deployment!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Push your code to GitHub" -ForegroundColor White
Write-Host "2. Go to https://render.com" -ForegroundColor White
Write-Host "3. Create a new Web Service" -ForegroundColor White
Write-Host "4. Connect your GitHub repository" -ForegroundColor White
Write-Host "5. Select the admin-web/backend folder" -ForegroundColor White
Write-Host "6. Deploy!" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Your backend will be accessible from anywhere!" -ForegroundColor Green
