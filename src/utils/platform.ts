import { Platform } from 'react-native';

/**
 * Platform detection utilities
 * Used to conditionally enable web-only or native-only features
 */

export const isWeb = Platform.OS === 'web';
export const isNative = Platform.OS !== 'web';
export const isAndroid = Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';

/**
 * Check if the app is running in a managed Expo environment
 * (as opposed to a bare React Native project)
 */
export const isExpoManaged = true; // This is an Expo-managed app

/**
 * Detect if platform supports real-time detection with frame processing
 * Currently: web has MediaPipe, native uses simulated detection (TODO: add real ML Kit)
 */
export const supportsFrameProcessing = Platform.OS === 'web';

/**
 * Get platform-specific readable name
 */
export function getPlatformName(): string {
  if (isWeb) return 'Web';
  if (isAndroid) return 'Android';
  if (isIOS) return 'iOS';
  return 'Unknown';
}
