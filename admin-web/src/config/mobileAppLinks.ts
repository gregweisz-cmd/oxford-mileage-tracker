/** Override with REACT_APP_IOS_APP_URL / REACT_APP_ANDROID_APP_URL when store links change. */
export const MOBILE_APP_LINKS = {
  ios:
    process.env.REACT_APP_IOS_APP_URL ||
    'https://apps.apple.com/us/app/testflight/id899247664',
  android:
    process.env.REACT_APP_ANDROID_APP_URL ||
    'https://play.google.com/apps/internaltest/4701544356101901260',
  support: 'https://expense.oxfordhouse.org/support.html',
  mobileHowTo: 'https://expense.oxfordhouse.org/docs/Mobile-App-How-To.pdf',
} as const;
