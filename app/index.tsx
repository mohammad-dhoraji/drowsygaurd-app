import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';

export default function IndexScreen() {
  const { isAuthenticated } = useAuth();

  console.log('[index] rendering, isAuthenticated:', isAuthenticated);

  const redirectTo = isAuthenticated ? '/(main)' : '/(auth)/login';
  console.log('[index] redirecting to:', redirectTo);

  return <Redirect href={redirectTo} />;
}
