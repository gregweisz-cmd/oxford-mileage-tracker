import React, { useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  type ScrollViewProps,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
  type LayoutChangeEvent,
} from 'react-native';

const KEYBOARD_TOP_OFFSET = Platform.OS === 'android' ? 180 : 120;

type KeyboardAwareScrollViewProps = ScrollViewProps & {
  children: React.ReactNode;
  /** Extra offset from top when scrolling to focused input (default 120/180) */
  focusScrollOffset?: number;
};

const ScrollToOnFocusContext = React.createContext<{
  scrollToY: (y: number) => void;
  scrollInputHandleIntoView: (target?: number | null) => void;
  notifyFocusHandled: () => void;
} | null>(null);

/**
 * ScrollView + KeyboardAvoidingView that can scroll to keep the focused TextInput visible.
 * Use with ScrollToOnFocusView: wrap each TextInput (or its row) in ScrollToOnFocusView so that
 * when the user focuses it, the scroll view scrolls to show it above the keyboard.
 */
export function KeyboardAwareScrollView({
  children,
  focusScrollOffset = KEYBOARD_TOP_OFFSET,
  style,
  contentContainerStyle,
  keyboardVerticalOffset = Platform.OS === 'ios' ? 88 : 0,
  ...scrollViewProps
}: KeyboardAwareScrollViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  const currentScrollYRef = useRef(0);
  const lastFocusHandledAtRef = useRef(0);

  const scrollInputHandleIntoView = useCallback((target?: number | null) => {
    const fallbackFocusedInput =
      (TextInput.State as any)?.currentlyFocusedInput?.() ||
      (TextInput.State as any)?.currentlyFocusedField?.();
    const inputHandle = target ?? fallbackFocusedInput;
    if (!inputHandle) return;
    const responder = scrollRef.current as any;
    if (responder?.scrollResponderScrollNativeHandleToKeyboard) {
      responder.scrollResponderScrollNativeHandleToKeyboard(
        inputHandle,
        focusScrollOffset,
        true
      );
    }
  }, [focusScrollOffset]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const keyboardShowSub = Keyboard.addListener(showEvent, () => {
      // On Android, skip keyboard-show auto-scroll when we just handled focus-driven scroll.
      // This avoids the previous double-scroll conflict while still helping unwrapped inputs.
      if (Platform.OS === 'android' && Date.now() - lastFocusHandledAtRef.current < 900) {
        return;
      }
      requestAnimationFrame(() => scrollInputHandleIntoView());
    });
    return () => {
      keyboardShowSub.remove();
    };
  }, [scrollInputHandleIntoView]);

  const scrollToFocusedInput = useCallback(
    (y: number) => {
      const offset = Math.max(0, y - focusScrollOffset);
      // Never scroll backward on focus because stale layout values can push inputs under keyboard.
      const nextY = Math.max(currentScrollYRef.current, offset);
      scrollRef.current?.scrollTo({
        y: nextY,
        animated: Platform.OS !== 'android',
      });
    },
    [focusScrollOffset]
  );

  const notifyFocusHandled = useCallback(() => {
    lastFocusHandledAtRef.current = Date.now();
  }, []);

  const contextValue = useMemo(
    () => ({
      scrollToY: scrollToFocusedInput,
      scrollInputHandleIntoView,
      notifyFocusHandled,
    }),
    [scrollToFocusedInput, scrollInputHandleIntoView, notifyFocusHandled]
  );

  return (
    <ScrollToOnFocusContext.Provider value={contextValue}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView
          ref={scrollRef}
          style={[{ flex: 1 }, style]}
          contentContainerStyle={contentContainerStyle}
          onScroll={(e) => {
            currentScrollYRef.current = e.nativeEvent.contentOffset.y;
            if (typeof scrollViewProps.onScroll === 'function') {
              scrollViewProps.onScroll(e);
            }
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          {...scrollViewProps}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScrollToOnFocusContext.Provider>
  );
}

const FOCUS_SCROLL_DELAY_MS = 100;

/**
 * On Android: scroll when keyboard is shown (keyboardDidShow) and with delayed fallbacks
 * using the Y from onLayout. Avoids measureLayout which can trigger ref warnings.
 */
function scheduleScrollAndroid(doScroll: () => void) {
  let keyboardEventHandled = false;
  const sub = Keyboard.addListener('keyboardDidShow', () => {
    keyboardEventHandled = true;
    sub.remove();
    requestAnimationFrame(doScroll);
  });

  [150, 350, 500].forEach((delay, index) => {
    setTimeout(() => {
      // Keep the keyboardDidShow listener alive for early fallback attempts so we
      // still get one final accurate scroll after keyboard fully opens.
      if (!keyboardEventHandled && index === 2) {
        sub.remove();
      }
      requestAnimationFrame(doScroll);
    }, delay);
  });
}

/**
 * Wraps a single child (typically TextInput). When the child receives focus, the parent
 * KeyboardAwareScrollView scrolls so this view is visible.
 * Safe when children is undefined, null, or not exactly one element (no throw).
 */
export function ScrollToOnFocusView({ children }: { children: React.ReactNode }) {
  const viewRef = useRef<View>(null);
  const yRef = useRef(0);
  const ctx = React.useContext(ScrollToOnFocusContext);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    yRef.current = e.nativeEvent.layout.y;
  }, []);

  const scrollToFocused = useCallback(() => {
    if (!ctx) return;
    ctx.scrollToY(yRef.current);
  }, [ctx]);

  const handleFocus = useCallback(
    (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      const focusTarget = e?.nativeEvent?.target ?? null;
      if (ctx) {
        ctx.notifyFocusHandled();
        if (Platform.OS === 'android') {
          // Use native focused-input scrolling only. Wrapper-Y fallback can push
          // already-visible inputs downward on focus due to stale layout coordinates.
          const doScroll = () => {
            ctx.scrollInputHandleIntoView(focusTarget);
          };
          scheduleScrollAndroid(doScroll);
        } else {
          setTimeout(() => {
            ctx.scrollInputHandleIntoView(focusTarget);
          }, FOCUS_SCROLL_DELAY_MS);
        }
      }
      const arr = React.Children.toArray(children);
      const first = arr[0];
      if (React.isValidElement(first) && typeof (first.props as any).onFocus === 'function') {
        (first.props as any).onFocus(e);
      }
    },
    [ctx, children, scrollToFocused]
  );

  const arr = React.Children.toArray(children);
  const singleChild = arr.length === 1 ? arr[0] : null;
  const child = singleChild && React.isValidElement(singleChild) ? singleChild : null;

  if (!child) {
    return (
      <View ref={viewRef} onLayout={onLayout} collapsable={false}>
        {children}
      </View>
    );
  }

  return (
    <View ref={viewRef} onLayout={onLayout} collapsable={false}>
      {React.cloneElement(
        child as React.ReactElement<{
          onFocus?: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
        }>,
        { onFocus: handleFocus }
      )}
    </View>
  );
}
