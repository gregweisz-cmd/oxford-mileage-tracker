/**
 * Expo app config. Used when present instead of app.json.
 * Injects GOOGLE_MAPS_API_KEY from env at build time so the key is never committed.
 * Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in EAS secrets or locally for builds.
 */
const appJson = require('./app.json');

module.exports = () => {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || appJson.expo.extra?.googleMapsApiKey;
  return {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      googleMapsApiKey: key || 'YOUR_GOOGLE_MAPS_API_KEY_HERE',
    },
  };
};
