@echo off
echo Setting up Oxford House Mileage Tracker for Expo Publishing...
echo.

echo Step 1: Checking Expo CLI...
npx expo --version
if %errorlevel% neq 0 (
    echo Error: Expo CLI not found. Please install it first.
    pause
    exit /b 1
)

echo.
echo Step 2: Checking EAS CLI...
npx eas --version
if %errorlevel% neq 0 (
    echo Error: EAS CLI not found. Please install it first.
    pause
    exit /b 1
)

echo.
echo Step 3: Checking login status...
npx expo whoami
if %errorlevel% neq 0 (
    echo You need to login to Expo first.
    echo Please run: npx expo login
    pause
    exit /b 1
)

echo.
echo Step 4: Configuring EAS Build...
npx eas build:configure

echo.
echo Step 5: Checking git status...
git status
if %errorlevel% neq 0 (
    echo Git not initialized. Please run:
    echo git init
    echo git add .
    echo git commit -m "Initial commit"
    pause
    exit /b 1
)

echo.
echo Setup complete! Next steps:
echo 1. Create a GitHub repository
echo 2. Add remote: git remote add origin https://github.com/YOUR_USERNAME/oxford-mileage-tracker.git
echo 3. Push: git push -u origin main
echo 4. Publish: npx eas update --branch main --message "Initial publish"
echo.
pause
