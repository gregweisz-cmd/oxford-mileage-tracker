import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * After lock/unlock, transparent modals or the keyboard can leave the screen non-scrollable.
 * Pass a callback that closes modals / suggestion panels for the current screen.
 */
export function useDismissStaleUiOnAppResume(dismiss: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        dismiss();
      }
    });
    return () => sub.remove();
  }, [dismiss, enabled]);
}
