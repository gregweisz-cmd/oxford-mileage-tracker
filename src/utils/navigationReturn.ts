/**
 * Navigate back to a specific screen instance (by route key) with merged params.
 * Prevents React Navigation from pushing a duplicate screen when the target
 * route name already exists elsewhere in the stack.
 */
export function navigateBackWithParams(
  navigation: {
    navigate: (nameOrConfig: string | Record<string, unknown>, params?: Record<string, unknown>) => void;
  },
  options: {
    returnKey?: string;
    fallbackRouteName: string;
    params: Record<string, unknown>;
  }
): void {
  if (options.returnKey) {
    navigation.navigate({
      key: options.returnKey,
      params: options.params,
      merge: true,
    });
    return;
  }

  navigation.navigate({
    name: options.fallbackRouteName,
    params: options.params,
    merge: true,
  });
}
