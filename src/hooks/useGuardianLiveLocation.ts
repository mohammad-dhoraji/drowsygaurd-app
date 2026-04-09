import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { SUPABASE_CONFIGURED, supabase } from '@/lib/supabase';

interface DriverLiveLocationRow {
  driver_id?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface DriverLiveLocation {
  userId: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

function toNumber(value: unknown): number | null {
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

function toDriverLiveLocation(row: DriverLiveLocationRow | null | undefined): DriverLiveLocation | null {
  if (!row?.driver_id) {
    return null;
  }

  const lat = toNumber(row.lat);
  const lng = toNumber(row.lng);

  if (lat === null || lng === null) {
    return null;
  }

  return {
    userId: row.driver_id,
    lat,
    lng,
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  };
}

function sortLocations(locations: DriverLiveLocation[]) {
  return [...locations].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export function useGuardianLiveLocation(guardianId?: string, driverIds: string[] = []) {
  const queryClient = useQueryClient();
  const driverIdsKey = driverIds.join(',');
  const queryKey = useMemo(
    () => ['guardian-live-location', guardianId, driverIdsKey] as const,
    [driverIdsKey, guardianId],
  );

  const query = useQuery({
    queryKey,
    enabled: Boolean(guardianId) && driverIds.length > 0 && SUPABASE_CONFIGURED,
    queryFn: async () => {
      console.log('[useGuardianLiveLocation] Fetching live locations', {
        guardianId,
        driverIds,
        driverIdsCount: driverIds.length,
      });

      const { data, error } = await supabase
        .from('driver_live_location')
        .select('*')
        .in('driver_id', driverIds)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[useGuardianLiveLocation] Query failed:', {
          error,
          errorMessage: error.message,
          driverIds,
        });
        throw error;
      }

      console.log('[useGuardianLiveLocation] Query successful', {
        rowCount: (data ?? []).length,
      });

      return sortLocations(
        ((data ?? []) as DriverLiveLocationRow[])
          .map((row) => toDriverLiveLocation(row))
          .filter((location): location is DriverLiveLocation => location !== null),
      );
    },
    staleTime: 10 * 1000,
  });

  useEffect(() => {
    if (!guardianId || driverIds.length === 0 || !SUPABASE_CONFIGURED) {
      return undefined;
    }

    const filter = `driver_id=in.(${driverIdsKey})`;
    console.log('[useGuardianLiveLocation] Setting up real-time subscription', {
      guardianId,
      filter,
      driverIdsCount: driverIds.length,
    });

    const channel = supabase
      .channel(`guardian_live_location_${guardianId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_live_location',
          filter,
        },
        (payload) => {
          const nextLocation = toDriverLiveLocation(payload.new as DriverLiveLocationRow);

          if (!nextLocation) {
            return;
          }

          queryClient.setQueryData<DriverLiveLocation[]>(queryKey, (current = []) => {
            const remaining = current.filter((location) => location.userId !== nextLocation.userId);
            return sortLocations([nextLocation, ...remaining]);
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_live_location',
          filter,
        },
        (payload) => {
          const nextLocation = toDriverLiveLocation(payload.new as DriverLiveLocationRow);

          if (!nextLocation) {
            return;
          }

          queryClient.setQueryData<DriverLiveLocation[]>(queryKey, (current = []) => {
            const remaining = current.filter((location) => location.userId !== nextLocation.userId);
            return sortLocations([nextLocation, ...remaining]);
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [driverIds.length, driverIdsKey, guardianId, queryClient, queryKey]);

  return query;
}
