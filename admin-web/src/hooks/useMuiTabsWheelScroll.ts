import { useEffect, useRef } from 'react';

/**
 * Attach to a wrapper around MUI `<Tabs variant="scrollable">` so vertical wheel/trackpad
 * movement scrolls the tab strip horizontally (same behavior as Staff Portal).
 */
export function useMuiTabsWheelScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const tabsContainer = ref.current;
    if (!tabsContainer) return;

    const handleWheel = (e: WheelEvent) => {
      const scrollableElement =
        (tabsContainer.querySelector('.MuiTabs-scroller') as HTMLElement | null) ||
        (tabsContainer.querySelector('.MuiTabs-scrollableX') as HTMLElement | null) ||
        (tabsContainer.querySelector('[role="tablist"]') as HTMLElement | null) ||
        tabsContainer;

      if (!scrollableElement) return;

      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0);
      scrollableElement.scrollLeft += delta;
    };

    tabsContainer.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      tabsContainer.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);

  return ref;
}
