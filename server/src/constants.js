export const SOFT_ALERT_SEC = 5;
export const ALARM_SEC = 15;
export const ALARM_SOUND_DURATION_SEC = 45; // how long the alarm sound plays; stops 60s after distraction onset
export const DISTRACTION_FLOOR_SEC = 0.8;
export const SPEED_THRESHOLD_MPH = 5;

export const RIDE_TTL_MS = 2 * 60 * 60 * 1000; // evict any ride (live or ended) older than this
export const RIDE_CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // how often to sweep for stale rides
