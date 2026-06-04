# Session handoff — 2026-05-19

Portable summary for continuing on another machine. **Shipped to `main` via OTA (runtime `1.0.9`)** unless noted below.

## Recent commits (newest first)

| Commit     | Summary |
|-----------|---------|
| `9c80fa8` | Remove high mileage/receipt post-save alerts; same-day odometer rolls forward after manual trips |
| `7c25171` | Per-vehicle starting odometer defaults from last travel day; refresh vehicle baseline after trips |
| `92aa1ca` | Fix mobile hours doubling vs web portal (time dedupe key) |
| `afe712d` | Scroll/touch freeze fixes after picker/chip taps |

## Latest commit

| Commit     | Summary |
|-----------|---------|
| `ea17fe0` | Odometer local-day hardening; mileage entry GPS lock aligned with GPS screen; session handoff doc |

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

- **OTA:** production channel, runtime `1.0.9` — latest published group `e5766d4e-52cc-4a71-9d76-747a2a8e8503` (`ea17fe0`).
- **Staff portal:** prior table-width fix on Vercel (`42e2546`); no portal changes this session.

## QA checklist (next session)

1. Manual trip → GPS same day: starting odometer = previous trip ending.
2. Two manual trips same day: second trip prefilled, field editable.
3. After GPS trip today: GPS screen shows locked **day-start** odometer.
4. Multi-vehicle: each car keeps its own roll-forward chain.
5. New calendar day: defaults to prior day ending for selected vehicle.
