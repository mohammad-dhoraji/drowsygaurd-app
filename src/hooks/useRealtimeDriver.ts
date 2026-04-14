import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { SUPABASE_CONFIGURED, supabase } from '@/lib/supabase';

export function useRealtimeDriver(driverId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !driverId) {
      return undefined;
    }

    const invalidateDriverQueries = () => {
      void queryClient.invalidateQueries({ queryKey: ['driver-events'] });
      void queryClient.invalidateQueries({ queryKey: ['driver-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['driver-sessions'] });
    };

    const channel = supabase
      .channel(`driver_activity_${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drowsiness_events',
          filter: `driver_id=eq.${driverId}`,
        },
        invalidateDriverQueries,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `driver_id=eq.${driverId}`,
        },
        invalidateDriverQueries,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [driverId, queryClient]);
}
