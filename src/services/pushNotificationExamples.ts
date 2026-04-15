/**
 * PRACTICAL INTEGRATION EXAMPLE
 *
 * This file shows concrete examples of how to integrate the push notification
 * system with your drowsiness detection and real-time services.
 *
 * Copy and adapt these patterns for your specific implementation.
 */

import type { DetectionSeverity } from '@/types/detection';
import { triggerDrowsinessAlert } from '@/services/pushNotificationService';
import { supabase } from '@/lib/supabase';

/**
 * Example 1: Integration with useDrowsinessDetector Hook
 *
 * This shows how to call push notifications when drowsiness is detected.
 */
export function useDrowsinessDetectorWithNotifications(
  sessionId: string,
  userId: string,
) {
  // Track if we've already triggered alert for this drowsiness event
  // (avoid spamming notifications for continuous closure)
  const [lastAlertTime, setLastAlertTime] = React.useState(0);
  const ALERT_COOLDOWN_MS = 5000; // Minimum 5 seconds between alerts

  const handleDrowsinessDetected = async (
    earValue: number,
    closureDuration: number,
  ) => {
    // Determine severity based on EAR and duration
    let severity: DetectionSeverity = 'LOW';
    if (closureDuration > 2 && earValue < 0.15) {
      severity = 'HIGH';
    } else if (closureDuration > 1 && earValue < 0.25) {
      severity = 'MEDIUM';
    }

    // Prevent alert spam - only alert every 5 seconds
    const now = Date.now();
    if (now - lastAlertTime < ALERT_COOLDOWN_MS) {
      console.log('[Detection] Alert on cooldown, skipping...');
      return;
    }

    setLastAlertTime(now);

    console.log(
      `[Detection] Drowsiness detected - EAR: ${earValue.toFixed(2)}, Duration: ${closureDuration}s, Severity: ${severity}`,
    );

    try {
      // CALL THE PUSH NOTIFICATION SYSTEM
      const result = await triggerDrowsinessAlert({
        driverId: userId,
        sessionId,
        severity,
        earValue,
        duration: closureDuration,
      });

      if (result.success) {
        console.log(
          `[Detection] ✓ Alert sent to ${result.notificationsSent} guardians`,
        );
      } else {
        console.error(
          `[Detection] ✗ Failed to send alerts`,
        );
      }

      // Log failed guardians for debugging
      if (result.failedGuardians.length > 0) {
        console.warn(
          `[Detection] Failed guardians: ${result.failedGuardians.join(', ')}`,
        );
      }
    } catch (error) {
      console.error('[Detection] Error triggering alert:', error);
      // Don't crash the detection system
    }
  };

  return { handleDrowsinessDetected };
}

/**
 * Example 2: Integration with Background Detection Service
 *
 * If you're running detection in the background or in a separate service:
 */
export async function processDetectionFrameWithNotifications(
  driverId: string,
  sessionId: string,
  detectionResult: {
    earValue: number;
    eyesClosed: boolean;
    closureDurationMs: number;
    faceDetected: boolean;
  },
) {
  const { earValue, eyesClosed, closureDurationMs } = detectionResult;

  // Skip if no face detected
  if (!detectionResult.faceDetected) {
    return;
  }

  // Calculate severity
  if (!eyesClosed) {
    return; // Normal, no alert needed
  }

  const closureDurationSec = closureDurationMs / 1000;

  let severity: DetectionSeverity = 'LOW';
  if (closureDurationSec > 3) {
    severity = 'HIGH';
  } else if (closureDurationSec > 1) {
    severity = 'MEDIUM';
  }

  // THRESHOLD CHECK - only alert for significant drowsiness
  if (closureDurationSec < 0.5) {
    return; // Too brief, likely just a blink
  }

  console.log(
    `[Service] Detected drowsiness: ${closureDurationSec.toFixed(1)}s at EAR ${earValue.toFixed(2)}`,
  );

  // Send alert
  const result = await triggerDrowsinessAlert({
    driverId,
    sessionId,
    severity,
    earValue,
    duration: closureDurationSec,
  });

  return result;
}

/**
 * Example 3: Guardian Notification List Component
 *
 * Display notifications in the guardian app:
 */
export function useGuardianNotifications(userId: string) {
  const [notifications, setNotifications] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    fetchNotifications();

    // Subscribe to real-time updates
    const subscription = supabase
      .from('guardian_notifications')
      .on('*', (payload) => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('guardian_notifications')
        .select(`
          *,
          driver:driver_id(id, name, email)
        `)
        .eq('guardian_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('[Guardian] Error fetching notifications:', error);
    }
    setIsLoading(false);
  };

  const markAsRead = async (notificationId: number) => {
    try {
      const { error } = await supabase
        .from('guardian_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error('[Guardian] Error marking as read:', error);
    }
  };

  return {
    notifications,
    isLoading,
    markAsRead,
    refetch: fetchNotifications,
  };
}

/**
 * Example 4: Driver Session Management with Push Notifications
 *
 * Create a session and automatically set up notifications:
 */
export async function startDrivingSessionWithNotifications(
  driverId: string,
) {
  try {
    console.log('[Session] Starting driving session...');

    // Create session in database
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        driver_id: driverId,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    console.log(`[Session] Session created: ${session.id}`);

    return {
      sessionId: session.id,
      driverId,
      startedAt: session.started_at,
    };
  } catch (error) {
    console.error('[Session] Error starting session:', error);
    throw error;
  }
}

export async function endDrivingSession(
  sessionId: string,
  driverId: string,
) {
  try {
    console.log('[Session] Ending driving session...');

    const { error } = await supabase
      .from('sessions')
      .update({ status: 'COMPLETED', ended_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('driver_id', driverId);

    if (error) throw error;

    console.log('[Session] Session ended successfully');

    // Fetch summary for driver
    const { data: events } = await supabase
      .from('drowsiness_events')
      .select('*')
      .eq('session_id', sessionId);

    return {
      totalDrowsinessEvents: events?.length || 0,
      events,
    };
  } catch (error) {
    console.error('[Session] Error ending session:', error);
    throw error;
  }
}

/**
 * Example 5: Real-time Guardian Location Notification
 *
 * Optional: Also notify guardian of driver's location when drowsiness detected
 */
export async function sendDrowsinessAlertWithLocation(
  driverId: string,
  sessionId: string,
  location: { latitude: number; longitude: number },
  detectionData: any,
) {
  try {
    // Trigger standard drowsiness alert
    const alertResult = await triggerDrowsinessAlert({
      driverId,
      sessionId,
      severity: 'HIGH',
      earValue: detectionData.earValue,
      duration: detectionData.duration,
    });

    if (alertResult.success) {
      console.log(`[Alert] Drowsiness alert sent with location: ${location.latitude}, ${location.longitude}`);
    }

    // Optional: Store location with event for later reference
    // This helps guardians see where the incident occurred
    const { error } = await supabase
      .from('drowsiness_events')
      .update({
        latitude: location.latitude,
        longitude: location.longitude,
      })
      .eq('session_id', sessionId);

    if (error) throw error;

    return alertResult;
  } catch (error) {
    console.error('[Alert] Error sending alert with location:', error);
    throw error;
  }
}

/**
 * Example 6: Retry Failed Notifications
 *
 * If some notifications failed, you can manually retry:
 */
export async function retryFailedNotifications(
  driverId: string,
  sessionId: string,
  failedGuardianIds: string[],
) {
  console.log(`[Retry] Retrying notifications for ${failedGuardianIds.length} guardians`);

  try {
    // Fetch fresh tokens for failed guardians
    const { data: tokens, error } = await supabase
      .from('user_push_tokens')
      .select('expo_token')
      .in('user_id', failedGuardianIds)
      .eq('is_active', true);

    if (error) throw error;

    if (!tokens || tokens.length === 0) {
      console.warn('[Retry] No tokens found for failed guardians');
      return { retried: 0 };
    }

    // Get original event data
    const { data: event } = await supabase
      .from('drowsiness_events')
      .select('*')
      .eq('session_id', sessionId)
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!event) {
      console.error('[Retry] Original event not found');
      return { retried: 0 };
    }

    // Trigger alert again (this will send to all guardians, not just failed ones)
    // In production, you might want to modify triggerDrowsinessAlert to support
    // sending to specific guardians only
    const result = await triggerDrowsinessAlert({
      driverId,
      sessionId,
      severity: event.severity,
      earValue: event.ear_value,
      duration: event.duration_seconds,
    });

    console.log(`[Retry] Retry complete: ${result.notificationsSent} sent`);
    return { retried: result.notificationsSent };
  } catch (error) {
    console.error('[Retry] Error retrying notifications:', error);
    return { retried: 0, error };
  }
}

/**
 * Example 7: Testing Helper Function
 *
 * Use this to manually test the push notification system:
 */
export async function testPushNotificationSystem(
  driverId: string,
  sessionId: string,
) {
  console.log('[Test] Starting push notification system test...');

  try {
    // Step 1: Verify driver exists
    const { data: driver } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', driverId)
      .single();

    if (!driver) {
      console.error('[Test] Driver not found');
      return { success: false, error: 'Driver not found' };
    }
    console.log(`[Test] ✓ Driver found: ${driver.name}`);

    // Step 2: Check guardians linked
    const { data: guardians } = await supabase
      .from('driver_guardians')
      .select('guardian_id')
      .eq('driver_id', driverId);

    if (!guardians || guardians.length === 0) {
      console.warn('[Test] No guardians linked to this driver');
      return { success: false, error: 'No guardians linked' };
    }
    console.log(`[Test] ✓ Found ${guardians.length} linked guardians`);

    // Step 3: Check push tokens
    const guardianIds = guardians.map((g) => g.guardian_id);
    const { data: tokens } = await supabase
      .from('user_push_tokens')
      .select('*')
      .in('user_id', guardianIds)
      .eq('is_active', true);

    if (!tokens || tokens.length === 0) {
      console.warn('[Test] No push tokens registered for guardians');
      return { success: false, error: 'No push tokens' };
    }
    console.log(`[Test] ✓ Found ${tokens.length} active push tokens`);

    // Step 4: Simulate drowsiness alert
    console.log('[Test] Sending test alert...');
    const result = await triggerDrowsinessAlert({
      driverId,
      sessionId,
      severity: 'HIGH',
      earValue: 0.1,
      duration: 3,
    });

    console.log('[Test] ✓ Alert sent:', result);

    return {
      success: true,
      driver: driver.name,
      guardiansCount: guardians.length,
      tokensCount: tokens.length,
      result,
    };
  } catch (error) {
    console.error('[Test] Error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Example 8: Complete Driver App Integration
 *
 * This is how everything connects in your driver app:
 */
export function useDriverDrowsinessIntegration() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [drowsinessCount, setDrowsinessCount] = React.useState(0);

  // 1. Start session on component mount
  React.useEffect(() => {
    const startSession = async () => {
      if (!user?.id) return;

      const session = await startDrivingSessionWithNotifications(user.id);
      setSessionId(session.sessionId);
      console.log('[Driver] Session started:', session.sessionId);
    };

    startSession();

    return () => {
      // End session on unmount
      if (sessionId && user?.id) {
        endDrivingSession(sessionId, user.id);
      }
    };
  }, [user?.id]);

  // 2. Handle drowsiness detection
  const handleDrowsinessDetected = async (
    earValue: number,
    duration: number,
  ) => {
    if (!sessionId || !user?.id) return;

    setDrowsinessCount((c) => c + 1);

    await useDrowsinessDetectorWithNotifications(sessionId, user.id)
      .handleDrowsinessDetected(earValue, duration);
  };

  return {
    sessionId,
    handleDrowsinessDetected,
    drowsinessCount,
  };
}
