import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  API_CONFIGURED,
  getGuardianNotifications,
  getMyDrivers,
  getMyGuardians,
  linkGuardian,
  markGuardianNotificationRead,
  type ApiError,
} from '@/services/apiService';

function toError(error: ApiError | null, fallbackMessage: string) {
  return new Error(error?.message ?? fallbackMessage);
}

export function useMyGuardians(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['my-guardians'],
    enabled: (options?.enabled ?? true) && API_CONFIGURED,
    queryFn: async () => {
      const result = await getMyGuardians();

      if (result.error) {
        throw toError(result.error, 'Unable to load your linked guardians.');
      }

      return result.data?.guardians ?? [];
    },
  });
}

export function useMyDrivers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['guardian-drivers'],
    enabled: (options?.enabled ?? true) && API_CONFIGURED,
    queryFn: async () => {
      const result = await getMyDrivers();

      if (result.error) {
        throw toError(result.error, 'Unable to load monitored drivers.');
      }

      return result.data?.drivers ?? [];
    },
  });
}

export function useLinkGuardian() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (guardianEmail: string) => {
      const result = await linkGuardian(guardianEmail);

      if (result.error) {
        throw toError(result.error, 'Unable to link this guardian.');
      }

      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-guardians'] }),
        queryClient.invalidateQueries({ queryKey: ['current-user-profile'] }),
      ]);
    },
  });
}

export function useGuardianNotifications(
  {
    page = 1,
    pageSize = 10,
    unreadOnly = false,
    days,
  }: {
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
    days?: number;
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['guardian-notifications', page, pageSize, unreadOnly, days ?? 'ALL'],
    enabled: (options?.enabled ?? true) && API_CONFIGURED,
    queryFn: async () => {
      const result = await getGuardianNotifications({ page, pageSize, unreadOnly, days });

      if (result.error) {
        throw toError(result.error, 'Unable to load guardian notifications.');
      }

      return result.data;
    },
  });
}

export function useMarkGuardianNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const result = await markGuardianNotificationRead(notificationId);

      if (result.error) {
        throw toError(result.error, 'Unable to mark this notification as read.');
      }

      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['guardian-notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['guardian-dashboard'] }),
      ]);
    },
  });
}
