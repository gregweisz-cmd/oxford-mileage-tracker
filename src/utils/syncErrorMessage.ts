const SESSION_EXPIRED_MESSAGE =
  'Your login session expired. Tap Log out (top right), sign in again, then try Sync.';

/** Plain-language sync errors for alerts (hides repeated JSON blobs). */
export function formatSyncErrorForUser(error?: string): string {
  if (!error?.trim()) {
    return 'Could not reach server. Check your connection and try again.';
  }
  const lower = error.toLowerCase();
  if (
    lower.includes('http 401') ||
    lower.includes('authentication required') ||
    lower.includes('invalid session')
  ) {
    return SESSION_EXPIRED_MESSAGE;
  }
  if (error.length > 320) {
    return `${error.slice(0, 320)}…`;
  }
  return error;
}
