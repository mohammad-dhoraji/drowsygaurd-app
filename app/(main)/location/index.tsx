import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LocateFixed, ShieldAlert } from "lucide-react-native";

import GuardianLiveMap from "../../../src/components/location/GuardianLiveMap";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { useGuardianDashboardData } from "@/hooks/useGuardianData";
import { useGuardianLiveLocation } from "@/hooks/useGuardianLiveLocation";
import { useRealtimeGuardian } from "@/hooks/useRealtimeGuardian";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";

function formatCoordinate(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return value.toFixed(5);
}

function resolveStatusBadge(alertLevel?: string | null) {
  if (alertLevel === "High Risk") {
    return { label: "CRITICAL", variant: "danger" as const };
  }

  if (alertLevel === "Medium Risk") {
    return { label: "DROWSY", variant: "warning" as const };
  }

  return { label: "SAFE", variant: "safe" as const };
}

export default function LocationScreen() {
  const { user } = useAuth();
  const guardianId = user?.id;
  const profileQuery = useCurrentUserProfile();
  const dashboardQuery = useGuardianDashboardData(guardianId);

  const driverIds = useMemo(
    () => dashboardQuery.data?.driverIds ?? [],
    [dashboardQuery.data?.driverIds],
  );

  useRealtimeGuardian(guardianId, driverIds);

  const liveLocationQuery = useGuardianLiveLocation(
    guardianId,
    dashboardQuery.data?.driverIds ?? [],
  );

  const refreshData = useCallback(async () => {
    await Promise.all([dashboardQuery.refetch(), liveLocationQuery.refetch()]);
  }, [dashboardQuery, liveLocationQuery]);

  useRefreshOnFocus(refreshData, { enabled: Boolean(guardianId) });

  const selectedLocation = useMemo(() => {
    const locations = liveLocationQuery.data ?? [];
    const activeDriverIds = new Set(
      (dashboardQuery.data?.drivers ?? [])
        .filter((driver) => Boolean(driver.activeSessionId))
        .map((driver) => driver.id),
    );

    return (
      locations.find((location) => activeDriverIds.has(location.userId)) ??
      locations[0] ??
      null
    );
  }, [dashboardQuery.data?.drivers, liveLocationQuery.data]);

  const selectedDriver = useMemo(() => {
    if (!selectedLocation) {
      return null;
    }

    return (
      dashboardQuery.data?.drivers.find(
        (driver) => driver.id === selectedLocation.userId,
      ) ?? null
    );
  }, [dashboardQuery.data?.drivers, selectedLocation]);

  const status = resolveStatusBadge(selectedDriver?.alertLevel ?? null);

  if (profileQuery.isLoading || dashboardQuery.isLoading) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ flex: 1, backgroundColor: "#020617" }}
      >
        <View className="flex-1 items-center justify-center bg-slate-950 px-6">
          <ActivityIndicator size="large" color="#34d399" />
          <Text className="mt-4 text-base font-semibold text-white">
            Loading guardian live map...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (profileQuery.data?.role === "driver") {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{ flex: 1, backgroundColor: "#020617" }}
      >
        <View className="flex-1 justify-center bg-slate-950 px-5">
          <Card className="border border-amber-300 bg-amber-50">
            <CardContent className="p-4">
              <Text className="font-semibold text-amber-800">
                This screen is available to guardian accounts only.
              </Text>
              <Text className="mt-2 text-sm leading-6 text-amber-700">
                Sign in as a guardian to watch the live driver position during a
                HIGH_RISK event.
              </Text>
            </CardContent>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: "#020617" }}
    >
      <View className="flex-1 bg-slate-950">
        {selectedLocation ? (
          <GuardianLiveMap
            description={
              selectedDriver
                ? `${selectedDriver.alertLevel} - ${selectedDriver.routeName}`
                : "Live driver position"
            }
            latitude={selectedLocation.lat}
            longitude={selectedLocation.lng}
            title={selectedDriver?.name ?? "Driver"}
          />
        ) : (
          <View className="absolute inset-0 items-center justify-center bg-slate-950 px-6">
            <View className="h-28 w-28 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10">
              <LocateFixed size={42} color="#34d399" />
            </View>
            <Text className="mt-6 text-center text-2xl font-bold text-white">
              Waiting for live location
            </Text>
            <Text className="mt-3 max-w-sm text-center text-sm leading-6 text-slate-300">
              The map will activate when a linked driver enters HIGH_RISK and
              starts sending live location updates.
            </Text>
          </View>
        )}

        <View className="absolute left-0 right-0 top-0 px-5 pt-3">
          <Card className="border-0 bg-slate-950/88">
            <CardContent className="p-4">
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1">
                  <Text className="text-xs font-bold uppercase tracking-[2px] text-emerald-300">
                    Guardian tracking
                  </Text>
                  <Text className="mt-2 text-2xl font-bold text-white">
                    {selectedDriver?.name ?? "Live driver location"}
                  </Text>
                  <Text className="mt-2 text-sm leading-6 text-slate-300">
                    {selectedLocation
                      ? `Realtime updates arrive from Supabase as the driver location changes. Last update ${new Date(selectedLocation.updatedAt).toLocaleTimeString()}.`
                      : "No active HIGH_RISK location feed is available right now."}
                  </Text>
                </View>
                <Badge variant={status.variant}>{status.label}</Badge>
              </View>
            </CardContent>
          </Card>
        </View>

        <View className="absolute bottom-0 left-0 right-0 px-5 pb-5">
          <View className="gap-3">
            {liveLocationQuery.error ? (
              <Card className="border border-red-300 bg-red-50">
                <CardContent className="p-4">
                  <Text className="font-semibold text-red-700">
                    Unable to load live location.
                  </Text>
                  <Text className="mt-1 text-sm leading-6 text-red-600">
                    {liveLocationQuery.error instanceof Error
                      ? liveLocationQuery.error.message
                      : "Please try refreshing the screen."}
                  </Text>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-0 bg-slate-950/88">
              <CardContent className="p-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-xs font-bold uppercase tracking-[2px] text-slate-400">
                      Coordinates
                    </Text>
                    <Text className="mt-2 font-mono text-base text-white">
                      {formatCoordinate(selectedLocation?.lat)}
                    </Text>
                    <Text className="mt-1 font-mono text-base text-white">
                      {formatCoordinate(selectedLocation?.lng)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <View className="mb-2 h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                      <ShieldAlert size={22} color="#34d399" />
                    </View>
                    <Text className="text-xs font-semibold uppercase tracking-[2px] text-slate-400">
                      Route
                    </Text>
                    <Text className="mt-1 text-sm font-semibold text-white">
                      {selectedDriver?.routeName ?? "Unknown route"}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
