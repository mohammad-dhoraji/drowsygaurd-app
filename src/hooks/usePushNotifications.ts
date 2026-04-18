import { useEffect, useState } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { useAuthContext } from "@/providers/AuthProvider";
import { registerPushToken } from "@/services/pushNotificationService";

// ✅ GLOBAL (must be outside)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("[Push] Physical device required");
    return null;
  }

  try {
    const { status } = await Notifications.requestPermissionsAsync();

    if (status !== "granted") {
      console.log("[Push] Permission denied");
      return null;
    }

    // ✅ SAFE projectId (this fixes crashes)
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.error("[Push] Missing EAS projectId");
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    console.log("[Push] Token:", token);
    return token;
  } catch (error) {
    console.error("[Push] Token error:", error);
    return null;
  }
}

export function usePushNotifications() {
  const { user, isAuthenticated, isInitialized } = useAuthContext();

  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function setup() {
      try {
        // 🔥 CRITICAL FIX: wait for auth to be ready
        if (!isInitialized) return;

        if (!isAuthenticated || !user?.id) {
          console.log("[Push] User not ready");
          if (isMounted) setIsLoading(false);
          return;
        }

        console.log("[Push] Starting registration...");

        const expoToken = await registerForPushNotificationsAsync();

        if (!expoToken) {
          console.log("[Push] No token received");
          if (isMounted) setIsLoading(false);
          return;
        }

        const { success, error } = await registerPushToken(expoToken, user.id);

        if (isMounted) {
          if (success) {
            console.log("[Push] Token saved to DB");
            setToken(expoToken);
          } else {
            console.error("[Push] DB error:", error);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error("[Push] Setup crash:", err);
        if (isMounted) setIsLoading(false);
      }
    }

    setup();

    return () => {
      isMounted = false;
    };
  }, [isInitialized, isAuthenticated, user?.id]);

  return { token, isLoading };
}