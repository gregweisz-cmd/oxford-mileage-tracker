import React, { useEffect, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { KEYBOARD_DONE_ACCESSORY_ID } from '../utils/keyboardDismiss';

/**
 * iOS toolbar above the keyboard with a Done button.
 * Mount once near the app root; pair TextInputs with searchTextInputProps / keyboardDismissTextInputProps.
 *
 * Only mounted while the keyboard is visible — a root-level InputAccessoryView that stays mounted
 * with no focused field is a known iOS cause of a grey toolbar fragment at the top of the screen.
 */
export function KeyboardDoneAccessory() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const showSub = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    const showSubDid = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubDid = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
      showSubDid.remove();
      hideSubDid.remove();
    };
  }, []);

  if (Platform.OS !== 'ios' || !keyboardVisible) {
    return null;
  }

  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ACCESSORY_ID}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={() => Keyboard.dismiss()}
          style={styles.doneButton}
          accessibilityRole="button"
          accessibilityLabel="Dismiss keyboard"
        >
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doneButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  doneText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
