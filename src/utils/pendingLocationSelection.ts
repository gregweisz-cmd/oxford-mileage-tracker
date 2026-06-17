import { LocationDetails } from '../types';

export type PendingMileageLocationPick = {
  address: LocationDetails;
  locationType: 'start' | 'end';
};

export type PendingGpsLocationPick = {
  kind: 'start' | 'end';
  address: LocationDetails;
};

let pendingMileagePick: PendingMileageLocationPick | null = null;
let pendingGpsPick: PendingGpsLocationPick | null = null;

export function setPendingMileageLocationPick(pick: PendingMileageLocationPick): void {
  pendingMileagePick = pick;
}

export function consumePendingMileageLocationPick(): PendingMileageLocationPick | null {
  const pick = pendingMileagePick;
  pendingMileagePick = null;
  return pick;
}

export function setPendingGpsLocationPick(pick: PendingGpsLocationPick): void {
  pendingGpsPick = pick;
}

export function consumePendingGpsLocationPick(): PendingGpsLocationPick | null {
  const pick = pendingGpsPick;
  pendingGpsPick = null;
  return pick;
}

/**
 * Pop the picker screen and deliver the selection to the screen below via pending state.
 */
export function completeAddressPickerReturn(navigation: {
  goBack: () => void;
  canGoBack: () => boolean;
}): void {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  console.warn('completeAddressPickerReturn: cannot go back');
}
