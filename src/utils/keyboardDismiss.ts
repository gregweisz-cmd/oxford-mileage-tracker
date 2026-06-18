import { Keyboard, Platform, type TextInputProps } from 'react-native';

/** Shared nativeID for the global iOS keyboard accessory toolbar. */
export const KEYBOARD_DONE_ACCESSORY_ID = 'oh-keyboard-done';

type ReturnKey = NonNullable<TextInputProps['returnKeyType']>;

/** Props to spread on TextInputs so users can dismiss the keyboard (Search/Done key + iOS toolbar). */
export function keyboardDismissTextInputProps(
  returnKeyType: ReturnKey = 'done'
): Pick<TextInputProps, 'returnKeyType' | 'blurOnSubmit' | 'onSubmitEditing' | 'inputAccessoryViewID'> {
  return {
    returnKeyType,
    blurOnSubmit: true,
    onSubmitEditing: () => Keyboard.dismiss(),
    ...(Platform.OS === 'ios' ? { inputAccessoryViewID: KEYBOARD_DONE_ACCESSORY_ID } : {}),
  };
}

export const searchTextInputProps = keyboardDismissTextInputProps('search');
