import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  API_CONFIGURED,
  getCurrentUserProfile,
  type ApiError,
  type CurrentUserProfile,
} from '@/services/apiService';
console.log("API URL:", process.env.EXPO_PUBLIC_API_URL);
function toError(error: ApiError | null, fallbackMessage: string) {
  return new Error(error?.message ?? fallbackMessage);
}

export function useCurrentUserProfile() {
  const { isAuthenticated, user } = useAuth();

  return useQuery<CurrentUserProfile | null>({
    queryKey: ['current-user-profile', user?.id],
    enabled: Boolean(user?.id) && isAuthenticated && API_CONFIGURED,
    queryFn: async () => {
      const result = await getCurrentUserProfile();

      if (result.error) {
        throw toError(result.error, 'Unable to load your profile.');
      }

      return result.data;
    },
    staleTime: 60 * 1000,
    retry: 0,
  });
}
