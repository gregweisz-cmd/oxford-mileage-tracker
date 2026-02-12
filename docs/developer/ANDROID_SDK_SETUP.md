# Android SDK setup (Windows)

If `npx expo run:android` fails with:

- **Failed to resolve the Android SDK path** (default `C:\Users\<You>\AppData\Local\Android\Sdk` not found)
- **'adb' is not recognized**

do the following.

## 1. Install Android Studio (if needed)

1. Download [Android Studio](https://developer.android.com/studio).
2. Run the installer and complete the setup.
3. Open Android Studio → **More Actions** or **Configure** → **SDK Manager**.
4. Note the **Android SDK location** (e.g. `C:\Users\<You>\AppData\Local\Android\Sdk`).
5. Under **SDK Platforms**, install at least one Android version (e.g. **Android 14**).
6. Under **SDK Tools**, ensure **Android SDK Platform-Tools** (includes `adb`) is installed.

## 2. Set ANDROID_HOME

Use your actual SDK path from step 1.

**Current PowerShell session only:**

```powershell
$env:ANDROID_HOME = "C:\Users\GooseWeisz\AppData\Local\Android\Sdk"
$env:Path += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator"
```

**Permanently (user environment):**

```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Users\GooseWeisz\AppData\Local\Android\Sdk", "User")
$path = [System.Environment]::GetEnvironmentVariable("Path", "User")
$path += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator"
[System.Environment]::SetEnvironmentVariable("Path", $path, "User")
```

Then **close and reopen** PowerShell/terminal so the new `Path` is picked up.

## 3. If SDK is in a different folder

If you installed the SDK somewhere else (e.g. `C:\Android\Sdk`), use that path instead of `C:\Users\GooseWeisz\AppData\Local\Android\Sdk` in the commands above.

## 4. Verify

```powershell
# Should print your SDK path
echo $env:ANDROID_HOME

# Should run adb (version or help)
adb version
```

Then run:

```powershell
npx expo run:android
```

---

## Emulator timeout

If you see **"It took too long to start the Android emulator"**:

**Option A – Use a physical device (recommended)**  
Connect your Android phone via USB, enable **Developer options** and **USB debugging**, then:

```powershell
npx expo run:android --device
```

Expo will build and install on the phone and won’t try to start the emulator.

**Option B – Start the emulator first**  
In a **separate** PowerShell window, start the emulator and wait until it’s fully booted:

```powershell
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd Medium_Phone_API_36.1
```

When the home screen is visible, run in your project folder:

```powershell
npx expo run:android
```

---

## Expo Go on Android (app won’t load / works on iPhone only)

If the app loads in **Expo Go on iPhone** but **not on your Android phone** when you scan the QR code or open the same dev server:

### 1. Use tunnel mode (recommended)

Tunnel mode gives you a public URL so the phone doesn't need to be on the same Wi-Fi as your PC.

**Set your Expo access token (required for tunnel).** If you see `CommandError: ngrok tunnel took too long to connect`, your token may be missing or expired. Create or regenerate a token at [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens), then set it before starting:

**Current PowerShell session (recommended so the token is not stored in a file):**

```powershell
$env:EXPO_TOKEN = "your_expo_personal_access_token_here"
npx expo start --tunnel
```

**Permanently (Windows user environment):**  
Windows key → search "Environment variables" → Edit environment variables for your account → New → Variable name: `EXPO_TOKEN`, Value: your token. OK out, then **close and reopen** your terminal and run `npx expo start --tunnel`.

- First run may install `@expo/ngrok` if needed.
- Scan the **tunnel** QR code with Expo Go on Android (or type the `exp://...` URL).
- Slower than LAN but usually fixes “works on iPhone, not Android” when the Android device can’t reach your PC’s IP.

### 2. If you prefer LAN (no tunnel)

- Put **Android and PC on the same Wi‑Fi** (not guest network).
- In the terminal where you ran `npx expo start`, use the URL shown for **Android** (e.g. `exp://192.168.x.x:8081`). If you only see an iOS URL, press `a` to open on Android or show the Android URL.
- **Windows firewall**: allow inbound TCP on port **8081** for “Private” networks so your phone can reach Metro.  
  **Windows Security → Firewall & network protection → Advanced settings → Inbound Rules → New Rule → Port → TCP 8081 → Allow the connection → Private.**

### 3. App opens but white screen or crashes on Android

- In the terminal running `npx expo start`, check for red errors when the app loads on the phone.
- On the Android device: **Expo Go → clear app data/cache** for the project (or uninstall/reinstall Expo Go), then try again.
- Try tunnel mode (step 1); if it works there, the issue is likely LAN/firewall.
