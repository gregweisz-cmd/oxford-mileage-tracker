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
