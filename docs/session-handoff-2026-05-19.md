# Session handoff — 2026-05-19

Portable summary for continuing on another machine. **Shipped to `main` via OTA (runtime `1.0.9`)** unless noted below.

## Recent commits (newest first)

| Commit     | Summary |
|-----------|---------|
| `9c80fa8` | Remove high mileage/receipt post-save alerts; same-day odometer rolls forward after manual trips |
| `7c25171` | Per-vehicle starting odometer defaults from last travel day; refresh vehicle baseline after trips |
| `92aa1ca` | Fix mobile hours doubling vs web portal (time dedupe key) |
| `afe712d` | Scroll/touch freeze fixes after picker/chip taps |

## Uncommitted cleanup (local only)

End-of-day audit hardened odometer date matching and consolidated DB helpers — **commit + OTA when ready**:

- `src/utils/dateFormatter.ts` — `toLocalDateKey`, `startOfLocalDay`, `isSameLocalCalendarDay`
- `src/services/database.ts` — `getMileageEntriesForVehicleOnDate`, shared local-day logic
- `src/services/anomalyDetectionService.ts` — mileage/receipt `detect*` no-ops (checks kept for re-enable)
- `src/screens/MileageEntryScreen.tsx` — aligned `checkGpsTrackingStatus` with GPS odometer rules

## Mobile — odometer (per vehicle)

- **New day default:** last travel day **ending** for that vehicle, then settings baseline.
- **Same day next trip:** `resolveOdometerForNextTrip` = day start + sum of miles (manual or GPS).
- **GPS lock:** odometer field locks only after a **GPS** trip exists that day (manual daily row does not lock).
- **Vehicle baseline:** `vehicles.startingOdometer` updates after mileage create/update.

Key APIs: `resolveOdometerForNextTrip`, `hasGpsMileageOnDate`, `getMileageEntriesForVehicleOnDate`, `refreshVehicleStartingOdometerFromTrips`.

## Mobile — alerts removed

- No post-save **high mileage** or **high receipt** popups on Add Mileage / Add Receipt.
- Time-tracking anomaly alerts unchanged.

## Deploy

- **OTA:** production channel, runtime `1.0.9` — latest published group `90e288c7-4f2d-47d6-a3f7-0be4ae893709`.
- **Staff portal:** prior table-width fix on Vercel (`42e2546`); no portal changes this session.

## QA checklist (next session)

1. Manual trip → GPS same day: starting odometer = previous trip ending.
2. Two manual trips same day: second trip prefilled, field editable.
3. After GPS trip today: GPS screen shows locked **day-start** odometer.
4. Multi-vehicle: each car keeps its own roll-forward chain.
5. New calendar day: defaults to prior day ending for selected vehicle.
