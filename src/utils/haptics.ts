/**
 * Haptic feedback (iOS + Android) — respects Settings → Vibration unless noted.
 * Uses expo-haptics (Taptic Engine / Android Vibrator).
 */
import * as Haptics from 'expo-haptics';
import { DeviceControlService } from '../services/deviceControlService';

export async function hapticLight(): Promise<void> {
  await DeviceControlService.getInstance().triggerHaptic('light');
}

export async function hapticMedium(): Promise<void> {
  await DeviceControlService.getInstance().triggerHaptic('medium');
}

export async function hapticHeavy(): Promise<void> {
  await DeviceControlService.getInstance().triggerHaptic('heavy');
}

/** Selection tick (toggles, pickers) — only if vibration is enabled */
export async function hapticSelection(): Promise<void> {
  try {
    if (!(await DeviceControlService.getInstance().isVibrationEnabled())) return;
    await Haptics.selectionAsync();
  } catch {
    /* ignore */
  }
}

/** Success / warning / error — only if vibration is enabled */
export async function hapticNotification(
  type: 'success' | 'warning' | 'error'
): Promise<void> {
  try {
    if (!(await DeviceControlService.getInstance().isVibrationEnabled())) return;
    const map = {
      success: Haptics.NotificationFeedbackType.Success,
      warning: Haptics.NotificationFeedbackType.Warning,
      error: Haptics.NotificationFeedbackType.Error,
    };
    await Haptics.notificationAsync(map[type]);
  } catch {
    /* ignore */
  }
}

/**
 * When user turns vibration ON in Settings, play once so they feel it
 * (does not check the setting — it isn’t saved yet).
 */
export async function hapticImpactUnconditional(
  style: 'light' | 'medium' | 'heavy' = 'medium'
): Promise<void> {
  try {
    const s =
      style === 'light'
        ? Haptics.ImpactFeedbackStyle.Light
        : style === 'medium'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Heavy;
    await Haptics.impactAsync(s);
  } catch {
    /* ignore */
  }
}
