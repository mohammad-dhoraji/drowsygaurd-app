import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { SUPABASE_CONFIGURED, supabase } from '@/lib/supabase';

export type UserRole = 'driver' | 'guardian';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole | null;
  created_at: string;
}

interface DriverGuardianRow {
  driver_id: string;
}

interface SessionRow {
  id: string;
  driver_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  speed_kph?: number | null;
  speed?: number | null;
  route_name?: string | null;
  location_label?: string | null;
  heading?: string | number | null;
  accuracy?: string | number | null;
  updated_at?: string | null;
}

interface DrowsinessEventRow {
  id: number;
  session_id: string;
  driver_id: string;
  ear_value: number | null;
  duration_seconds: number | null;
  severity: AlertSeverity;
  created_at: string;
}

interface GuardianNotificationRow {
  id: number;
  driver_id: string;
  guardian_id: string;
  session_id: string | null;
  message: string | null;
  severity: AlertSeverity;
  is_read: boolean;
  created_at: string;
}

export interface DriverOverview {
  id: string;
  name: string;
  email: string;
  status: string;
  drowsinessLevel: number;
  alertLevel: string;
  speedKph: number;
  routeName: string;
  lastUpdated: string;
  activeSessionId: string | null;
}

export interface GuardianLocationSnapshot {
  label: string;
  latitude: number;
  longitude: number;
  accuracy: string;
  heading: string;
  updatedAt: string;
}

export interface GuardianDashboardData {
  guardianProfile: ProfileRow | null;
  driverIds: string[];
  drivers: DriverOverview[];
  activeSession: SessionRow | null;
  latestEvent: DrowsinessEventRow | null;
  recentEvents: DrowsinessEventRow[];
  notifications: GuardianNotificationRow[];
  totalDrivingSecondsToday: number;
  minorAlertsToday: number;
  highAlertsToday: number;
  location: GuardianLocationSnapshot | null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isToday(dateString: string): boolean {
  const target = new Date(dateString);
  const now = new Date();
  return (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  );
}

function getDurationSeconds(startedAt: string, endedAt: string | null): number {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const value = Math.max(0, end - start);
  return Math.floor(value / 1000);
}

function severityToDrowsinessPercent(severity?: AlertSeverity | null): number {
  if (severity === 'HIGH') return 80;
  if (severity === 'MEDIUM') return 55;
  if (severity === 'LOW') return 25;
  return 10;
}

function severityToStatus(severity?: AlertSeverity | null): string {
  if (severity === 'HIGH') return 'Danger';
  if (severity === 'MEDIUM') return 'Warning';
  return 'Monitoring';
}

function severityToAlertLabel(severity?: AlertSeverity | null): string {
  if (severity === 'HIGH') return 'High Risk';
  if (severity === 'MEDIUM') return 'Medium Risk';
  return 'Low Risk';
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function extractLocation(session: SessionRow | null): GuardianLocationSnapshot | null {
  if (!session) {
    return null;
  }

  const latitude = safeNumber(session.latitude ?? session.lat ?? null);
  const longitude = safeNumber(session.longitude ?? session.lng ?? null);

  if (latitude === null || longitude === null) {
    return null;
  }

  const headingValue =
    typeof session.heading === 'string' || typeof session.heading === 'number'
      ? String(session.heading)
      : 'Unknown';
  const accuracyValue =
    typeof session.accuracy === 'string' || typeof session.accuracy === 'number'
      ? String(session.accuracy)
      : 'N/A';

  return {
    label: session.location_label ?? 'Current position',
    latitude,
    longitude,
    heading: headingValue,
    accuracy: accuracyValue,
    updatedAt: session.updated_at ?? session.started_at,
  };
}

async function fetchGuardianDashboardData(guardianId: string): Promise<GuardianDashboardData> {
  const { data: guardianProfile, error: guardianError } = await supabase
    .from('profiles')
    .select('id, name, email, role, created_at')
    .eq('id', guardianId)
    .maybeSingle();

  if (guardianError) {
    throw guardianError;
  }

  const { data: mappingData, error: mappingError } = await supabase
    .from('driver_guardians')
    .select('driver_id')
    .eq('guardian_id', guardianId);

  if (mappingError) {
    throw mappingError;
  }

  const driverIds = unique(((mappingData ?? []) as DriverGuardianRow[]).map((item) => item.driver_id));

  if (driverIds.length === 0) {
    return {
      guardianProfile: (guardianProfile as ProfileRow | null) ?? null,
      driverIds: [],
      drivers: [],
      activeSession: null,
      latestEvent: null,
      recentEvents: [],
      notifications: [],
      totalDrivingSecondsToday: 0,
      minorAlertsToday: 0,
      highAlertsToday: 0,
      location: null,
    };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [driverProfilesResponse, activeSessionsResponse, todaySessionsResponse, eventsResponse, notificationsResponse] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, email, role, created_at')
        .in('id', driverIds),
      supabase
        .from('sessions')
        .select('*')
        .in('driver_id', driverIds)
        .eq('status', 'ACTIVE')
        .order('started_at', { ascending: false }),
      supabase
        .from('sessions')
        .select('id, driver_id, started_at, ended_at, status')
        .in('driver_id', driverIds)
        .gte('started_at', startOfDay.toISOString()),
      supabase
        .from('drowsiness_events')
        .select('id, session_id, driver_id, ear_value, duration_seconds, severity, created_at')
        .in('driver_id', driverIds)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('guardian_notifications')
        .select('id, driver_id, guardian_id, session_id, message, severity, is_read, created_at')
        .eq('guardian_id', guardianId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

  if (driverProfilesResponse.error) throw driverProfilesResponse.error;
  if (activeSessionsResponse.error) throw activeSessionsResponse.error;
  if (todaySessionsResponse.error) throw todaySessionsResponse.error;
  if (eventsResponse.error) throw eventsResponse.error;
  if (notificationsResponse.error) throw notificationsResponse.error;

  const driverProfiles = (driverProfilesResponse.data ?? []) as ProfileRow[];
  const activeSessions = (activeSessionsResponse.data ?? []) as SessionRow[];
  const sessionsToday = (todaySessionsResponse.data ?? []) as SessionRow[];
  const recentEvents = (eventsResponse.data ?? []) as DrowsinessEventRow[];
  const notifications = (notificationsResponse.data ?? []) as GuardianNotificationRow[];

  const activeSessionByDriver = new Map<string, SessionRow>();
  for (const session of activeSessions) {
    if (!activeSessionByDriver.has(session.driver_id)) {
      activeSessionByDriver.set(session.driver_id, session);
    }
  }

  const latestEventByDriver = new Map<string, DrowsinessEventRow>();
  for (const event of recentEvents) {
    if (!latestEventByDriver.has(event.driver_id)) {
      latestEventByDriver.set(event.driver_id, event);
    }
  }

  const drivers: DriverOverview[] = driverProfiles.map((driver) => {
    const activeSession = activeSessionByDriver.get(driver.id) ?? null;
    const latestEvent = latestEventByDriver.get(driver.id) ?? null;

    const severity = latestEvent?.severity ?? null;
    const status = activeSession ? severityToStatus(severity) : 'Offline';
    const speed = safeNumber(activeSession?.speed_kph ?? activeSession?.speed ?? null) ?? 0;

    return {
      id: driver.id,
      name: driver.name ?? 'Unknown Driver',
      email: driver.email ?? '',
      status,
      drowsinessLevel: severityToDrowsinessPercent(severity),
      alertLevel: severityToAlertLabel(severity),
      speedKph: Math.round(speed),
      routeName: activeSession?.route_name ?? 'Unknown Route',
      lastUpdated: latestEvent?.created_at ?? activeSession?.started_at ?? driver.created_at,
      activeSessionId: activeSession?.id ?? null,
    };
  });

  const activeSession = activeSessions[0] ?? null;
  const latestEvent =
    activeSession && recentEvents.length > 0
      ? recentEvents.find((item) => item.session_id === activeSession.id) ?? recentEvents[0]
      : recentEvents[0] ?? null;

  const totalDrivingSecondsToday = sessionsToday.reduce(
    (sum, session) => sum + getDurationSeconds(session.started_at, session.ended_at),
    0,
  );

  const todaysEvents = recentEvents.filter((event) => isToday(event.created_at));
  const minorAlertsToday = todaysEvents.filter(
    (event) => event.severity === 'LOW' || event.severity === 'MEDIUM',
  ).length;
  const highAlertsToday = todaysEvents.filter((event) => event.severity === 'HIGH').length;

  return {
    guardianProfile: (guardianProfile as ProfileRow | null) ?? null,
    driverIds,
    drivers,
    activeSession,
    latestEvent,
    recentEvents,
    notifications,
    totalDrivingSecondsToday,
    minorAlertsToday,
    highAlertsToday,
    location: extractLocation(activeSession),
  };
}

export function useGuardianDashboardData(guardianId?: string) {
  return useQuery({
    queryKey: ['guardian-dashboard', guardianId],
    enabled: Boolean(guardianId) && SUPABASE_CONFIGURED,
    queryFn: async () => fetchGuardianDashboardData(guardianId as string),
    staleTime: 30 * 1000,
    refetchInterval: SUPABASE_CONFIGURED ? 60 * 1000 : false,
  });
}

export function useGuardianSummary(guardianId?: string) {
  const query = useGuardianDashboardData(guardianId);

  const summary = useMemo(() => {
    const data = query.data;
    if (!data) {
      return {
        totalDrivingLabel: '0h 0m',
        minorAlertsToday: 0,
        highAlertsToday: 0,
      };
    }

    return {
      totalDrivingLabel: formatDuration(data.totalDrivingSecondsToday),
      minorAlertsToday: data.minorAlertsToday,
      highAlertsToday: data.highAlertsToday,
    };
  }, [query.data]);

  return { ...query, summary };
}
