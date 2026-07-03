import {
  computeGpsSegmentContribution,
  LONG_GPS_GAP_MS,
  POOR_GPS_ACCURACY_METERS,
} from './gpsSegmentFilter';

describe('computeGpsSegmentContribution', () => {
  it('counts full distance during long GPS gaps', () => {
    const result = computeGpsSegmentContribution(3, LONG_GPS_GAP_MS, 80, 80);
    expect(result).toEqual({ countedMiles: 3, droppedMiles: 0 });
  });

  it('trusts noisy GPS fixes instead of dropping short-interval jitter', () => {
    // 0.2 mi in 1s would look like 720 mph without accuracy context.
    const result = computeGpsSegmentContribution(0.2, 1000, 92, 85);
    expect(result).toEqual({ countedMiles: 0.2, droppedMiles: 0 });
  });

  it('caps true teleports when accuracy is poor', () => {
    const result = computeGpsSegmentContribution(5, 1000, 90, 90);
    expect(result.countedMiles).toBeCloseTo(85 / 3600, 5);
    expect(result.droppedMiles).toBeCloseTo(5 - 85 / 3600, 5);
  });

  it('caps instead of zeroing when good accuracy implies impossible speed', () => {
    const result = computeGpsSegmentContribution(0.5, 1000, 10, 12);
    expect(result.countedMiles).toBeCloseTo(85 / 3600, 5);
    expect(result.droppedMiles).toBeGreaterThan(0);
  });

  it('counts normal driving segments unchanged', () => {
    const result = computeGpsSegmentContribution(0.25, 20000, 15, 15);
    expect(result).toEqual({ countedMiles: 0.25, droppedMiles: 0 });
  });
});

describe('gps segment filter constants', () => {
  it('uses a realistic poor-accuracy threshold', () => {
    expect(POOR_GPS_ACCURACY_METERS).toBeGreaterThanOrEqual(40);
  });
});
