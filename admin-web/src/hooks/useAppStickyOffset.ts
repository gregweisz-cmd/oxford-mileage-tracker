import { useLayoutEffect, useRef } from 'react';

const STICKY_OFFSET_VAR = '--app-sticky-offset';

/** Publishes sticky header height so table thead cells sit below fixed portal chrome. */
export function useAppStickyOffset<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const root = document.documentElement;
    const update = () => {
      root.style.setProperty(STICKY_OFFSET_VAR, `${el.getBoundingClientRect().height}px`);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      root.style.removeProperty(STICKY_OFFSET_VAR);
    };
  }, []);

  return ref;
}

/** Reset sticky offset inside a table that scrolls within its own container. */
export const SCROLLABLE_TABLE_CONTAINER_SX = {
  '--app-sticky-offset': '0px',
} as const;
