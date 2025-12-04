import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Cmd on Mac
  action: () => void;
  description: string;
  disabled?: boolean;
}

/**
 * Custom hook for managing keyboard shortcuts
 * 
 * @param shortcuts Array of keyboard shortcut definitions
 * @param enabled Whether shortcuts are enabled (default: true)
 * @param preventDefault Whether to prevent default browser behavior (default: true)
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true,
  preventDefault: boolean = true
): void {
  const shortcutsRef = useRef(shortcuts);

  // Update shortcuts ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't handle shortcuts if disabled
      if (!enabled) return;

      // Don't handle shortcuts when typing in input fields (unless it's Escape)
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Allow Escape and some shortcuts even in inputs
      const allowedInInput = [
        'Escape',
        'F1',
        'F2',
        'F3',
        'F4',
        'F5',
        'F6',
        'F7',
        'F8',
        'F9',
        'F10',
        'F11',
        'F12',
      ];

      if (isInput && !allowedInInput.includes(event.key) && event.key !== '/') {
        // Allow Ctrl+/ even in inputs (for shortcuts help)
        if (!(event.ctrlKey && event.key === '/') && !(event.metaKey && event.key === '/')) {
          return;
        }
      }

      // Check each shortcut
      for (const shortcut of shortcutsRef.current) {
        if (shortcut.disabled) continue;

        const keyMatches = shortcut.key.toLowerCase() === event.key.toLowerCase();
        const ctrlMatches = shortcut.ctrl === undefined || shortcut.ctrl === (event.ctrlKey || event.metaKey);
        const shiftMatches = shortcut.shift === undefined || shortcut.shift === event.shiftKey;
        const altMatches = shortcut.alt === undefined || shortcut.alt === event.altKey;
        const metaMatches = shortcut.meta === undefined || shortcut.meta === event.metaKey;

        // Don't match if Ctrl/Cmd is required but not pressed (unless meta is specifically handled)
        if (shortcut.ctrl && !event.ctrlKey && !event.metaKey) {
          continue;
        }

        if (keyMatches && ctrlMatches && shiftMatches && altMatches && (metaMatches || !shortcut.meta)) {
          if (preventDefault) {
            event.preventDefault();
            event.stopPropagation();
          }
          shortcut.action();
          break;
        }
      }
    },
    [enabled, preventDefault]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

/**
 * Helper to format shortcut key combination for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrl || shortcut.meta) {
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push('Shift');
  }
  if (shortcut.alt) {
    parts.push('Alt');
  }

  // Format the key nicely
  let key = shortcut.key;
  if (key === '/') {
    key = '?'; // Show ? instead of / for the help shortcut
  } else if (key.length === 1) {
    key = key.toUpperCase();
  } else {
    // Handle special keys
    key = key
      .replace('ArrowUp', '↑')
      .replace('ArrowDown', '↓')
      .replace('ArrowLeft', '←')
      .replace('ArrowRight', '→')
      .replace('Enter', 'Enter')
      .replace('Escape', 'Esc');
  }

  parts.push(key);
  return parts.join(' + ');
}

