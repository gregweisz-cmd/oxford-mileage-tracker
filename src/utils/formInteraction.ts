import { Keyboard } from 'react-native';

/** Dismiss keyboard after dropdown/chip/checkbox selection so ScrollViews scroll again. */
export function dismissKeyboardForSelection(): void {
  Keyboard.dismiss();
}
