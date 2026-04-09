import { useQuery } from '@tanstack/react-query';

import { SUPABASE_CONFIGURED, supabase } from '@/lib/supabase';

export function useDriverSession(driverId?: string) {
  return useQuery({
    queryKey: ['driver-session', driverId],
    enabled: Boolean(driverId) && SUPABASE_CONFIGURED,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('driver_id', driverId as string)
        .eq('status', 'ACTIVE')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  });
}
