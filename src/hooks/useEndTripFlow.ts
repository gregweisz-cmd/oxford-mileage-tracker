import { useCallback, useMemo, useRef, useState } from 'react';
import { EndTripPhase } from '../services/endTripCoordinator';
import { LocationDetails } from '../types';
import { InteractionManager } from 'react-native';

export interface UseEndTripFlowOptions {
  clearEndTripUiState: () => void;
  navigation: { goBack: () => void };
  endTripOverlay: boolean;
}

export interface UseEndTripFlowResult {
  phase: EndTripPhase;
  isEndTripActive: boolean;
  isSaving: boolean;
  /** True while phase === 'saving' — use in AppState/focus guards without re-renders. */
  isSavingRef: React.MutableRefObject<boolean>;
  showOptionsModal: boolean;
  showCaptureModal: boolean;
  captureInitial: Partial<LocationDetails> | null;
  endTripFlowPendingRef: React.MutableRefObject<boolean>;
  endFlowOpenedThisFocusRef: React.MutableRefObject<boolean>;
  openChoosing: () => void;
  hideChoosingForPicker: () => void;
  openCapture: (details: Partial<LocationDetails> | null) => void;
  /** Reset end-trip UI. No-op while saving. */
  dismissEndTrip: () => void;
  beginSaving: () => void;
  finishSaving: () => void;
  dismissEndTripOverlay: () => void;
}

/**
 * Single state machine for GPS end-trip modals (choose → capture → save).
 * All teardown before navigation must go through dismissEndTrip + finalizeEndTripNavigation.
 */
export function useEndTripFlow(options: UseEndTripFlowOptions): UseEndTripFlowResult {
  const { clearEndTripUiState, navigation, endTripOverlay } = options;

  const [phase, setPhase] = useState<EndTripPhase>('idle');
  const [captureInitial, setCaptureInitial] = useState<Partial<LocationDetails> | null>(null);
  const isSavingRef = useRef(false);
  isSavingRef.current = phase === 'saving';

  const endTripFlowPendingRef = useRef(false);
  const endFlowOpenedThisFocusRef = useRef(false);

  const openChoosing = useCallback(() => {
    setCaptureInitial(null);
    setPhase('choosing');
  }, []);

  /** Hide the choose-end modal while navigating to a location picker screen. */
  const hideChoosingForPicker = useCallback(() => {
    setPhase('idle');
  }, []);

  const openCapture = useCallback((details: Partial<LocationDetails> | null) => {
    setCaptureInitial(details);
    setPhase('capturing');
  }, []);

  const dismissEndTrip = useCallback(() => {
    if (isSavingRef.current) return;
    setPhase('idle');
    setCaptureInitial(null);
    clearEndTripUiState();
    endTripFlowPendingRef.current = false;
    endFlowOpenedThisFocusRef.current = false;
  }, [clearEndTripUiState]);

  const beginSaving = useCallback(() => {
    setCaptureInitial(null);
    setPhase('saving');
  }, []);

  const finishSaving = useCallback(() => {
    setPhase('idle');
    setCaptureInitial(null);
  }, []);

  const dismissEndTripOverlay = useCallback(() => {
    dismissEndTrip();
    if (endTripOverlay) {
      InteractionManager.runAfterInteractions(() => {
        navigation.goBack();
      });
    }
  }, [dismissEndTrip, endTripOverlay, navigation]);

  return useMemo(
    () => ({
      phase,
      isEndTripActive: phase !== 'idle',
      isSaving: phase === 'saving',
      isSavingRef,
      showOptionsModal: phase === 'choosing',
      showCaptureModal: phase === 'capturing',
      captureInitial,
      endTripFlowPendingRef,
      endFlowOpenedThisFocusRef,
      openChoosing,
      hideChoosingForPicker,
      openCapture,
      dismissEndTrip,
      beginSaving,
      finishSaving,
      dismissEndTripOverlay,
    }),
    [
      phase,
      captureInitial,
      openChoosing,
      hideChoosingForPicker,
      openCapture,
      dismissEndTrip,
      beginSaving,
      finishSaving,
      dismissEndTripOverlay,
    ]
  );
}
