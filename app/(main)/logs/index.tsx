import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, Bell, BellOff, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react-native';

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
import { useRealtimeDriver } from '@/hooks/useRealtimeDriver';
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
  if (!value) return 'Not available';
  return new Date(value).toLocaleString();
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-3 py-2 rounded-full border ${
        active
          ? 'bg-primary border-primary'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}>
      <Text className={active ? 'text-white font-semibold text-xs' : 'text-gray-600 dark:text-gray-300 font-medium text-xs'}>
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

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="p-8 items-center">
        <AlertTriangle size={32} color="#9ca3af" />
        <Text className="text-gray-500 dark:text-gray-400 mt-3 text-center text-sm">
          {message}
        </Text>
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

  const driversQuery = useMyDrivers({ enabled: isGuardian });

  const driverIds = useMemo(() => {
    if (!isGuardian || !driversQuery.data) return [];
    return driversQuery.data.map((driver) => driver.id);
  }, [isGuardian, driversQuery.data]);

  const [driverSeverity, setDriverSeverity] = useState<'ALL' | DetectionSeverity>('ALL');
  const [driverDays, setDriverDays] = useState(30);
  const [driverPage, setDriverPage] = useState(1);

  const [guardianUnreadOnly, setGuardianUnreadOnly] = useState(false);
  const [guardianDays, setGuardianDays] = useState(30);
  const [guardianPage, setGuardianPage] = useState(1);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<'success' | 'error'>('success');

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

  useRealtimeGuardian(isGuardian ? user?.id : undefined, driverIds);
  useRealtimeDriver(isDriver ? user?.id : undefined);

  const refreshLogs = useCallback(async () => {
    const tasks: Promise<{ error: Error | null }>[] = [profileQuery.refetch()];

    if (isDriver) tasks.push(driverEventsQuery.refetch());
    if (isGuardian) tasks.push(driversQuery.refetch(), notificationsQuery.refetch());

    const results = await Promise.all(tasks);
    const failed = results.find((r) => r.error);

    if (failed?.error) throw failed.error;
  }, [driverEventsQuery, driversQuery, isDriver, isGuardian, notificationsQuery, profileQuery]);

  const { refreshing, onRefresh } = usePullToRefresh(refreshLogs);

  useRefreshOnFocus(onRefresh, { enabled: Boolean(user?.id) });

  const handleDeleteEvent = useCallback(
    async (eventId: number) => {
      try {
        await deleteEventMutation.mutateAsync(eventId);
        setActionMessage('Event deleted successfully.');
        setActionTone('success');
      } catch {
        setActionMessage('Failed to delete event.');
        setActionTone('error');
      }
      setTimeout(() => setActionMessage(null), 3000);
    },
    [deleteEventMutation],
  );

  const handleMarkRead = useCallback(
    async (notificationId: number) => {
      try {
        await markReadMutation.mutateAsync(notificationId);
        setActionMessage('Notification marked as read.');
        setActionTone('success');
      } catch {
        setActionMessage('Failed to update notification.');
        setActionTone('error');
      }
      setTimeout(() => setActionMessage(null), 3000);
    },
    [markReadMutation],
  );

  // Pagination helpers
  const driverTotalPages = Math.max(
    1,
    Math.ceil((driverEventsQuery.data?.total ?? 0) / 10),
  );
  const guardianTotalPages = Math.max(
    1,
    Math.ceil((notificationsQuery.data?.total ?? 0) / 10),
  );

  return (
    <ScreenWrapper
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        {isGuardian ? 'Guardian Notifications' : 'Event History'}
      </Text>

      {profileQuery.isLoading && <LoadingCard message="Loading..." />}

      {/* Action feedback toast */}
      {actionMessage && (
        <Card
          className={`mb-3 border ${
            actionTone === 'success'
              ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
              : 'border-red-300 bg-red-50 dark:bg-red-900/20'
          }`}
        >
          <CardContent className="p-3">
            <Text
              className={
                actionTone === 'success'
                  ? 'text-emerald-700 dark:text-emerald-300 text-sm'
                  : 'text-red-700 dark:text-red-300 text-sm'
              }
            >
              {actionMessage}
            </Text>
          </CardContent>
        </Card>
      )}

      {/* ================================================================= */}
      {/* DRIVER VIEW                                                       */}
      {/* ================================================================= */}
      {isDriver && (
        <>
          {/* Severity Filters */}
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Severity
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
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

          {/* Day Filters */}
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Time Range
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
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

          {/* Loading */}
          {driverEventsQuery.isLoading && <LoadingCard message="Fetching events..." />}

          {/* Error */}
          {driverEventsQuery.isError && (
            <Card className="border border-red-300 bg-red-50 dark:bg-red-900/20 mb-3">
              <CardContent className="p-4">
                <Text className="text-red-700 dark:text-red-300 text-sm">
                  Failed to load events. Pull down to retry.
                </Text>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!driverEventsQuery.isLoading &&
            !driverEventsQuery.isError &&
            (driverEventsQuery.data?.events?.length ?? 0) === 0 && (
              <EmptyState message="No drowsiness events found for the selected filters." />
            )}

          {/* Event List */}
          {(driverEventsQuery.data?.events ?? []).map((event) => (
            <Card key={event.id} className="mb-3">
              <CardContent className="p-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Badge variant={severityToVariant(event.severity)}>
                    {event.severity}
                  </Badge>
                  <Text className="text-gray-400 dark:text-gray-500 text-xs">
                    #{event.id}
                  </Text>
                </View>

                <View className="flex-row justify-between mb-1">
                  <Text className="text-gray-600 dark:text-gray-300 text-sm">
                    EAR: {event.ear_value != null ? event.ear_value.toFixed(3) : '--'}
                  </Text>
                  <Text className="text-gray-600 dark:text-gray-300 text-sm">
                    Duration: {event.duration_seconds != null ? `${event.duration_seconds.toFixed(1)}s` : '--'}
                  </Text>
                </View>

                <Text className="text-gray-400 dark:text-gray-500 text-xs mb-3">
                  {formatDateTime(event.created_at)}
                </Text>

                <TouchableOpacity
                  className="flex-row items-center self-end"
                  onPress={() => handleDeleteEvent(event.id)}
                  disabled={deleteEventMutation.isPending}
                >
                  <Trash2 size={14} color="#ef4444" />
                  <Text className="text-red-500 text-xs ml-1">Delete</Text>
                </TouchableOpacity>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {(driverEventsQuery.data?.total ?? 0) > 10 && (
            <View className="flex-row items-center justify-center gap-4 mt-2 mb-4">
              <TouchableOpacity
                onPress={() => setDriverPage((p) => Math.max(1, p - 1))}
                disabled={driverPage <= 1}
                className={`p-2 rounded-full ${driverPage <= 1 ? 'opacity-30' : ''}`}
              >
                <ChevronLeft size={20} color="#6b7280" />
              </TouchableOpacity>
              <Text className="text-gray-600 dark:text-gray-300 text-sm font-medium">
                Page {driverPage} of {driverTotalPages}
              </Text>
              <TouchableOpacity
                onPress={() => setDriverPage((p) => Math.min(driverTotalPages, p + 1))}
                disabled={driverPage >= driverTotalPages}
                className={`p-2 rounded-full ${driverPage >= driverTotalPages ? 'opacity-30' : ''}`}
              >
                <ChevronRight size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* GUARDIAN VIEW                                                     */}
      {/* ================================================================= */}
      {isGuardian && (
        <>
          {/* Guardian Filters */}
          <View className="flex-row flex-wrap gap-2 mb-3">
            <FilterChip
              label={guardianUnreadOnly ? 'Unread Only' : 'All Notifications'}
              active={guardianUnreadOnly}
              onPress={() => {
                setGuardianUnreadOnly((prev) => !prev);
                setGuardianPage(1);
              }}
            />
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

          {/* Loading */}
          {notificationsQuery.isLoading && <LoadingCard message="Fetching notifications..." />}

          {/* Error */}
          {notificationsQuery.isError && (
            <Card className="border border-red-300 bg-red-50 dark:bg-red-900/20 mb-3">
              <CardContent className="p-4">
                <Text className="text-red-700 dark:text-red-300 text-sm">
                  Failed to load notifications. Pull down to retry.
                </Text>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!notificationsQuery.isLoading &&
            !notificationsQuery.isError &&
            (notificationsQuery.data?.notifications?.length ?? 0) === 0 && (
              <EmptyState message="No notifications found for the selected filters." />
            )}

          {/* Notification List */}
          {(notificationsQuery.data?.notifications ?? []).map((notification) => (
            <Card
              key={notification.id}
              className={`mb-3 ${!notification.is_read ? 'border border-amber-200 dark:border-amber-800/50' : ''}`}
            >
              <CardContent className="p-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Badge variant={severityToVariant(notification.severity)}>
                    {notification.severity}
                  </Badge>
                  <View className="flex-row items-center">
                    {!notification.is_read && (
                      <View className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
                    )}
                    <Text className="text-gray-400 dark:text-gray-500 text-xs">
                      #{notification.id}
                    </Text>
                  </View>
                </View>

                <Text className="text-gray-900 dark:text-white font-semibold text-sm mb-1">
                  {notification.driver_name || notification.driver_email || 'Unknown Driver'}
                </Text>

                <Text className="text-gray-600 dark:text-gray-300 text-sm mb-1">
                  {notification.message}
                </Text>

                <Text className="text-gray-400 dark:text-gray-500 text-xs mb-3">
                  {formatDateTime(notification.created_at)}
                </Text>

                {!notification.is_read && (
                  <TouchableOpacity
                    className="flex-row items-center self-end"
                    onPress={() => handleMarkRead(notification.id)}
                    disabled={markReadMutation.isPending}
                  >
                    <BellOff size={14} color="#6b7280" />
                    <Text className="text-gray-500 dark:text-gray-400 text-xs ml-1">
                      Mark as read
                    </Text>
                  </TouchableOpacity>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {(notificationsQuery.data?.total ?? 0) > 10 && (
            <View className="flex-row items-center justify-center gap-4 mt-2 mb-4">
              <TouchableOpacity
                onPress={() => setGuardianPage((p) => Math.max(1, p - 1))}
                disabled={guardianPage <= 1}
                className={`p-2 rounded-full ${guardianPage <= 1 ? 'opacity-30' : ''}`}
              >
                <ChevronLeft size={20} color="#6b7280" />
              </TouchableOpacity>
              <Text className="text-gray-600 dark:text-gray-300 text-sm font-medium">
                Page {guardianPage} of {guardianTotalPages}
              </Text>
              <TouchableOpacity
                onPress={() => setGuardianPage((p) => Math.min(guardianTotalPages, p + 1))}
                disabled={guardianPage >= guardianTotalPages}
                className={`p-2 rounded-full ${guardianPage >= guardianTotalPages ? 'opacity-30' : ''}`}
              >
                <ChevronRight size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScreenWrapper>
  );
}