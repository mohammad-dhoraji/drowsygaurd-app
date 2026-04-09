import { useCallback, useRef, useState } from 'react';

interface UsePullToRefreshOptions {
  minDurationMs?: number;
  cooldownMs?: number;
}

interface PullToRefreshResult {
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  refreshError: string | null;
  lastUpdatedAt: number | null;
  clearRefreshError: () => void;
}

const DEFAULT_MIN_DURATION_MS = 400;
const DEFAULT_COOLDOWN_MS = 750;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('internet') || message.includes('fetch')) {
      return 'No internet connection. Pull again when you are back online.';
    }
    if (message.includes('timeout')) {
      return 'The request timed out. Please try again.';
    }
    return error.message;
  }

  return 'Refresh failed. Please try again.';
}

export function usePullToRefresh(
  fetchFunction: () => Promise<void>,
  options?: UsePullToRefreshOptions,
): PullToRefreshResult {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);
  const minDurationMs = options?.minDurationMs ?? DEFAULT_MIN_DURATION_MS;
  const cooldownMs = options?.cooldownMs ?? DEFAULT_COOLDOWN_MS;

  const onRefresh = useCallback(async () => {
    const now = Date.now();
    if (inFlightRef.current || now - lastRunRef.current < cooldownMs) {
      return;
    }

    inFlightRef.current = true;
    setRefreshing(true);
    setRefreshError(null);

    const startedAt = Date.now();

    try {
      await fetchFunction();
      setLastUpdatedAt(Date.now());
    } catch (error) {
      const message = getErrorMessage(error);
      setRefreshError(message);
      console.error('[refresh] Pull-to-refresh failed.', error);
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < minDurationMs) {
        await wait(minDurationMs - elapsed);
      }

      lastRunRef.current = Date.now();
      inFlightRef.current = false;
      setRefreshing(false);
    }
  }, [cooldownMs, fetchFunction, minDurationMs]);

  const clearRefreshError = useCallback(() => {
    setRefreshError(null);
  }, []);

  return { refreshing, onRefresh, refreshError, lastUpdatedAt, clearRefreshError };
}
