import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { LogoLoading } from '@/components/LogoLoading';
import { useAuth } from '@/features/auth/hooks/useAuth';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LogoLoading />;
  }

  if (isAuthenticated) {
    return <Redirect href="/home" />;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack>
    </>
  );
}
