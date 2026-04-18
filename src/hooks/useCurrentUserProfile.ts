import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  API_CONFIGURED,
  getCurrentUserProfile,
  type ApiError,
  type CurrentUserProfile,
} from '@/services/apiService';

// 🔍 DEBUG: Log environment setup at module load time
console.warn('[Profile Hook] Initializing - EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
console.warn('[Profile Hook] API_CONFIGURED:', API_CONFIGURED);

function toError(error: ApiError | null, fallbackMessage: string) {
  return new Error(error?.message ?? fallbackMessage);
}

export function useCurrentUserProfile() {
  const { isAuthenticated, user } = useAuth();

  // 🔍 DEBUG: Log state changes to identify failure point
  useEffect(() => {
    const shouldFetch = Boolean(user?.id) && isAuthenticated && API_CONFIGURED;
    console.warn('[Profile Hook] State changed:', {
      userId: user?.id,
      isAuthenticated,
      API_CONFIGURED,
      shouldFetch,
    });
  }, [user?.id, isAuthenticated]);

  return useQuery<CurrentUserProfile | null>({
    queryKey: ['current-user-profile', user?.id],
    enabled: Boolean(user?.id) && isAuthenticated && API_CONFIGURED,
    queryFn: async () => {
      console.warn('[Profile Hook] Fetching profile for user:', user?.id);
      const result = await getCurrentUserProfile();

      if (result.error) {
        console.error('[Profile Hook] Fetch error:', result.error);
        throw toError(result.error, 'Unable to load your profile.');
      }

      console.warn('[Profile Hook] Fetch successful:', {
        userId: result.data?.user_id,
        role: result.data?.role,
      });
      return result.data;
    },
    staleTime: 60 * 1000,
    retry: 0,
  });
}
