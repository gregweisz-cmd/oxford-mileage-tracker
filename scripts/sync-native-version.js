/**
 * Sync native store versions from app.json:
 * - android/app/build.gradle: versionCode + versionName (EAS uses native android/)
 * - ios: CFBundleVersion / CURRENT_PROJECT_VERSION / MARKETING_VERSION (EAS uses native ios/)
 *
 * Usage: node scripts/sync-native-version.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const appJsonPath = path.join(root, 'app.json');
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
const iosInfoPlistPath = path.join(root, 'ios', 'OxfordHouseExpenseTracker', 'Info.plist');
const iosPbxprojPath = path.join(root, 'ios', 'OxfordHouseExpenseTracker.xcodeproj', 'project.pbxproj');

function syncNativeVersion({ dryRun = false } = {}) {
  const raw = fs.readFileSync(appJsonPath, 'utf8');
  const app = JSON.parse(raw);
  const expo = app.expo;

  const versionCode = expo.android?.versionCode;
  const versionName = expo.version;
  const iosBuildNumber =
    expo.ios?.buildNumber != null ? String(expo.ios.buildNumber).trim() : null;

  if (versionCode == null || Number.isNaN(Number(versionCode))) {
    throw new Error('app.json: expo.android.versionCode must be a number');
  }
  if (!versionName || typeof versionName !== 'string') {
    throw new Error('app.json: expo.version is required');
  }

  let gradleUpdated = false;
  let iosUpdated = false;

  if (fs.existsSync(gradlePath)) {
    let gradle = fs.readFileSync(gradlePath, 'utf8');
    const nextGradle = gradle
      .replace(/versionCode \d+/, `versionCode ${Number(versionCode)}`)
      .replace(/versionName "[^"]*"/, `versionName "${versionName}"`);

    if (nextGradle !== gradle) {
      if (dryRun) {
        console.log('[dry-run] Would set Gradle versionCode', versionCode, 'versionName', versionName);
      } else {
        fs.writeFileSync(gradlePath, nextGradle);
        console.log(
          `Synced android/app/build.gradle → versionCode ${versionCode}, versionName "${versionName}"`
        );
        gradleUpdated = true;
      }
    } else {
      console.log('android/app/build.gradle already matches app.json (no file change).');
    }
  } else {
    console.warn('android/app/build.gradle not found; skipping Gradle sync.');
  }

  if (fs.existsSync(iosInfoPlistPath)) {
    if (!iosBuildNumber) {
      throw new Error('app.json: expo.ios.buildNumber is required when ios/ is present');
    }
    let plist = fs.readFileSync(iosInfoPlistPath, 'utf8');
    const nextPlist = plist
      .replace(
        /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*/,
        `$1${iosBuildNumber}`
      )
      .replace(
        /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*/,
        `$1${versionName}`
      );

    if (nextPlist !== plist) {
      if (dryRun) {
        console.log('[dry-run] Would set iOS CFBundleVersion', iosBuildNumber, 'CFBundleShortVersionString', versionName);
      } else {
        fs.writeFileSync(iosInfoPlistPath, nextPlist);
        console.log(
          `Synced ios/.../Info.plist → CFBundleVersion ${iosBuildNumber}, CFBundleShortVersionString "${versionName}"`
        );
        iosUpdated = true;
      }
    }
  }

  if (fs.existsSync(iosPbxprojPath) && iosBuildNumber) {
    let pbx = fs.readFileSync(iosPbxprojPath, 'utf8');
    const nextPbx = pbx
      .replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${iosBuildNumber};`)
      .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${versionName};`);

    if (nextPbx !== pbx) {
      if (dryRun) {
        console.log('[dry-run] Would set Xcode CURRENT_PROJECT_VERSION / MARKETING_VERSION');
      } else {
        fs.writeFileSync(iosPbxprojPath, nextPbx);
        console.log(
          `Synced ios/.../project.pbxproj → CURRENT_PROJECT_VERSION ${iosBuildNumber}, MARKETING_VERSION ${versionName}`
        );
        iosUpdated = true;
      }
    }
  }

  return { versionCode, versionName, iosBuildNumber, gradleUpdated, iosUpdated };
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  try {
    syncNativeVersion({ dryRun });
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
}

module.exports = { syncNativeVersion };
