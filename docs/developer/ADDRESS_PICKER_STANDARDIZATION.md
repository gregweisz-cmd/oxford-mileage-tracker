# Address Picker Standardization

This document defines the canonical address-picker contract across mobile and admin-web.

## Canonical Location Contract

- `source`: `baseAddress | baseAddress2 | saved | oxfordHouse | manual | recent | frequent | lastDestination | tripStart | google`
- `label`/`name`: user-facing location name
- `address`: canonical one-line address in `Street, City, ST ZIP` format
- optional metadata:
  - `sourceId`
  - `latitude`
  - `longitude`

## Standard Rules

1. **BA/BA2 display only**  
   Base address aliases are for UI labels. Persist canonical address in location details.

2. **Address canonicalization on read/write**  
   Normalize to `Street, City, ST ZIP` where possible.

3. **Manual entry fallback behavior**  
   A location is valid when either name or address exists. Missing name is derived from the address first segment.

4. **Oxford House state behavior**  
   State filters are normalized (`NC` equivalent forms). Default to employee base-state only if that filter yields results; otherwise auto-fallback to all states.

5. **Source taxonomy consistency**  
   Source names and ordering stay consistent across picker surfaces.

## Shared Utilities

- Mobile:
  - `src/utils/locationSelection.ts`
  - `src/utils/addressFormatter.ts`
  - `src/utils/oxfordHousePicker.ts`
- Admin-web:
  - `admin-web/src/utils/locationSelection.ts`
  - `admin-web/src/utils/addressFormatter.ts`
  - `admin-web/src/utils/addressParse.ts`
- Backend:
  - `admin-web/backend/utils/baseAddressNormalizer.js`

