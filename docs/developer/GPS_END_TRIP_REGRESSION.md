# GPS end-trip regression checklist

Run this on **iOS and Android** before shipping any change that touches:

- `src/screens/GpsTrackingScreen.tsx`
- `src/hooks/useEndTripFlow.ts`
- `src/services/endTripCoordinator.ts`
- `src/contexts/GpsTrackingContext.tsx`
- `App.tsx` (GpsTracking screen options)
- `src/components/GlobalGpsStopButton.tsx`

## Architecture (do not bypass)

End-trip UI is a **single state machine** (`useEndTripFlow`):

| Phase | UI |
|-------|-----|
| `idle` | No end-trip modals |
| `choosing` | Choose end location options |
| `capturing` | Location capture modal |
| `saving` | “Ending tracking…” overlay |

Save + navigation must go through **`executeEndTripSave`** then **`finalizeEndTripNavigation`** in `endTripCoordinator.ts`. Do not call `navigation.reset` directly from end-trip handlers.

## Smoke tests

### 1. End from GPS screen

- [ ] Start a GPS trip, drive or simulate distance
- [ ] Tap **Stop Tracking** → choose end option → confirm manual end location
- [ ] “Ending tracking…” appears, then Home loads
- [ ] **Tracking Complete** alert appears
- [ ] Home dashboard scrolls and tiles respond to taps (no frozen screen)

### 2. End from Home overlay

- [ ] While tracking, go to Home
- [ ] Use global GPS stop / end-trip overlay
- [ ] Complete end location flow
- [ ] Home is fully interactive after save

### 3. Stationary notification

- [ ] Trigger stationary alert (or use test build with shortened threshold if available)
- [ ] Choose **End trip** from notification action
- [ ] Complete flow; Home interactive

### 4. Lock / unlock

- [ ] Start end-trip flow (options modal open)
- [ ] Lock device, unlock
- [ ] Complete or cancel trip; screen remains usable

### 5. Mid-save guard

- [ ] End trip and confirm location
- [ ] During “Ending tracking…”, lock/unlock quickly
- [ ] App should not leave an invisible overlay blocking Home

## Code review red flags

- Adding `isTracking` to `useFocusEffect` deps on `GpsTrackingScreen`
- New `Modal` in end-trip path without updating `useEndTripFlow` phases
- `navigation.reset` / `goBack` during save before `finalizeEndTripNavigation`
- Awaiting `Location.getCurrentPositionAsync` on the stop path without a preset end location
- Heavy sync/DB work in Home `useFocusEffect` without `InteractionManager` deferral

## Related docs

- `docs/scroll-touch-audit.md` — stale modal / touch patterns app-wide
