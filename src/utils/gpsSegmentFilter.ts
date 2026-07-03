/** GPS jitter with ~50m+ accuracy often looks like 120+ mph over short intervals. */
export const POOR_GPS_ACCURACY_METERS = 50;
/** Cap implausible spikes instead of dropping all miles (cell-tower handoffs). */
export const MAX_SEGMENT_SPEED_CAP_MPH = 85;
/** Hard reject only when accuracy is good and speed is absurd. */
export const MAX_IMPLAUSIBLE_SPEED_MPH = 120;
/** During long gaps, count straight-line distance (GPS was likely asleep). */
export const LONG_GPS_GAP_MS = 2 * 60 * 1000;

export interface GpsSegmentContribution {
  countedMiles: number;
  droppedMiles: number;
}

/**
 * Decide how many miles from a GPS segment should count toward the trip total.
 * Poor-accuracy fixes are trusted; true teleports are capped rather than zeroed.
 */
export function computeGpsSegmentContribution(
  distanceMiles: number,
  elapsedMs: number,
  accuracyMeters?: number | null,
  previousAccuracyMeters?: number | null
): GpsSegmentContribution {
  if (distanceMiles <= 0) {
    return { countedMiles: 0, droppedMiles: 0 };
  }

  if (elapsedMs >= LONG_GPS_GAP_MS) {
    return { countedMiles: distanceMiles, droppedMiles: 0 };
  }

  const elapsedHours = Math.max(elapsedMs / 3_600_000, 1 / 3_600);
  const impliedMph = distanceMiles / elapsedHours;
  const worstAccuracy = Math.max(
    accuracyMeters != null && Number.isFinite(accuracyMeters) ? accuracyMeters : 0,
    previousAccuracyMeters != null && Number.isFinite(previousAccuracyMeters)
      ? previousAccuracyMeters
      : 0
  );

  if (worstAccuracy >= POOR_GPS_ACCURACY_METERS) {
    if (impliedMph > 200) {
      return capSegmentMiles(distanceMiles, elapsedHours);
    }
    return { countedMiles: distanceMiles, droppedMiles: 0 };
  }

  if (impliedMph <= MAX_IMPLAUSIBLE_SPEED_MPH) {
    return { countedMiles: distanceMiles, droppedMiles: 0 };
  }

  return capSegmentMiles(distanceMiles, elapsedHours);
}

function capSegmentMiles(distanceMiles: number, elapsedHours: number): GpsSegmentContribution {
  const cappedMiles = MAX_SEGMENT_SPEED_CAP_MPH * elapsedHours;
  if (distanceMiles <= cappedMiles) {
    return { countedMiles: distanceMiles, droppedMiles: 0 };
  }
  return {
    countedMiles: cappedMiles,
    droppedMiles: distanceMiles - cappedMiles,
  };
}
