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
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function toDriverLiveLocation(
  row: DriverLiveLocationRow | null | undefined
): DriverLiveLocation | null {
  if (!row?.driver_id) return null;

  const lat = toNumber(row.lat);
  const lng = toNumber(row.lng);

  if (lat === null || lng === null) return null;

  return {
    userId: row.driver_id,
    lat,
    lng,
    updatedAt: row.updated_at ?? row.created_at ?? new Date(0).toISOString(),
  };
}

function sortLocations(locations: DriverLiveLocation[]) {
  return [...locations].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function useGuardianLiveLocation(
  guardianId?: string,
  driverIds: string[] = []
) {
  const queryClient = useQueryClient();

  // ✅ stabilize driverIds (prevents re-render loops)
  const stableDriverIds = useMemo(
    () => (Array.isArray(driverIds) ? driverIds : []),
    [JSON.stringify(driverIds)]
  );

  const driverIdsKey = useMemo(
    () => stableDriverIds.join(','),
    [stableDriverIds]
  );

  const queryKey = useMemo(
    () => ['guardian-live-location', guardianId, driverIdsKey] as const,
    [guardianId, driverIdsKey]
  );

  const query = useQuery({
    queryKey,
    enabled:
      Boolean(guardianId) &&
      stableDriverIds.length > 0 &&
      SUPABASE_CONFIGURED,

    // ✅ HARD GUARD (prevents invalid SQL → 500)
    queryFn: async () => {
      if (!stableDriverIds.length) {
        console.warn(
          '[useGuardianLiveLocation] Skipping query (no driverIds)'
        );
        return [];
      }

      console.log('[useGuardianLiveLocation] Fetching live locations', {
        guardianId,
        driverIds: stableDriverIds,
      });

      const { data, error } = await supabase
        .from('driver_live_location')
        .select('*')
        .in('driver_id', stableDriverIds)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[useGuardianLiveLocation] Query failed:', error);
        throw error;
      }

      return sortLocations(
        (data ?? [])
          .map((row) => toDriverLiveLocation(row))
          .filter(
            (location): location is DriverLiveLocation =>
              location !== null
          )
      );
    },

    staleTime: 10 * 1000,
    retry: false, // ✅ stop retry loops
  });

  // ✅ REALTIME SUBSCRIPTION (fixed)
  useEffect(() => {
    if (
      !guardianId ||
      stableDriverIds.length === 0 ||
      !SUPABASE_CONFIGURED
    ) {
      return;
    }

    if (!driverIdsKey) return; // 🔥 prevents "in()" crash

    const filter = `driver_id=in.(${driverIdsKey})`;

    console.log('[useGuardianLiveLocation] Subscribing', {
      guardianId,
      filter,
    });

    const channel = supabase
      .channel(`guardian_live_location_${guardianId}`)

      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_live_location',
          filter,
        },
        (payload) => {
          handleRealtimeUpdate(payload.new);
        }
      )

      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_live_location',
          filter,
        },
        (payload) => {
          handleRealtimeUpdate(payload.new);
        }
      )

      .subscribe();

    function handleRealtimeUpdate(newRow: any) {
      const nextLocation = toDriverLiveLocation(newRow);

      if (!nextLocation) return;

      queryClient.setQueryData<DriverLiveLocation[]>(
        queryKey,
        (current = []) => {
          const filtered = current.filter(
            (loc) => loc.userId !== nextLocation.userId
          );

          return sortLocations([nextLocation, ...filtered]);
        }
      );
    }

    return () => {
      console.log('[useGuardianLiveLocation] Unsubscribing');
      supabase.removeChannel(channel);
    };
  }, [guardianId, driverIdsKey, stableDriverIds.length, queryClient, queryKey]);

  return query;
}