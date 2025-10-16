@echo off
echo ====================================
echo Clearing Expo and Metro Cache
echo ====================================
echo.

cd /d %~dp0

echo [1/4] Stopping Metro bundler...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Metro*" 2>nul

echo.
echo [2/4] Clearing Expo cache...
if exist .expo rmdir /s /q .expo
if exist node_modules\.cache rmdir /s /q node_modules\.cache

echo.
echo [3/4] Clearing Metro cache...
npx expo start --clear

echo.
echo [4/4] Cache cleared!
echo.
echo Now restart your app:
echo   - If on simulator/emulator: Reload the app (R key)
echo   - If on device: Close and reopen the app completely
echo.
pause

