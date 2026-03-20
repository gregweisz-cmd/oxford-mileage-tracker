/**
 * Sync android/app/build.gradle versionCode + versionName from app.json.
 * EAS uses the native android/ project; app.json android.versionCode is ignored at build time
 * unless we keep Gradle in sync (this script).
 *
 * Usage: node scripts/sync-native-version.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const appJsonPath = path.join(root, 'app.json');
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');

function syncNativeVersion({ dryRun = false } = {}) {
  const raw = fs.readFileSync(appJsonPath, 'utf8');
  const app = JSON.parse(raw);
  const expo = app.expo;

  const versionCode = expo.android?.versionCode;
  const versionName = expo.version;

  if (versionCode == null || Number.isNaN(Number(versionCode))) {
    throw new Error('app.json: expo.android.versionCode must be a number');
  }
  if (!versionName || typeof versionName !== 'string') {
    throw new Error('app.json: expo.version is required');
  }

  if (!fs.existsSync(gradlePath)) {
    console.warn('android/app/build.gradle not found; skipping Gradle sync.');
    return { versionCode, versionName, gradleUpdated: false };
  }

  let gradle = fs.readFileSync(gradlePath, 'utf8');
  const next = gradle
    .replace(/versionCode \d+/, `versionCode ${Number(versionCode)}`)
    .replace(/versionName "[^"]*"/, `versionName "${versionName}"`);

  if (next === gradle) {
    console.log('android/app/build.gradle already matches app.json (no file change).');
    return { versionCode, versionName, gradleUpdated: false };
  }

  if (dryRun) {
    console.log('[dry-run] Would set versionCode', versionCode, 'versionName', versionName);
    return { versionCode, versionName, gradleUpdated: false };
  }

  fs.writeFileSync(gradlePath, next);
  console.log(`Synced android/app/build.gradle → versionCode ${versionCode}, versionName "${versionName}"`);
  return { versionCode, versionName, gradleUpdated: true };
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
