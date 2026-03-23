/**
 * Bump store release numbers before `eas build`:
 * - Android: expo.android.versionCode (Play requires each upload to increase)
 * - iOS: expo.ios.buildNumber (TestFlight/App Store)
 * - Marketing: expo.version (semver patch) + expo.runtimeVersion + package.json version
 *
 * Usage:
 *   node scripts/bump-store-version.js           # full bump (patch version + build numbers)
 *   node scripts/bump-store-version.js --build-only   # only versionCode + iOS buildNumber (same marketing version)
 *   node scripts/bump-store-version.js --dry-run
 */
const fs = require('fs');
const path = require('path');
const { syncNativeVersion } = require('./sync-native-version');

const root = path.join(__dirname, '..');
const appJsonPath = path.join(root, 'app.json');
const packageJsonPath = path.join(root, 'package.json');

function bumpPatch(semver) {
  const parts = String(semver).trim().split('.');
  if (parts.length !== 3) {
    throw new Error(`expo.version must be semver x.y.z (got "${semver}")`);
  }
  const patch = parseInt(parts[2], 10);
  if (Number.isNaN(patch)) {
    throw new Error(`Invalid patch in version "${semver}"`);
  }
  return `${parts[0]}.${parts[1]}.${patch + 1}`;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const buildOnly = process.argv.includes('--build-only');

  const raw = fs.readFileSync(appJsonPath, 'utf8');
  const app = JSON.parse(raw);
  const expo = app.expo;

  if (!expo.android) expo.android = {};
  if (!expo.ios) expo.ios = {};

  const prevCode = Number(expo.android.versionCode ?? 0);
  expo.android.versionCode = prevCode + 1;

  const prevBuild = parseInt(String(expo.ios.buildNumber || '0'), 10);
  expo.ios.buildNumber = String(prevBuild + 1);

  if (!buildOnly) {
    expo.version = bumpPatch(expo.version);
    expo.runtimeVersion = expo.version;
  }

  const summary = {
    version: expo.version,
    runtimeVersion: expo.runtimeVersion,
    androidVersionCode: expo.android.versionCode,
    iosBuildNumber: expo.ios.buildNumber,
  };

  if (dryRun) {
    console.log('[dry-run] Would set:', summary);
    return;
  }

  fs.writeFileSync(appJsonPath, JSON.stringify(app, null, 2) + '\n');
  console.log('Updated app.json:', summary);

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  pkg.version = expo.version;
  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('Updated package.json version →', expo.version);

  syncNativeVersion();
  console.log('\nNext: commit app.json (and android/app/build.gradle if changed), then: eas build --platform all --profile production');
}

try {
  main();
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
