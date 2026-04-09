import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Registers for Expo push notifications, requests permission, and returns token.
 * Only works on physical devices. Logs token to console.
 */
export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  // Only request permissions on physical device (not simulators)
  if (!Device.isDevice) {
    console.log(
      "[Push Notifications] Must use physical device for Push Notifications",
    );
    return null;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    console.log("[Push Notifications] Permission denied");
    return null;
  }

  if (Platform.OS === "android") {
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
    console.error("[Push Notifications] Missing eas.projectId in app.json");
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    if (token) {
      console.log("[Push Notifications] Token:", token);
      // TODO: Send token to backend when implemented
    } else {
      console.log("[Push Notifications] Failed to get token");
    }

    return token;
  } catch (error) {
    console.log(error);
    console.error("[Push Notifications] Error getting token:", error);
    return null;
  }
}
