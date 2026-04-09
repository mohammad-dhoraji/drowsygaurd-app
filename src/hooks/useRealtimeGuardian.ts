import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { SUPABASE_CONFIGURED, supabase } from '@/lib/supabase';

export function useRealtimeGuardian(guardianId?: string, driverIds: string[] = []) {
  const queryClient = useQueryClient();
  const driverIdsKey = driverIds.join(',');

  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !guardianId) {
      return undefined;
    }

    const channels = [
      supabase
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
            void queryClient.invalidateQueries({ queryKey: ['guardian-dashboard', guardianId] });
            void queryClient.invalidateQueries({ queryKey: ['guardian-notifications'] });
          },
        )
        .subscribe(),
    ];

    if (driverIdsKey.length > 0) {
      const driverFilter = `driver_id=in.(${driverIdsKey})`;

      channels.push(
        supabase
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
              void queryClient.invalidateQueries({ queryKey: ['guardian-dashboard', guardianId] });
              void queryClient.invalidateQueries({ queryKey: ['guardian-drivers'] });
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
              void queryClient.invalidateQueries({ queryKey: ['guardian-dashboard', guardianId] });
              void queryClient.invalidateQueries({ queryKey: ['guardian-notifications'] });
            },
          )
          .subscribe(),
      );
    }

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [guardianId, queryClient, driverIdsKey]);
}
