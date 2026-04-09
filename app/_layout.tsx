import '../global.css';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { LogoLoading } from '@/components/LogoLoading';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AuthProvider } from '@/providers/AuthProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

function RootLayoutNav() {
  const { isInitialized } = useAuth();

  console.log('[layout] RootLayoutNav rendered, isInitialized:', isInitialized);

  useEffect(() => {
    console.log('[layout] useEffect: isInitialized changed to:', isInitialized);
    if (isInitialized) {
      console.log('[layout] calling SplashScreen.hideAsync()');
      void SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  if (!isInitialized) {
    console.log('[layout] rendering LogoLoading because isInitialized=false');
    return <LogoLoading />;
  }

  console.log('[layout] rendering Stack navigation because isInitialized=true');
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Root index redirect (handles initial routing) */}
        <Stack.Screen name="index" />

        {/* Main app navigation (authenticated users) */}
        <Stack.Screen name="(main)" />
        
        {/* Authentication flow (unauthenticated users) */}
        <Stack.Screen name="(auth)" />
        
        {/* Modal screens */}
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        
        {/* Not found screen */}
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
