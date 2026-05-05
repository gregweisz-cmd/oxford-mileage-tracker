/**
 * Fallback for client-side anomaly hints only.
 * Supervisor alerts use the admin-configured threshold on the server (`notification_event_settings.hoursThreshold`).
 */
export const FALLBACK_WEEKLY_HOURS_ALERT_THRESHOLD = 60;
