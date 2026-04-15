/**
 * INTEGRATION GUIDE: Using Push Notifications with Drowsiness Detection
 *
 * This file demonstrates how to integrate the push notification system
 * with your detection components and real-time services.
 */

import { useAuth } from '@/providers/AuthProvider';
import { triggerDrowsinessAlert } from '@/services/pushNotificationService';
import type { DetectionSeverity } from '@/types/detection';

/**
 * Example 1: Call from real-time detection service
 *
 * In your realTimeDetection.ts or detection hook, when you detect drowsiness:
 */
export async function handleDrowsinessDetected(
  driverId: string,
  sessionId: string,
  earValue: number,
  severity: DetectionSeverity,
  duration: number,
) {
  console.log('[Detection] Drowsiness detected, triggering alert');

  const result = await triggerDrowsinessAlert({
    driverId,
    sessionId,
    severity,
    earValue,
    duration,
  });

  if (result.success) {
    console.log(
      `[Detection] Alert sent to ${result.notificationsSent} guardians`,
    );
  } else {
    console.error('[Detection] Failed to send some notifications');
  }

  // Handle failed guardians if needed
  if (result.failedGuardians.length > 0) {
    console.warn(
      `[Detection] Failed to notify guardians: ${result.failedGuardians.join(', ')}`,
    );
  }
}

/**
 * Example 2: Hook to handle incoming notifications
 *
 * Add this to your app's root component to listen for incoming push notifications:
 */
export function useNotificationListener() {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const { type, severity, driverId } = response.notification.request.content
        .data as any;

      console.log('[App] Received notification:', { type, severity, driverId });

      // Handle notification tap - navigate to driver details, etc.
      if (type === 'DROWSINESS') {
        // Example: navigate to driver details screen
        // navigation.navigate('DriverDetails', { driverId });
      }
    },
  );

  useEffect(() => {
    return () => {
      subscription.remove();
    };
  }, [subscription]);
}

/**
 * Example 3: Setup in App.tsx or main entry point
 *
 * Add this to your main app component:
 *
 * ```tsx
 * import { usePushNotifications } from '@/hooks/usePushNotifications';
 *
 * export default function App() {
 *   const { token, isLoading } = usePushNotifications();
 *
 *   useEffect(() => {
 *     if (token) {
 *       console.log('Push token registered:', token);
 *     }
 *   }, [token]);
 *
 *   return (
 *     // Your app components
 *   );
 * }
 * ```
 */

/**
 * Example 4: Call from drowsiness detector hook
 *
 * In your useDrowsinessDetector hook:
 *
 * ```tsx
 * export function useDrowsinessDetector(sessionId: string) {
 *   const { user } = useAuth();
 *
 *   const onDrowsinessDetected = async (
 *     earValue: number,
 *     severity: DetectionSeverity,
 *   ) => {
 *     if (!user?.id) return;
 *
 *     // Get duration of closure (you'll track this in your detector)
 *     const duration = calculateClosureDuration();
 *
 *     // Trigger alert
 *     await triggerDrowsinessAlert({
 *       driverId: user.id,
 *       sessionId,
 *       severity,
 *       earValue,
 *       duration,
 *     });
 *   };
 *
 *   return { onDrowsinessDetected };
 * }
 * ```
 */

/**
 * Example 5: Complete flow integration
 *
 * Here's how the complete flow works end-to-end:
 *
 * 1. Driver starts driving session
 *    → usePushNotifications hook runs automatically
 *    → Expo token is registered and stored in user_push_tokens table
 *
 * 2. Camera feed detects drowsiness
 *    → realTimeDetection.ts processes frame
 *    → EAR calculation returns low value
 *    → Severity is determined (LOW/MEDIUM/HIGH)
 *
 * 3. Application calls triggerDrowsinessAlert()
 *    → Event stored in drowsiness_events table
 *    → Query driver_guardians to find linked guardians
 *    → Fetch push tokens from user_push_tokens for each guardian
 *    → Send notification via Expo API to each token
 *    → Log delivery in guardian_notifications table
 *
 * 4. Guardian receives notification
 *    → Notification arrives on guardian's device
 *    → Guardian taps notification
 *    → Navigation to driver details (optional)
 *    → Guardian can mark notification as read in app
 *
 * EDGE CASES HANDLED:
 * ✓ Driver has no guardians → no notifications sent
 * ✓ Guardians have no registered tokens → skipped safely
 * ✓ Network failure on Expo API → retries 3 times with exponential backoff
 * ✓ Duplicate tokens → automatically deduplicated
 * ✓ Some tokens fail → remaining sent successfully
 * ✓ Database errors → logged, don't crash the app
 */

/**
 * Example 6: Manual testing
 *
 * To test the push notification system:
 *
 * 1. Set up two devices/simulators: one as driver, one as guardian
 * 2. Sign up driver and guardian with different accounts
 * 3. Link guardian to driver using driver_guardians table
 * 4. Simulate drowsiness detection on driver side
 * 5. Monitor logs to verify:
 *    - Event stored in drowsiness_events
 *    - Guardians fetched from driver_guardians
 *    - Push tokens retrieved from user_push_tokens
 *    - Notifications sent to Expo API
 *    - Delivery logged in guardian_notifications
 * 6. Check guardian device for notification
 */
