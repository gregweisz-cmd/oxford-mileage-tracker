import { useEffect, useRef } from 'react';

/**
 * useVisibilityPolling — runs `callback` on an interval, but pauses while the
 * tab is hidden (document.visibilityState === 'hidden'). When the tab becomes
 * visible again it fires `callback` once immediately to catch up, then resumes
 * the normal interval cadence.
 *
 * This is meaningfully cheaper than a plain setInterval for staff/supervisor
 * portals that often stay open in background tabs all day, where pure interval
 * polling would otherwise hammer the API needlessly.
 *
 * Pass `enabled: false` (or omit the callback dependency target) to halt
 * polling entirely.
 */
export function useVisibilityPolling(
  callback: () => void,
  intervalMs: number,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  // Keep latest callback in a ref so we don't restart the interval on every
  // render when the caller passes an inline function.
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer != null) return;
      timer = setInterval(() => {
        try {
          callbackRef.current();
        } catch {
          // Swallow errors so a single bad tick doesn't kill the interval.
        }
      }, intervalMs);
    };

    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        // Catch up immediately so the user doesn't see stale data on focus,
        // then resume the regular interval cadence.
        try {
          callbackRef.current();
        } catch {
          // ignore
        }
        start();
      } else {
        stop();
      }
    };

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      start();
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      stop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [enabled, intervalMs]);
}
