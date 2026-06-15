const MOBILE_UA_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export function isMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return MOBILE_UA_PATTERN.test(navigator.userAgent);
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches;
}

/** True when the visitor is likely on a phone or small tablet browser. */
export function isMobileWebClient(): boolean {
  return isMobileUserAgent() || isMobileViewport();
}

export function getMobilePlatform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

const MOBILE_NOTICE_DISMISSED_KEY = 'oxford_mobile_web_notice_dismissed';
const MOBILE_WEB_PORTAL_DEFAULT_KEY = 'oxford_mobile_web_portal_default';

export function shouldShowMobileWebNotice(): boolean {
  if (!isMobileWebClient()) return false;
  if (typeof window !== 'undefined') {
    if (new URLSearchParams(window.location.search).get('desktop') === '1') {
      return false;
    }
    if (localStorage.getItem(MOBILE_WEB_PORTAL_DEFAULT_KEY) === '1') {
      return false;
    }
    if (sessionStorage.getItem(MOBILE_NOTICE_DISMISSED_KEY) === '1') {
      return false;
    }
  }
  return true;
}

export function acknowledgeMobileWebNotice(): void {
  sessionStorage.setItem(MOBILE_NOTICE_DISMISSED_KEY, '1');
}

/** Remember on this device to open the web portal directly (skip the app prompt). */
export function setMobileWebPortalAsDeviceDefault(): void {
  localStorage.setItem(MOBILE_WEB_PORTAL_DEFAULT_KEY, '1');
  acknowledgeMobileWebNotice();
}
