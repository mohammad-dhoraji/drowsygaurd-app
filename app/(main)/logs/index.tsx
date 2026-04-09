import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, TouchableOpacity, View } from 'react-native';

import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useDeleteDriverEvent, useDriverEvents } from '@/hooks/useDriverData';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import {
  useGuardianNotifications,
  useMarkGuardianNotificationRead,
  useMyDrivers,
} from '@/hooks/useGuardianApi';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useRealtimeGuardian } from '@/hooks/useRealtimeGuardian';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import type { DetectionSeverity } from '@/types/detection';

const DRIVER_SEVERITY_FILTERS: ('ALL' | DetectionSeverity)[] = ['ALL', 'LOW', 'MEDIUM', 'HIGH'];
const DAY_FILTERS = [7, 30, 90];

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

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3 py-2 rounded-full border ${
        active
          ? 'bg-primary border-primary'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}>
      <Text className={active ? 'text-white font-semibold' : 'text-gray-600 dark:text-gray-300 font-medium'}>
        {label}
      </Text>
    </TouchableOpacity>
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

export default function LogsScreen() {
  const { user } = useAuth();
  const profileQuery = useCurrentUserProfile();
  const role = profileQuery.data?.role;
  const isDriver = role === 'driver';
  const isGuardian = role === 'guardian';

  const [driverSeverity, setDriverSeverity] = useState<'ALL' | DetectionSeverity>('ALL');
  const [driverDays, setDriverDays] = useState(30);
  const [driverPage, setDriverPage] = useState(1);

  const [guardianUnreadOnly, setGuardianUnreadOnly] = useState(false);
  const [guardianDays, setGuardianDays] = useState(30);
  const [guardianPage, setGuardianPage] = useState(1);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<'success' | 'error'>('success');

  const driversQuery = useMyDrivers({ enabled: isGuardian });
  const driverEventsQuery = useDriverEvents(
    {
      page: driverPage,
      pageSize: 10,
      severity: driverSeverity === 'ALL' ? undefined : driverSeverity,
      days: driverDays,
    },
    { enabled: isDriver },
  );
  const notificationsQuery = useGuardianNotifications(
    {
      page: guardianPage,
      pageSize: 10,
      unreadOnly: guardianUnreadOnly,
      days: guardianDays,
    },
    { enabled: isGuardian },
  );

  const deleteEventMutation = useDeleteDriverEvent();
  const markReadMutation = useMarkGuardianNotificationRead();

  useRealtimeGuardian(
    isGuardian ? user?.id : undefined,
    isGuardian ? (driversQuery.data ?? []).map((driver) => driver.id) : [],
  );

  const refreshLogs = useCallback(async () => {
    const tasks: Promise<{ error: Error | null }>[] = [profileQuery.refetch()];

    if (isDriver) {
      tasks.push(driverEventsQuery.refetch());
    }

    if (isGuardian) {
      tasks.push(driversQuery.refetch(), notificationsQuery.refetch());
    }

    const results = await Promise.all(tasks);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      throw failed.error;
    }
  }, [driverEventsQuery, driversQuery, isDriver, isGuardian, notificationsQuery, profileQuery]);

  const { refreshing, onRefresh, refreshError, clearRefreshError, lastUpdatedAt } =
    usePullToRefresh(refreshLogs);

  useRefreshOnFocus(onRefresh, { enabled: Boolean(user?.id) });

  const driverPagination = useMemo(() => {
    const pageSize = driverEventsQuery.data?.page_size ?? 10;
    const total = driverEventsQuery.data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return { totalPages, total };
  }, [driverEventsQuery.data]);

  const guardianPagination = useMemo(() => {
    const pageSize = notificationsQuery.data?.page_size ?? 10;
    const total = notificationsQuery.data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return { totalPages, total };
  }, [notificationsQuery.data]);

  return (
    <ScreenWrapper
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View>
        <Text className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          {isGuardian ? 'Guardian Notifications' : 'Event History'}
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 mt-2">
          {isGuardian
            ? 'Review alert notifications from monitored drivers.'
            : 'Browse drowsiness events with filters and pagination.'}
        </Text>
      </View>

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

      {actionMessage ? (
        <Card
          className={
            actionTone === 'success'
              ? 'border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
              : 'border border-red-300 bg-red-50 dark:bg-red-900/20'
          }>
          <CardContent className="p-4">
            <Text
              className={
                actionTone === 'success'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-red-700 dark:text-red-300'
              }>
              {actionMessage}
            </Text>
          </CardContent>
        </Card>
      ) : null}

      {profileQuery.isLoading ? <LoadingCard message="Loading your log view..." /> : null}

      {profileQuery.isError ? (
        <Card className="border border-red-300 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4">
            <Text className="text-red-700 dark:text-red-300">Unable to determine which log view to show.</Text>
          </CardContent>
        </Card>
      ) : null}

      {!profileQuery.isLoading && !profileQuery.isError && !role ? (
        <Card className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <Text className="text-amber-800 dark:text-amber-300">
              Your account role is missing, so logs cannot be loaded yet.
            </Text>
          </CardContent>
        </Card>
      ) : null}

      {isDriver ? (
        <>
          <View>
            <Text className="text-sm font-bold text-gray-500 tracking-wider uppercase mb-3">Severity</Text>
            <View className="flex-row flex-wrap gap-2">
              {DRIVER_SEVERITY_FILTERS.map((filter) => (
                <FilterChip
                  key={filter}
                  label={filter}
                  active={driverSeverity === filter}
                  onPress={() => {
                    setDriverSeverity(filter);
                    setDriverPage(1);
                  }}
                />
              ))}
            </View>
          </View>

          <View>
            <Text className="text-sm font-bold text-gray-500 tracking-wider uppercase mb-3">Time Window</Text>
            <View className="flex-row flex-wrap gap-2">
              {DAY_FILTERS.map((days) => (
                <FilterChip
                  key={days}
                  label={`${days} days`}
                  active={driverDays === days}
                  onPress={() => {
                    setDriverDays(days);
                    setDriverPage(1);
                  }}
                />
              ))}
            </View>
          </View>

          {driverEventsQuery.isLoading ? <LoadingCard message="Loading event history..." /> : null}

          {driverEventsQuery.isError ? (
            <Card className="border border-red-300 bg-red-50 dark:bg-red-900/20">
              <CardContent className="p-4">
                <Text className="text-red-700 dark:text-red-300">Unable to load drowsiness events.</Text>
              </CardContent>
            </Card>
          ) : null}

          {driverEventsQuery.data && driverEventsQuery.data.events.length === 0 ? (
            <Card>
              <CardContent className="p-4">
                <Text className="text-gray-500 dark:text-gray-400">
                  No events were found for the selected filters.
                </Text>
              </CardContent>
            </Card>
          ) : null}

          {driverEventsQuery.data?.events.map((event) => (
            <Card key={event.id}>
              <CardContent className="p-4">
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1 mr-3">
                    <Text className="text-gray-900 dark:text-white font-semibold">
                      {formatDateTime(event.created_at)}
                    </Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                      Duration: {event.duration_seconds?.toFixed(2) ?? '--'}s
                    </Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-sm">
                      EAR: {typeof event.ear_value === 'number' ? event.ear_value.toFixed(3) : '--'}
                    </Text>
                  </View>
                  <Badge variant={severityToVariant(event.severity)}>{event.severity}</Badge>
                </View>

                <Button
                  title={deleteEventMutation.isPending ? 'Deleting...' : 'Delete Event'}
                  variant="ghost"
                  loading={deleteEventMutation.isPending}
                  onPress={async () => {
                    try {
                      setActionMessage(null);
                      await deleteEventMutation.mutateAsync(event.id);
                      setActionTone('success');
                      setActionMessage('Event deleted successfully.');
                    } catch (error) {
                      setActionTone('error');
                      setActionMessage(
                        error instanceof Error ? error.message : 'Unable to delete this event.',
                      );
                    }
                  }}
                  className="self-start px-0 py-0"
                  textClassName="text-danger dark:text-red-400"
                />
              </CardContent>
            </Card>
          ))}

          {driverEventsQuery.data ? (
            <Card>
              <CardContent className="p-4 flex-row items-center justify-between">
                <View>
                  <Text className="text-gray-900 dark:text-white font-semibold">
                    Page {driverPage} of {driverPagination.totalPages}
                  </Text>
                  <Text className="text-gray-500 dark:text-gray-400 text-sm">
                    {driverPagination.total} matching events
                  </Text>
                </View>

                <View className="flex-row gap-2">
                  <Button
                    title="Previous"
                    variant="secondary"
                    disabled={driverPage <= 1}
                    onPress={() => setDriverPage((current) => Math.max(1, current - 1))}
                    className="px-4 py-2"
                  />
                  <Button
                    title="Next"
                    variant="primary"
                    disabled={driverPage >= driverPagination.totalPages}
                    onPress={() =>
                      setDriverPage((current) => Math.min(driverPagination.totalPages, current + 1))
                    }
                    className="px-4 py-2"
                  />
                </View>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {isGuardian ? (
        <>
          <View>
            <Text className="text-sm font-bold text-gray-500 tracking-wider uppercase mb-3">Filter</Text>
            <View className="flex-row flex-wrap gap-2">
              <FilterChip
                label="All notifications"
                active={!guardianUnreadOnly}
                onPress={() => {
                  setGuardianUnreadOnly(false);
                  setGuardianPage(1);
                }}
              />
              <FilterChip
                label="Unread only"
                active={guardianUnreadOnly}
                onPress={() => {
                  setGuardianUnreadOnly(true);
                  setGuardianPage(1);
                }}
              />
            </View>
          </View>

          <View>
            <Text className="text-sm font-bold text-gray-500 tracking-wider uppercase mb-3">Time Window</Text>
            <View className="flex-row flex-wrap gap-2">
              {DAY_FILTERS.map((days) => (
                <FilterChip
                  key={days}
                  label={`${days} days`}
                  active={guardianDays === days}
                  onPress={() => {
                    setGuardianDays(days);
                    setGuardianPage(1);
                  }}
                />
              ))}
            </View>
          </View>

          {notificationsQuery.isLoading ? <LoadingCard message="Loading guardian notifications..." /> : null}

          {notificationsQuery.isError ? (
            <Card className="border border-red-300 bg-red-50 dark:bg-red-900/20">
              <CardContent className="p-4">
                <Text className="text-red-700 dark:text-red-300">
                  Unable to load guardian notifications.
                </Text>
              </CardContent>
            </Card>
          ) : null}

          {notificationsQuery.data && notificationsQuery.data.notifications.length === 0 ? (
            <Card>
              <CardContent className="p-4">
                <Text className="text-gray-500 dark:text-gray-400">
                  No guardian notifications match the current filters.
                </Text>
              </CardContent>
            </Card>
          ) : null}

          {notificationsQuery.data?.notifications.map((notification) => (
            <Card key={notification.id}>
              <CardContent className="p-4">
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1 mr-3">
                    <Text className="text-gray-900 dark:text-white font-semibold">
                      {notification.message}
                    </Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                      {notification.driver_name || notification.driver_email || notification.driver_id}
                    </Text>
                    <Text className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                      {formatDateTime(notification.created_at)}
                    </Text>
                  </View>

                  <View className="items-end">
                    <Badge variant={severityToVariant(notification.severity)}>{notification.severity}</Badge>
                    <Badge variant={notification.is_read ? 'default' : 'warning'} className="mt-2">
                      {notification.is_read ? 'READ' : 'UNREAD'}
                    </Badge>
                  </View>
                </View>

                {!notification.is_read ? (
                  <Button
                    title={markReadMutation.isPending ? 'Updating...' : 'Mark as Read'}
                    variant="secondary"
                    loading={markReadMutation.isPending}
                    onPress={async () => {
                      try {
                        setActionMessage(null);
                        await markReadMutation.mutateAsync(notification.id);
                        setActionTone('success');
                        setActionMessage('Notification marked as read.');
                      } catch (error) {
                        setActionTone('error');
                        setActionMessage(
                          error instanceof Error
                            ? error.message
                            : 'Unable to update this notification.',
                        );
                      }
                    }}
                    className="self-start px-4 py-2"
                  />
                ) : null}
              </CardContent>
            </Card>
          ))}

          {notificationsQuery.data ? (
            <Card>
              <CardContent className="p-4 flex-row items-center justify-between">
                <View>
                  <Text className="text-gray-900 dark:text-white font-semibold">
                    Page {guardianPage} of {guardianPagination.totalPages}
                  </Text>
                  <Text className="text-gray-500 dark:text-gray-400 text-sm">
                    {guardianPagination.total} matching notifications
                  </Text>
                </View>

                <View className="flex-row gap-2">
                  <Button
                    title="Previous"
                    variant="secondary"
                    disabled={guardianPage <= 1}
                    onPress={() => setGuardianPage((current) => Math.max(1, current - 1))}
                    className="px-4 py-2"
                  />
                  <Button
                    title="Next"
                    variant="primary"
                    disabled={guardianPage >= guardianPagination.totalPages}
                    onPress={() =>
                      setGuardianPage((current) => Math.min(guardianPagination.totalPages, current + 1))
                    }
                    className="px-4 py-2"
                  />
                </View>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </ScreenWrapper>
  );
}
