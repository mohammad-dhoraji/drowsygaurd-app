import { supabase } from "@/lib/supabase";
import type { DetectionSeverity } from "@/types/detection";

const rawApiUrl =
  process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:8000";

function normalizeApiBaseUrl(value: string) {
  const trimmed = value.replace(/\/+$/, "");

  if (trimmed.endsWith("/api/v1")) {
    return trimmed;
  }

  return `${trimmed}/api/v1`;
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const baseUrl = normalizeApiBaseUrl(rawApiUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

type QueryValue = string | number | boolean | null | undefined;

export interface ApiError {
  message: string;
  status: number;
}

export interface ApiResult<T> {
  data: T | null;
  error: ApiError | null;
}

export type UserRole = "driver" | "guardian";

export interface CurrentUserProfile {
  user_id: string;
  email: string;
  role: UserRole | null;
  name: string | null;
}

export interface DriverEvent {
  id: number;
  ear_value: number | null;
  duration_seconds: number | null;
  severity: DetectionSeverity;
  session_id: string | null;
  created_at: string;
}

export interface DriverEventsResponse {
  events: DriverEvent[];
  total: number;
  page: number;
  page_size: number;
}

export interface DriverEventsParams {
  page?: number;
  pageSize?: number;
  severity?: DetectionSeverity;
  sessionId?: string;
  days?: number;
}

export interface DriverEventCreatePayload {
  ear_value: number;
  duration_seconds: number;
  severity: DetectionSeverity;
  event_type?: 'EYES_CLOSED' | 'NO_FACE';
  session_id?: string | null;
}

export interface EventSummary {
  total_events: number;
  high_severity_count: number;
  medium_severity_count: number;
  low_severity_count: number;
  last_event_time: string | null;
  avg_ear_value: number | null;
  total_sessions: number;
}

export interface SessionInfo {
  session_id: string;
  start_time: string;
  end_time: string | null;
  event_count: number;
  highest_severity: DetectionSeverity;
}

export interface SessionStartResponse {
  session_id: string;
  status: string;
  message: string;
}

export interface GuardianSummary {
  id: string;
  name: string | null;
  email: string;
  linked_at: string | null;
}

export interface DriverSummary {
  id: string;
  name: string | null;
  email: string;
  linked_at: string | null;
}

export interface LinkGuardianResponse {
  message: string;
  link_id: number;
  guardian: GuardianSummary;
}

export interface MyGuardiansResponse {
  guardians: GuardianSummary[];
}

export interface MyDriversResponse {
  drivers: DriverSummary[];
}

export interface GuardianNotification {
  id: number;
  driver_id: string;
  guardian_id: string;
  session_id: string | null;
  message: string;
  severity: DetectionSeverity;
  is_read: boolean;
  created_at: string;
  driver_name: string | null;
  driver_email: string | null;
}

export interface GuardianNotificationsResponse {
  notifications: GuardianNotification[];
  total: number;
  page: number;
  page_size: number;
}

export interface GuardianNotificationsParams {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
  days?: number;
}

export interface DriverLocationUpdatePayload {
  user_id: string;
  lat: number;
  lng: number;
}

export interface DriverLocationUpdateResponse {
  user_id: string;
  lat: number;
  lng: number;
  updated_at?: string | null;
}

export const API_BASE_URL = normalizeApiBaseUrl(rawApiUrl);
export const API_CONFIGURED = Boolean(API_BASE_URL);

const DEFAULT_HEADERS = {
  Accept: "application/json",
};

const EVENT_DEDUPLICATION_WINDOW_MS = 8_000;

let lastEventFingerprint: { key: string; createdAt: number } | null = null;

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getEventFingerprint(payload: DriverEventCreatePayload) {
  return [
    payload.session_id ?? "no-session",
    payload.severity,
    roundTo(payload.ear_value, 3),
    roundTo(payload.duration_seconds, 1),
  ].join("|");
}

let cachedAccessToken: string | null = null;

export function setGlobalAccessToken(token: string | null) {
  cachedAccessToken = token;
}

async function getAccessToken(): Promise<ApiResult<string>> {
  if (cachedAccessToken) {
    return { data: cachedAccessToken, error: null };
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    return {
      data: null,
      error: {
        message: error.message || "Unable to restore your session.",
        status: 401,
      },
    };
  }

  const accessToken = session?.access_token;
  if (!accessToken) {
    return {
      data: null,
      error: {
        message: "No active session was found. Please sign in again.",
        status: 401,
      },
    };
  }

  return { data: accessToken, error: null };
}

function extractErrorMessage(payload: unknown, fallbackMessage: string) {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    if ("detail" in payload) {
      const detail = payload.detail;
      if (typeof detail === "string" && detail.trim().length > 0) {
        return detail;
      }
    }

    if ("message" in payload) {
      const message = payload.message;
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }
  }

  return fallbackMessage;
}

async function request<T>(
  path: string,
  {
    method = "GET",
    body,
    query,
    skipAuth = false,
  }: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    query?: Record<string, QueryValue>;
    skipAuth?: boolean;
  } = {},
): Promise<ApiResult<T>> {
  let authHeaders: Record<string, string> = {};

  if (!skipAuth) {
    const tokenResult = await getAccessToken();
    if (tokenResult.error || !tokenResult.data) {
      return {
        data: null,
        error: tokenResult.error ?? {
          message: "Unable to attach your session token.",
          status: 401,
        },
      };
    }

    authHeaders = {
      Authorization: `Bearer ${tokenResult.data}`,
    };
  }

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        ...DEFAULT_HEADERS,
        ...authHeaders,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseText = await response.text();
    const parsedBody = responseText ? tryParseJson(responseText) : null;

    if (!response.ok) {
      return {
        data: null,
        error: {
          message: extractErrorMessage(
            parsedBody ?? responseText,
            `Request failed with status ${response.status}.`,
          ),
          status: response.status,
        },
      };
    }

    if (response.status === 204 || responseText.length === 0) {
      return { data: null, error: null };
    }

    return {
      data: (parsedBody ?? responseText) as T,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to reach the backend right now.";

    return {
      data: null,
      error: {
        message,
        status: 0,
      },
    };
  }
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function getCurrentUserProfile() {
  return request<CurrentUserProfile>("/auth/me");
}

export function getDriverEvents(params: DriverEventsParams = {}) {
  return request<DriverEventsResponse>("/logs/events", {
    query: {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 10,
      severity: params.severity,
      session_id: params.sessionId,
      days: params.days,
    },
  });
}

export async function createDriverEvent(payload: DriverEventCreatePayload) {
  const fingerprint = getEventFingerprint(payload);
  const now = Date.now();

  if (
    lastEventFingerprint &&
    lastEventFingerprint.key === fingerprint &&
    now - lastEventFingerprint.createdAt < EVENT_DEDUPLICATION_WINDOW_MS
  ) {
    return { data: null, error: null } satisfies ApiResult<DriverEvent>;
  }

  lastEventFingerprint = { key: fingerprint, createdAt: now };

  const result = await request<DriverEvent>("/logs/events", {
    method: "POST",
    body: payload,
  });

  if (result.error) {
    lastEventFingerprint = null;
  }

  return result;
}

export function deleteDriverEvent(eventId: number) {
  return request<void>(`/logs/events/${eventId}`, {
    method: "DELETE",
  });
}

export function getEventSummary(days = 30) {
  return request<EventSummary>("/logs/summary", {
    query: { days },
  });
}

export function getDriverSessions(days = 30) {
  return request<SessionInfo[]>("/logs/sessions", {
    query: { days },
  });
}

export function linkGuardian(guardianEmail: string) {
  return request<LinkGuardianResponse>("/link-guardian", {
    method: "POST",
    body: {
      guardian_email: guardianEmail.trim().toLowerCase(),
    },
  });
}

export function getMyGuardians() {
  return request<MyGuardiansResponse>("/my-guardians");
}

export function getMyDrivers() {
  return request<MyDriversResponse>("/my-drivers");
}

export function getGuardianNotifications(
  params: GuardianNotificationsParams = {},
) {
  return request<GuardianNotificationsResponse>(
    "/logs/guardian-notifications",
    {
      query: {
        page: params.page ?? 1,
        page_size: params.pageSize ?? 10,
        unread_only: params.unreadOnly ?? false,
        days: params.days,
      },
    },
  );
}

export async function markGuardianNotificationRead(notificationId: number) {
  const primaryResult = await request<void>(
    `/logs/guardian-notifications/${notificationId}/read`,
    {
      method: "PATCH",
    },
  );

  if (!primaryResult.error || primaryResult.error.status !== 404) {
    return primaryResult;
  }

  return request<void>(`/guardian-notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export function updateDriverLocation(payload: DriverLocationUpdatePayload) {
  return request<DriverLocationUpdateResponse>("/location/update", {
    method: "POST",
    body: payload,
  });
}

export function startDrivingSession() {
  return request<SessionStartResponse>("/logs/sessions/start", {
    method: "POST",
  });
}
