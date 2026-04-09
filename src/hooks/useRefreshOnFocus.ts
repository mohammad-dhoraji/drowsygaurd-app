import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

interface UseRefreshOnFocusOptions {
  enabled?: boolean;
  minIntervalMs?: number;
}

const DEFAULT_MIN_INTERVAL_MS = 15_000;

export function useRefreshOnFocus(
  refreshFn: () => Promise<void>,
  options?: UseRefreshOnFocusOptions,
) {
  const enabled = options?.enabled ?? true;
  const minIntervalMs = options?.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const lastRefreshRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        return undefined;
      }

      const now = Date.now();
      if (now - lastRefreshRef.current < minIntervalMs) {
        return undefined;
      }

      lastRefreshRef.current = now;
      void refreshFn();

      return undefined;
    }, [enabled, minIntervalMs, refreshFn]),
  );
}
