import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { SUPABASE_CONFIGURED, supabase } from '@/lib/supabase';

export function useRealtimeGuardian(guardianId?: string, driverIds: string[] = []) {
  const queryClient = useQueryClient();

  // ✅ Stabilize driverIds (order + reference safe)
  const driverIdsKey = useMemo(() => {
    if (!driverIds || driverIds.length === 0) return '';
    return [...driverIds].sort().join(',');
  }, [driverIds]);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !guardianId) {
      return;
    }

    const channels: ReturnType<typeof supabase.channel>[] = [];

    // ✅ Guardian notifications channel
    const notificationsChannel = supabase
      .channel(`guardian_notifications_${guardianId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guardian_notifications',
          filter: `guardian_id=eq.${guardianId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['guardian-dashboard', guardianId] });
          queryClient.invalidateQueries({ queryKey: ['guardian-notifications'] });
        },
      )
      .subscribe();

    channels.push(notificationsChannel);

    // ✅ Driver-related channels (only if drivers exist)
    if (driverIds.length > 0 && driverIdsKey) {
      const driverFilter = `driver_id=in.(${driverIdsKey})`;

      const driverChannel = supabase
        .channel(`guardian_sessions_${guardianId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sessions',
            filter: driverFilter,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['guardian-dashboard', guardianId] });
            queryClient.invalidateQueries({ queryKey: ['guardian-drivers'] });
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'drowsiness_events',
            filter: driverFilter,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['guardian-dashboard', guardianId] });
            queryClient.invalidateQueries({ queryKey: ['guardian-notifications'] });
          },
        )
        .subscribe();

      channels.push(driverChannel);
    }

    // ✅ Cleanup (important)
    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [guardianId, driverIdsKey, queryClient]);
}