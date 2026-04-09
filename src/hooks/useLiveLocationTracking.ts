import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { updateDriverLocation } from '@/services/apiService';
import { useDriverStore } from '@/state/stores/driverStore';

const LOCATION_TRACKING_INTERVAL_MS = 4_000;

type IntervalHandle = ReturnType<typeof globalThis.setInterval>;

interface LiveLocationTrackingState {
  error: string | null;
  isTracking: boolean;
  lastSentAt: string | null;
  permissionStatus: Location.PermissionStatus | null;
}

export function useLiveLocationTracking(isHighRisk: boolean): LiveLocationTrackingState {
  const { user } = useAuth();
  const setLocation = useDriverStore((state) => state.setLocation);

  const intervalRef = useRef<IntervalHandle | null>(null);
  const requestInFlightRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    requestInFlightRef.current = false;
    setIsTracking(false);
  }, []);

  const sendCurrentLocation = useCallback(async () => {
    if (!user?.id || requestInFlightRef.current) {
      if (__DEV__ && !user?.id) {
        console.debug('[useLiveLocationTracking] Skipping: no user.id');
      }
      return;
    }

    requestInFlightRef.current = true;

    try {
      console.debug('[useLiveLocationTracking] Fetching location permission...');
      const permission = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(permission.status);

      if (permission.status !== Location.PermissionStatus.GRANTED) {
        const permError = 'Foreground location permission is required to share live driver updates.';
        console.warn('[useLiveLocationTracking] Permission denied:', {
          status: permission.status,
          expected: Location.PermissionStatus.GRANTED,
        });
        setError(permError);
        stopTracking();
        return;
      }

      console.debug('[useLiveLocationTracking] Getting current position...');
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const nextLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      console.debug('[useLiveLocationTracking] Got location:', nextLocation);
      setLocation(nextLocation);

      console.debug('[useLiveLocationTracking] Posting to /location/update...', {
        user_id: user.id,
        lat: nextLocation.lat,
        lng: nextLocation.lng,
      });

      const result = await updateDriverLocation({
        user_id: user.id,
        ...nextLocation,
      });

      if (result.error) {
        const errorMsg = result.error.message;
        console.error('[useLiveLocationTracking] API error:', {
          message: errorMsg,
          status: result.error.status,
        });
        setError(errorMsg);
        return;
      }

      console.debug('[useLiveLocationTracking] Location sent successfully');
      setError(null);
      setLastSentAt(new Date().toISOString());
    } catch (trackingError) {
      const errorMsg =
        trackingError instanceof Error
          ? trackingError.message
          : 'Unable to capture the current driver location.';
      console.error('[useLiveLocationTracking] Exception:', {
        error: trackingError,
        message: errorMsg,
      });
      setError(errorMsg);
    } finally {
      requestInFlightRef.current = false;
    }
  }, [setLocation, stopTracking, user?.id]);

  useEffect(() => {
    if (!isHighRisk || !user?.id) {
      if (__DEV__ && (isHighRisk !== (intervalRef.current !== null))) {
        console.debug('[useLiveLocationTracking] Stopping tracking:', {
          isHighRisk,
          hasUserId: !!user?.id,
        });
      }
      setError(null);
      stopTracking();
      return undefined;
    }

    let isMounted = true;

    const startTracking = async () => {
      console.debug('[useLiveLocationTracking] Starting location tracking flow...');
      try {
        console.debug('[useLiveLocationTracking] Requesting location permission...');
        const permission = await Location.requestForegroundPermissionsAsync();

        if (!isMounted) {
          console.debug('[useLiveLocationTracking] Component unmounted during permission request');
          return;
        }

        setPermissionStatus(permission.status);

        if (permission.status !== Location.PermissionStatus.GRANTED) {
          const permError = 'Allow foreground location access so guardians can see the live driver position.';
          console.warn('[useLiveLocationTracking] Permission not granted:', {
            status: permission.status,
          });
          setError(permError);
          stopTracking();
          return;
        }

        console.debug('[useLiveLocationTracking] Permission granted, starting periodic updates');
        setError(null);
        setIsTracking(true);

        // Send location immediately, then every LOCATION_TRACKING_INTERVAL_MS
        await sendCurrentLocation();

        if (!isMounted || intervalRef.current) {
          console.debug('[useLiveLocationTracking] Skipping interval setup (unmounted or already running)');
          return;
        }

        intervalRef.current = globalThis.setInterval(() => {
          void sendCurrentLocation();
        }, LOCATION_TRACKING_INTERVAL_MS);

        console.debug('[useLiveLocationTracking] Interval started:', {
          intervalMs: LOCATION_TRACKING_INTERVAL_MS,
        });
      } catch (trackingError) {
        if (!isMounted) {
          console.debug('[useLiveLocationTracking] Component unmounted during error handling');
          return;
        }

        const errorMsg =
          trackingError instanceof Error
            ? trackingError.message
            : 'Unable to start live location tracking.';
        console.error('[useLiveLocationTracking] Failed to start tracking:', {
          error: trackingError,
          message: errorMsg,
        });
        setError(errorMsg);
        stopTracking();
      }
    };

    void startTracking();

    return () => {
      isMounted = false;
      console.debug('[useLiveLocationTracking] Cleanup: stopping tracking');
      stopTracking();
    };
  }, [isHighRisk, sendCurrentLocation, stopTracking, user?.id]);

  return {
    error,
    isTracking,
    lastSentAt,
    permissionStatus,
  };
}
