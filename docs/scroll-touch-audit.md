# Scroll / touch audit (mobile app)

## Problem pattern

After using a text field then tapping a **chip, dropdown, or checkbox**, the screen can feel frozen until the user focuses another field and dismisses the keyboard (Done). Causes:

1. **Keyboard left open** after non-text taps
2. **`TouchableWithoutFeedback` wrapping a `ScrollView`** intercepting scroll gestures
3. **Stale transparent `Modal` overlays** after lock/unlock (especially picker modals with `absoluteFill` dismiss layers)

## Shared fixes (use everywhere)

| Utility | Path | Use |
|--------|------|-----|
| `dismissKeyboardForSelection()` | `src/utils/formInteraction.ts` | Call in `onPress` for chips, dropdown picks, checkboxes |
| `useDismissStaleUiOnAppResume(dismiss)` | `src/hooks/useDismissStaleUiOnAppResume.ts` | Close screen-specific modals when app returns to `active` |
| `KeyboardAwareScrollView` defaults | `src/components/KeyboardAwareScrollView.tsx` | `nestedScrollEnabled`, dismiss keyboard on scroll drag |

**Avoid:** wrapping full screens in `TouchableWithoutFeedback`. Prefer `keyboardDismissMode="on-drag"` and `onScrollBeginDrag={() => Keyboard.dismiss()}` on plain `ScrollView`s.

## Screen status

| Screen / area | Risk | Mitigation |
|---------------|------|------------|
| **Add Receipt** | Category chips after amount/vendor | Fixed: no TWF wrapper, dismiss keyboard + overlays on category/cost center |
| **Daily Hours** | Description/day-off pickers in edit modal | Fixed: no TWF, picker dismiss + AppState |
| **Hours Worked** | Edit modal numeric fields | Fixed: no TWF, AppState keyboard dismiss |
| **Mileage Entry** | Purpose modal, cost center chips | Fixed: stale modal dismiss on resume, keyboard on pick |
| **GPS Tracking** | Purpose/cost center (same as mileage) | Already had stale modal dismiss; added keyboard on pick |
| **Per Diem** | Day eligibility checkboxes | Fixed: dismiss keyboard on toggle |
| **Time Tracking** | Add modal category/cost center | Fixed: dismiss keyboard on pick, AppState in modal |
| **Employee Profile** | Add cost center modal | Fixed: AppState closes modal |
| **Setup Wizard** | Onboarding scroll | Fixed: removed TWF wrapper |
| **Home** | Base address / cost center modals | Low: modals use `onRequestClose`; KASV inside |
| **Receipts** | Image/details modals | Low: full-screen modals, not form scroll |
| **Reports / Admin** | Admin modals | Low: modal-only flows |
| **Saved Addresses** | Add/edit modal | Inherits KASV defaults; test if issues reported |
| **Receipt Crop** | Crop UI | Separate; map overlay uses `pointerEvents` |
| **Global GPS overlay** | Floating buttons | Fixed earlier: `pointerEvents` / hide when not tracking |

## When adding new UI

1. Picker/chip/checkbox `onPress` → `dismissKeyboardForSelection()`
2. Transparent picker `Modal` → always `onRequestClose`; register close fn in `useDismissStaleUiOnAppResume`
3. Form body → `KeyboardAwareScrollView`, not TWF parent
4. Nested `FlatList` in scroll → rely on `nestedScrollEnabled` (default on KASV)
