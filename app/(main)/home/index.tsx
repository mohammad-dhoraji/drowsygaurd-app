import React, { useCallback } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import { BellRing, CalendarRange, Clock3, ShieldAlert, Users } from 'lucide-react-native';

import { Header } from '@/components/layout/Header';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useDriverSessions, useEventSummary } from '@/hooks/useDriverData';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useGuardianNotifications, useMyDrivers } from '@/hooks/useGuardianApi';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useRealtimeGuardian } from '@/hooks/useRealtimeGuardian';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import type { DetectionSeverity } from '@/types/detection';

function severityToVariant(severity?: DetectionSeverity) {
  if (severity === 'HIGH') return 'danger';
  if (severity === 'MEDIUM') return 'warning';
  return 'safe';
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Not available';
  }

  return new Date(value).toLocaleString();
}

function formatSessionWindow(startTime?: string | null, endTime?: string | null) {
  if (!startTime) {
    return 'Session time unavailable';
  }

  const started = new Date(startTime).toLocaleString();
  if (!endTime) {
    return `${started} - Active`;
  }

  return `${started} - ${new Date(endTime).toLocaleTimeString()}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  accentClassName,
  iconColor,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  accentClassName: string;
  iconColor: string;
}) {
  return (
    <Card className="w-[48%] mb-4">
      <CardContent className="p-4">
        <View className={`w-10 h-10 rounded-full items-center justify-center mb-3 ${accentClassName}`}>
          <Icon size={18} color={iconColor} />
        </View>
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">{value}</Text>
        <Text className="text-gray-500 dark:text-gray-400 text-xs mt-1">{label}</Text>
      </CardContent>
    </Card>
  );
}

function LoadingCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="p-5 flex-row items-center">
        <ActivityIndicator color="#064e3b" />
        <Text className="text-gray-600 dark:text-gray-300 ml-3">{message}</Text>
      </CardContent>
    </Card>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const profileQuery = useCurrentUserProfile();
  const role = profileQuery.data?.role;
  const isDriver = role === 'driver';
  const isGuardian = role === 'guardian';

  const summaryQuery = useEventSummary(30, { enabled: isDriver });
  const sessionsQuery = useDriverSessions(30, { enabled: isDriver });
  const driversQuery = useMyDrivers({ enabled: isGuardian });
  const notificationsQuery = useGuardianNotifications(
    { page: 1, pageSize: 5, days: 30 },
    { enabled: isGuardian },
  );

  useRealtimeGuardian(
    isGuardian ? user?.id : undefined,
    isGuardian ? (driversQuery.data ?? []).map((driver) => driver.id) : [],
  );

  const refreshDashboard = useCallback(async () => {
    const tasks: Promise<{ error: Error | null }>[] = [profileQuery.refetch()];

    if (isDriver) {
      tasks.push(summaryQuery.refetch(), sessionsQuery.refetch());
    }

    if (isGuardian) {
      tasks.push(driversQuery.refetch(), notificationsQuery.refetch());
    }

    const results = await Promise.all(tasks);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      throw failed.error;
    }
  }, [driversQuery, isDriver, isGuardian, notificationsQuery, profileQuery, sessionsQuery, summaryQuery]);

  const { refreshing, onRefresh, refreshError, clearRefreshError, lastUpdatedAt } =
    usePullToRefresh(refreshDashboard);

  useRefreshOnFocus(onRefresh, { enabled: Boolean(user?.id) });

  const unreadNotifications = notificationsQuery.data?.notifications.filter((item) => !item.is_read).length ?? 0;

  return (
    <ScreenWrapper
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Header
        title={isGuardian ? 'Guardian Dashboard' : 'Driver Dashboard'}
        subtitle={`Welcome back, ${profileQuery.data?.name || user?.name || 'User'}`}
        logo={true}
      />

      {lastUpdatedAt ? (
        <Text className="text-xs text-gray-400 dark:text-gray-500">
          Last updated {new Date(lastUpdatedAt).toLocaleTimeString()}
        </Text>
      ) : null}

      {refreshError ? (
        <Card className="border border-red-300 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4">
            <Text className="text-red-700 dark:text-red-300">{refreshError}</Text>
            <Text onPress={clearRefreshError} className="text-red-600 dark:text-red-400 mt-2 font-semibold">
              Dismiss
            </Text>
          </CardContent>
        </Card>
      ) : null}

      {profileQuery.isLoading ? <LoadingCard message="Loading your dashboard..." /> : null}

      {profileQuery.isError ? (
        <Card className="border border-red-300 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4">
            <Text className="text-red-700 dark:text-red-300">Unable to load your account profile.</Text>
          </CardContent>
        </Card>
      ) : null}

      {!profileQuery.isLoading && !profileQuery.isError && !role ? (
        <Card className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <Text className="text-amber-800 dark:text-amber-300 font-semibold">Account role unavailable</Text>
            <Text className="text-amber-700 dark:text-amber-400 text-sm mt-1">
              We could not determine whether this account is a driver or guardian.
            </Text>
          </CardContent>
        </Card>
      ) : null}

      {isDriver ? (
        <>
          {summaryQuery.isLoading || sessionsQuery.isLoading ? (
            <LoadingCard message="Loading your event summary and recent sessions..." />
          ) : null}

          {summaryQuery.isError || sessionsQuery.isError ? (
            <Card className="border border-red-300 bg-red-50 dark:bg-red-900/20">
              <CardContent className="p-4">
                <Text className="text-red-700 dark:text-red-300">
                  We could not load your driving summary right now.
                </Text>
              </CardContent>
            </Card>
          ) : null}

          {!summaryQuery.isLoading && !summaryQuery.isError ? (
            <>
              <Text className="text-lg font-bold text-gray-900 dark:text-white">30-Day Summary</Text>
              <View className="flex-row flex-wrap justify-between">
                <StatCard
                  icon={ShieldAlert}
                  label="Total Events"
                  value={String(summaryQuery.data?.total_events ?? 0)}
                  accentClassName="bg-red-100 dark:bg-red-900/30"
                  iconColor="#ef4444"
                />
                <StatCard
                  icon={Clock3}
                  label="Average EAR"
                  value={
                    typeof summaryQuery.data?.avg_ear_value === 'number'
                      ? summaryQuery.data.avg_ear_value.toFixed(3)
                      : '--'
                  }
                  accentClassName="bg-blue-100 dark:bg-blue-900/30"
                  iconColor="#3b82f6"
                />
                <StatCard
                  icon={CalendarRange}
                  label="Sessions"
                  value={String(summaryQuery.data?.total_sessions ?? 0)}
                  accentClassName="bg-emerald-100 dark:bg-emerald-900/30"
                  iconColor="#10b981"
                />
                <StatCard
                  icon={BellRing}
                  label="High Severity"
                  value={String(summaryQuery.data?.high_severity_count ?? 0)}
                  accentClassName="bg-amber-100 dark:bg-amber-900/30"
                  iconColor="#d97706"
                />
              </View>

              <Text className="text-lg font-bold text-gray-900 dark:text-white">Recent Sessions</Text>
              {sessionsQuery.data && sessionsQuery.data.length > 0 ? (
                sessionsQuery.data.slice(0, 5).map((session) => (
                  <Card key={session.session_id}>
                    <CardContent className="p-4">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-gray-900 dark:text-white font-semibold flex-1 mr-3">
                          {formatSessionWindow(session.start_time, session.end_time)}
                        </Text>
                        <Badge variant={severityToVariant(session.highest_severity)}>
                          {session.highest_severity}
                        </Badge>
                      </View>
                      <Text className="text-gray-500 dark:text-gray-400 text-sm">
                        Event count: {session.event_count}
                      </Text>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-4">
                    <Text className="text-gray-500 dark:text-gray-400">
                      No driving sessions have been recorded yet.
                    </Text>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </>
      ) : null}

      {isGuardian ? (
        <>
          {driversQuery.isLoading || notificationsQuery.isLoading ? (
            <LoadingCard message="Loading monitored drivers and guardian notifications..." />
          ) : null}

          {driversQuery.isError || notificationsQuery.isError ? (
            <Card className="border border-red-300 bg-red-50 dark:bg-red-900/20">
              <CardContent className="p-4">
                <Text className="text-red-700 dark:text-red-300">
                  We could not load guardian activity right now.
                </Text>
              </CardContent>
            </Card>
          ) : null}

          {!driversQuery.isLoading && !driversQuery.isError ? (
            <>
              <Text className="text-lg font-bold text-gray-900 dark:text-white">Guardian Overview</Text>
              <View className="flex-row flex-wrap justify-between">
                <StatCard
                  icon={Users}
                  label="Monitored Drivers"
                  value={String(driversQuery.data?.length ?? 0)}
                  accentClassName="bg-blue-100 dark:bg-blue-900/30"
                  iconColor="#3b82f6"
                />
                <StatCard
                  icon={BellRing}
                  label="Unread Alerts"
                  value={String(unreadNotifications)}
                  accentClassName="bg-amber-100 dark:bg-amber-900/30"
                  iconColor="#d97706"
                />
              </View>

              <Text className="text-lg font-bold text-gray-900 dark:text-white">Monitored Drivers</Text>
              {(driversQuery.data ?? []).length > 0 ? (
                (driversQuery.data ?? []).map((driver) => (
                  <Card key={driver.id}>
                    <CardContent className="p-4">
                      <Text className="text-gray-900 dark:text-white font-semibold">
                        {driver.name || 'Unnamed driver'}
                      </Text>
                      <Text className="text-gray-500 dark:text-gray-400 text-sm mt-1">{driver.email}</Text>
                      <Text className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                        Linked {formatDateTime(driver.linked_at)}
                      </Text>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-4">
                    <Text className="text-gray-500 dark:text-gray-400">
                      No drivers are linked to this guardian account yet.
                    </Text>
                  </CardContent>
                </Card>
              )}

              <Text className="text-lg font-bold text-gray-900 dark:text-white">Recent Notifications</Text>
              {(notificationsQuery.data?.notifications ?? []).length > 0 ? (
                (notificationsQuery.data?.notifications ?? []).map((notification) => (
                  <Card key={notification.id}>
                    <CardContent className="p-4">
                      <View className="flex-row items-start justify-between mb-2">
                        <Text className="text-gray-900 dark:text-white font-semibold flex-1 mr-3">
                          {notification.message}
                        </Text>
                        <Badge variant={severityToVariant(notification.severity)}>
                          {notification.severity}
                        </Badge>
                      </View>
                      <Text className="text-gray-500 dark:text-gray-400 text-sm">
                        {notification.driver_name || notification.driver_email || notification.driver_id}
                      </Text>
                      <Text className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                        {formatDateTime(notification.created_at)}
                      </Text>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-4">
                    <Text className="text-gray-500 dark:text-gray-400">
                      No guardian notifications have been received yet.
                    </Text>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </>
      ) : null}
    </ScreenWrapper>
  );
}
