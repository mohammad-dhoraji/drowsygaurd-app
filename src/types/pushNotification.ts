import type { DetectionSeverity } from './detection';

/**
 * Push notification payload for Expo API
 */
export interface ExponentialPushNotification {
  to: string | string[];
  title: string;
  body: string;
  sound?: 'default' | null;
  priority?: 'default' | 'high';
  badge?: number;
  data?: Record<string, any>;
}

/**
 * Expo API response structure
 */
export interface ExpoApiResponse {
  data?: Array<{ id: string }>;
  errors?: Array<{
    message: string;
    code: string;
  }>;
}

/**
 * Push token record in database
 */
export interface PushTokenRecord {
  id: number;
  user_id: string;
  expo_token: string;
  device_info?: string;
  platform: string;
  is_active: boolean;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Drowsiness alert event
 */
export interface DrowsinessAlertEvent {
  driverId: string;
  sessionId: string;
  severity: DetectionSeverity;
  earValue: number;
  duration: number;
}

/**
 * Push notification delivery result
 */
export interface PushNotificationResult {
  success: boolean;
  notificationsSent: number;
  failedGuardians: string[];
  failedTokens?: string[];
}

/**
 * Guardian notification log
 */
export interface GuardianNotificationLog {
  id: number;
  driver_id: string;
  guardian_id: string;
  session_id: string;
  message: string;
  severity: DetectionSeverity;
  is_read: boolean;
  created_at: string;
}

/**
 * Push notification service result
 */
export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
