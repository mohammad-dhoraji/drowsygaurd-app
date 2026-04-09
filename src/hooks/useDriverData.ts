import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  API_CONFIGURED,
  deleteDriverEvent,
  getDriverEvents,
  getDriverSessions,
  getEventSummary,
  type ApiError,
} from '@/services/apiService';
import type { DetectionSeverity } from '@/types/detection';

function toError(error: ApiError | null, fallbackMessage: string) {
  return new Error(error?.message ?? fallbackMessage);
}

export function useDriverEvents(
  {
    page = 1,
    pageSize = 10,
    severity,
    days,
    sessionId,
  }: {
    page?: number;
    pageSize?: number;
    severity?: DetectionSeverity;
    days?: number;
    sessionId?: string;
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['driver-events', page, pageSize, severity ?? 'ALL', days ?? 'ALL', sessionId ?? 'ALL'],
    enabled: (options?.enabled ?? true) && API_CONFIGURED,
    queryFn: async () => {
      const result = await getDriverEvents({ page, pageSize, severity, days, sessionId });

      if (result.error) {
        throw toError(result.error, 'Unable to load drowsiness events.');
      }

      return result.data;
    },
  });
}

export function useEventSummary(days = 30, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['driver-summary', days],
    enabled: (options?.enabled ?? true) && API_CONFIGURED,
    queryFn: async () => {
      const result = await getEventSummary(days);

      if (result.error) {
        throw toError(result.error, 'Unable to load your summary.');
      }

      return result.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useDriverSessions(days = 30, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['driver-sessions', days],
    enabled: (options?.enabled ?? true) && API_CONFIGURED,
    queryFn: async () => {
      const result = await getDriverSessions(days);

      if (result.error) {
        throw toError(result.error, 'Unable to load driving sessions.');
      }

      return result.data ?? [];
    },
  });
}

export function useDeleteDriverEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: number) => {
      const result = await deleteDriverEvent(eventId);

      if (result.error) {
        throw toError(result.error, 'Unable to delete this event.');
      }

      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['driver-events'] }),
        queryClient.invalidateQueries({ queryKey: ['driver-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['driver-sessions'] }),
      ]);
    },
  });
}
