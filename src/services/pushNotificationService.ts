import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { DetectionSeverity } from '@/types/detection';

/**
 * Push notification API endpoint
 */
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/**
 * Retry strategy for failed push requests
 */
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Push notification payload structure
 */
interface PushNotificationPayload {
  to: string | string[];
  sound?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'default' | 'high';
  badge?: number;
}

/**
 * Expo API response structure
 */
interface ExpoApiResponse {
  data?: { id: string }[];
  errors?: Array<{ message: string; code: string }>;
}

/**
 * Drowsiness alert parameters
 */
export interface TriggerDrowsinessAlertParams {
  driverId: string;
  sessionId: string;
  severity: DetectionSeverity;
  earValue: number;
  duration: number;
}

/**
 * Helper function to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deduplicate array while preserving order
 */
function deduplicateTokens(tokens: string[]): string[] {
  const seen = new Set<string>();
  return tokens.filter((token) => {
    if (seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

/**
 * STEP 1: Register or update Expo push token for current user
 *
 * Stores the device push token in Supabase user_push_tokens table.
 * Automatically deduplicates and updates if token already exists.
 *
 * @param expoPushToken - The Expo push token from Notifications.getExpoPushTokenAsync()
 * @param userId - Current authenticated user ID
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function registerPushToken(
  expoPushToken: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!expoPushToken || !userId) {
    console.warn('[Push Service] Invalid parameters for registerPushToken');
    return { success: false, error: 'Invalid token or user ID' };
  }

  try {
    console.log(`[Push Service] Registering token for user: ${userId}`);

    // Upsert token - update if exists, insert if not
    const { error } = await supabase
      .from('user_push_tokens')
      .upsert(
        {
          user_id: userId,
          expo_token: expoPushToken,
          platform: Platform.OS,
          device_info: `${Platform.OS}-${Platform.Version || 'unknown'}`,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,expo_token',
        },
      );

    if (error) {
      console.error('[Push Service] Error registering token:', error);
      return { success: false, error: error.message };
    }

    console.log('[Push Service] Token registered successfully');
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Push Service] Exception registering token:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * STEP 2: Fetch all Expo push tokens for guardians of a driver
 *
 * Queries driver_guardians to find all guardians, then fetches their
 * active push tokens from user_push_tokens table.
 *
 * @param driverId - The driver's user ID
 * @returns Promise<string[]> - Array of unique Expo push tokens
 */
export async function getGuardianPushTokens(
  driverId: string,
): Promise<string[]> {
  if (!driverId) {
    console.warn('[Push Service] Invalid driver ID for getGuardianPushTokens');
    return [];
  }

  try {
    console.log(`[Push Service] Fetching guardians for driver: ${driverId}`);

    // Step 1: Get all guardians for this driver
    const { data: guardianMappings, error: guardianError } = await supabase
      .from('driver_guardians')
      .select('guardian_id')
      .eq('driver_id', driverId);

    if (guardianError) {
      console.error('[Push Service] Error fetching guardians:', guardianError);
      return [];
    }

    if (!guardianMappings || guardianMappings.length === 0) {
      console.log(
        `[Push Service] No guardians found for driver: ${driverId}`,
      );
      return [];
    }

    const guardianIds = guardianMappings.map((m) => m.guardian_id);
    console.log(
      `[Push Service] Found ${guardianIds.length} guardians for driver`,
    );

    // Step 2: Get active push tokens for all guardians
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('expo_token')
      .in('user_id', guardianIds)
      .eq('is_active', true);

    if (tokenError) {
      console.error('[Push Service] Error fetching push tokens:', tokenError);
      return [];
    }

    if (!tokenData || tokenData.length === 0) {
      console.warn(
        `[Push Service] No active push tokens found for any guardians`,
      );
      return [];
    }

    const tokens = tokenData.map((t) => t.expo_token);
    const uniqueTokens = deduplicateTokens(tokens);

    console.log(
      `[Push Service] Retrieved ${uniqueTokens.length} unique push tokens`,
    );
    return uniqueTokens;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Push Service] Exception fetching guardian tokens:', errorMsg);
    return [];
  }
}

/**
 * STEP 3: Send push notifications to multiple recipients
 *
 * Calls Expo Push API with retry logic for resilience.
 * Handles batch sending and gracefully fails on errors.
 *
 * @param tokens - Array of Expo push tokens to send to
 * @param payload - Notification payload
 * @returns Promise<{ success: boolean; failedTokens: string[] }>
 */
export async function sendPushNotification(
  tokens: string[],
  payload: Omit<PushNotificationPayload, 'to'>,
): Promise<{ success: boolean; failedTokens: string[] }> {
  if (!tokens || tokens.length === 0) {
    console.warn('[Push Service] No tokens provided for sendPushNotification');
    return { success: false, failedTokens: tokens };
  }

  const failedTokens: string[] = [];
  const successfulTokens: string[] = [];

  console.log(
    `[Push Service] Sending notification to ${tokens.length} recipients`,
  );

  // Send to each token with retry logic
  for (const token of tokens) {
    let attempt = 0;
    let sent = false;

    while (attempt < RETRY_ATTEMPTS && !sent) {
      try {
        const response = await fetch(EXPO_PUSH_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            to: token,
            ...payload,
            sound: payload.sound || 'default',
            priority: payload.priority || 'high',
          }),
        });

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}: ${response.statusText}`,
          );
        }

        const data: ExpoApiResponse = await response.json();

        // Check for API-level errors
        if (data.errors && data.errors.length > 0) {
          throw new Error(
            `Expo API error: ${data.errors[0].message}`,
          );
        }

        console.log(`[Push Service] Notification sent to ${token}`);
        successfulTokens.push(token);
        sent = true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        attempt++;

        if (attempt < RETRY_ATTEMPTS) {
          console.warn(
            `[Push Service] Retry ${attempt}/${RETRY_ATTEMPTS} for token ${token.substring(0, 20)}...: ${errorMsg}`,
          );
          await delay(RETRY_DELAY_MS * attempt);
        } else {
          console.error(
            `[Push Service] Failed to send to ${token.substring(0, 20)}... after ${RETRY_ATTEMPTS} attempts: ${errorMsg}`,
          );
          failedTokens.push(token);
        }
      }
    }
  }

  const success = failedTokens.length === 0;
  console.log(
    `[Push Service] Send complete: ${successfulTokens.length} succeeded, ${failedTokens.length} failed`,
  );

  return { success, failedTokens };
}

/**
 * STEP 4 & 5: Main orchestration function
 *
 * Complete flow:
 * 1. Store drowsiness event in database
 * 2. Fetch guardians linked to driver
 * 3. Get their push tokens
 * 4. Send notifications via Expo API
 * 5. Log notification delivery in guardian_notifications table
 *
 * Edge cases handled:
 * - No guardians linked → skips safely
 * - No push tokens → skips safely
 * - Network failures → doesn't crash, logs errors
 * - Duplicate tokens → automatically deduplicated
 *
 * @param params - Drowsiness alert parameters
 * @returns Promise<{ success: boolean; notificationsSent: number; failedGuardians: string[] }>
 */
export async function triggerDrowsinessAlert(
  params: TriggerDrowsinessAlertParams,
): Promise<{
  success: boolean;
  notificationsSent: number;
  failedGuardians: string[];
}> {
  const {
    driverId,
    sessionId,
    severity,
    earValue,
    duration,
  } = params;

  console.log(
    `[Push Service] Triggering drowsiness alert for driver: ${driverId}`,
  );

  // Validation
  if (!driverId || !sessionId) {
    console.error('[Push Service] Missing required parameters');
    return { success: false, notificationsSent: 0, failedGuardians: [] };
  }

  try {
    // STEP 1: Store the drowsiness event in database
    console.log('[Push Service] Step 1: Storing drowsiness event');
    const { data: eventData, error: eventError } = await supabase
      .from('drowsiness_events')
      .insert({
        session_id: sessionId,
        driver_id: driverId,
        ear_value: earValue,
        duration_seconds: duration,
        severity,
      })
      .select()
      .single();

    if (eventError) {
      console.error('[Push Service] Error storing drowsiness event:', eventError);
      return { success: false, notificationsSent: 0, failedGuardians: [] };
    }

    console.log(`[Push Service] Drowsiness event stored: ${eventData?.id}`);

    // STEP 2: Fetch guardians linked to driver
    console.log('[Push Service] Step 2: Fetching linked guardians');
    const { data: guardianMappings, error: guardianError } = await supabase
      .from('driver_guardians')
      .select('guardian_id')
      .eq('driver_id', driverId);

    if (guardianError) {
      console.error('[Push Service] Error fetching guardians:', guardianError);
      return { success: false, notificationsSent: 0, failedGuardians: [] };
    }

    if (!guardianMappings || guardianMappings.length === 0) {
      console.log('[Push Service] No guardians found, skipping notifications');
      return { success: true, notificationsSent: 0, failedGuardians: [] };
    }

    const guardianIds = guardianMappings.map((m) => m.guardian_id);
    console.log(`[Push Service] Found ${guardianIds.length} guardians`);

    // STEP 3: Fetch push tokens for guardians
    console.log('[Push Service] Step 3: Fetching push tokens for guardians');
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('user_id, expo_token')
      .in('user_id', guardianIds)
      .eq('is_active', true);

    if (tokenError) {
      console.error('[Push Service] Error fetching tokens:', tokenError);
      return { success: false, notificationsSent: 0, failedGuardians: guardianIds };
    }

    if (!tokenData || tokenData.length === 0) {
      console.warn(
        '[Push Service] No push tokens found for guardians, skipping notifications',
      );
      return { success: true, notificationsSent: 0, failedGuardians: guardianIds };
    }

    // Build mapping of guardian_id to tokens
    const guardianTokenMap = new Map<string, string[]>();
    tokenData.forEach((t) => {
      if (!guardianTokenMap.has(t.user_id)) {
        guardianTokenMap.set(t.user_id, []);
      }
      guardianTokenMap.get(t.user_id)!.push(t.expo_token);
    });

    console.log(
      `[Push Service] Found tokens for ${guardianTokenMap.size} guardians`,
    );

    // STEP 4: Send notifications via Expo API
    console.log('[Push Service] Step 4: Sending Expo push notifications');
    const notificationPayload = {
      title: '⚠️ Driver Drowsiness Alert',
      body: 'Driver is falling asleep. Immediate attention required.',
      data: {
        type: 'DROWSINESS',
        severity,
        driverId,
        sessionId,
        eventId: eventData?.id,
        earValue,
        duration,
        timestamp: new Date().toISOString(),
      },
    };

    const allTokens = Array.from(guardianTokenMap.values()).flat();
    const uniqueTokens = deduplicateTokens(allTokens);

    const { success: notificationSuccess, failedTokens } =
      await sendPushNotification(uniqueTokens, notificationPayload);

    // Track which guardians had failed token deliveries
    const failedGuardians: string[] = [];
    guardianTokenMap.forEach((tokens, guardianId) => {
      if (tokens.some((t) => failedTokens.includes(t))) {
        failedGuardians.push(guardianId);
      }
    });

    // STEP 5: Log notification delivery in database
    console.log('[Push Service] Step 5: Logging notifications in database');
    const notificationLogs = Array.from(guardianTokenMap.keys()).map(
      (guardianId) => ({
        driver_id: driverId,
        guardian_id: guardianId,
        session_id: sessionId,
        message: notificationPayload.body,
        severity,
      }),
    );

    const { error: logError } = await supabase
      .from('guardian_notifications')
      .insert(notificationLogs);

    if (logError) {
      console.error('[Push Service] Error logging notifications:', logError);
      // Don't fail entirely - notifications were sent
    } else {
      console.log(
        `[Push Service] Logged ${notificationLogs.length} notification records`,
      );
    }

    const notificationsSent = Array.from(guardianTokenMap.keys()).length -
      failedGuardians.length;

    console.log(
      `[Push Service] Alert flow complete: ${notificationsSent} notifications sent, ${failedGuardians.length} failed`,
    );

    return {
      success: notificationSuccess,
      notificationsSent,
      failedGuardians,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Push Service] Exception in triggerDrowsinessAlert:', errorMsg);
    return {
      success: false,
      notificationsSent: 0,
      failedGuardians: [],
    };
  }
}

/**
 * HELPER: Mark push token as inactive (device lost/app uninstalled)
 */
export async function deactivatePushToken(
  userId: string,
  expoPushToken: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('user_push_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('expo_token', expoPushToken);

    if (error) {
      console.error('[Push Service] Error deactivating token:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Push Service] Exception deactivating token:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * HELPER: Get active push tokens for a user
 */
export async function getUserPushTokens(
  userId: string,
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('user_push_tokens')
      .select('expo_token')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('[Push Service] Error fetching user tokens:', error);
      return [];
    }

    return data?.map((t) => t.expo_token) || [];
  } catch (err) {
    console.error('[Push Service] Exception fetching user tokens:', err);
    return [];
  }
}
