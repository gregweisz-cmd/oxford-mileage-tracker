import { Alert } from 'react-native';

export function formatGpsTripDistance(miles: number): string {
  if (miles < 0.1) {
    return `${(miles * 5280).toFixed(0)} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

/** Trip options when ending GPS tracking (pause / resume / end & save). */
export function showGpsTripOptionsAlert(options: {
  tripPaused: boolean;
  currentDistance: number;
  onResume: () => void;
  onPause: () => void;
  onEndAndSave: () => void;
}): void {
  const { tripPaused, currentDistance, onResume, onPause, onEndAndSave } = options;
  Alert.alert(
    tripPaused ? 'Trip options (mileage paused)' : 'Trip options',
    `Distance recorded: ${formatGpsTripDistance(currentDistance)}${
      tripPaused ? '\n\nMileage is paused.' : ''
    }\n\nUse Pause for errands/stops without adding miles.`,
    [
      { text: 'Keep tracking', style: 'cancel' },
      ...(tripPaused
        ? [{ text: 'Resume mileage', onPress: onResume }]
        : [{ text: 'Pause mileage', onPress: onPause }]),
      {
        text: 'End & save trip',
        style: 'default',
        onPress: onEndAndSave,
      },
    ]
  );
}
