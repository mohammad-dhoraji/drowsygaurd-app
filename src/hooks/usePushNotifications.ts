import React, { useEffect, useState } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { registerPushToken } from '@/services/pushNotificationService';

/**
 * Registers for Expo push notifications, requests permission, and returns token.
 * Only works on physical devices. Stores token in Supabase.
 */
export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  // Only request permissions on physical device (not simulators)
  if (!Device.isDevice) {
    console.log(
      '[Push Notifications] Must use physical device for Push Notifications',
    );
    return null;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.log('[Push Notifications] Permission denied');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.error('[Push Notifications] Missing eas.projectId in app.json');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    if (token) {
      console.log('[Push Notifications] Token:', token);
    } else {
      console.log('[Push Notifications] Failed to get token');
    }

    return token;
  } catch (error) {
    console.log(error);
    console.error('[Push Notifications] Error getting token:', error);
    return null;
  }
}

/**
 * Hook to automatically register and sync push token with Supabase
 * Call this in your app's main component (e.g., in AuthProvider or App.tsx)
 */
export function usePushNotifications(): {
  token: string | null;
  isLoading: boolean;
} {
  const { user, isAuthenticated } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const setupPushNotifications = async () => {
      try {
        if (!isAuthenticated || !user?.id) {
          console.log('[Push Notifications] User not authenticated, skipping token registration');
          if (isMounted) setIsLoading(false);
          return;
        }

        const expoPushToken = await registerForPushNotificationsAsync();

        if (!expoPushToken) {
          console.log('[Push Notifications] Could not get Expo push token');
          if (isMounted) setIsLoading(false);
          return;
        }

        // Store token in Supabase
        const { success, error } = await registerPushToken(expoPushToken, user.id);

        if (isMounted) {
          if (success) {
            setToken(expoPushToken);
            console.log('[Push Notifications] Token registered successfully');
          } else {
            console.error('[Push Notifications] Failed to register token:', error);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[Push Notifications] Setup error:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    setupPushNotifications();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.id]);

  return { token, isLoading };
}

