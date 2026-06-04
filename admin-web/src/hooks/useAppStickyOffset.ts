import { useLayoutEffect, useRef, type RefObject } from 'react';

const STICKY_OFFSET_VAR = '--app-sticky-offset';

/**
 * Measures sticky portal chrome (EnhancedHeader) and publishes height as --app-sticky-offset
 * on scopeEl so table headers stick below it (works inside MUI dialogs, not only document root).
 */
export function useAppStickyOffset<T extends HTMLElement>(
  scopeRef?: RefObject<HTMLElement | null>
) {
  const chromeRef = useRef<T | null>(null);

  useLayoutEffect(() => {
    const el = chromeRef.current;
    if (!el) return;

    const update = () => {
      const heightPx = `${el.getBoundingClientRect().height}px`;
      const scope = scopeRef?.current;
      if (scope) {
        scope.style.setProperty(STICKY_OFFSET_VAR, heightPx);
      }
      document.documentElement.style.setProperty(STICKY_OFFSET_VAR, heightPx);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      if (scopeRef?.current) {
        scopeRef.current.style.removeProperty(STICKY_OFFSET_VAR);
      }
      document.documentElement.style.removeProperty(STICKY_OFFSET_VAR);
    };
  }, [scopeRef]);

  return chromeRef;
}

/** Reset sticky offset inside a table that scrolls within its own container. */
export const SCROLLABLE_TABLE_CONTAINER_SX = {
  '--app-sticky-offset': '0px',
} as const;
