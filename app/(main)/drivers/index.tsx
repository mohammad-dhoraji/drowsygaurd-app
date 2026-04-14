import React, { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import {
  ActivitySquare,
  AlertTriangle,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-react-native";

import { Header } from "@/components/layout/Header";
import { ScreenWrapper } from "@/components/layout/ScreenWrapper";
import { Badge } from "@/components/ui/Badge";
import { API_CONFIGURED, startDrivingSession } from "@/services/apiService";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { useLiveLocationTracking } from "@/hooks/useLiveLocationTracking";
import { useDriverStore } from "@/state/stores/driverStore";
import {
  DEFAULT_DETECTION_SNAPSHOT,
  type DetectionSnapshot,
} from "@/types/detection";
import { getDrowsinessLevelFromEAR } from "@/utils/drowsinessLogic";
import CameraFeed from "@/components/CameraFeed";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

function statusToBadge(status: DetectionSnapshot["status"]) {
  if (
    status === "alert" ||
    status === "error" ||
    status === "permission-denied"
  )
    return "danger";
  if (status === "unsupported") return "warning";
  return "safe";
}

function resolveStatusLabel(snapshot: DetectionSnapshot) {
  if (snapshot.status === "alert")
    return snapshot.severity ? `${snapshot.severity} alert` : "Alert";
  if (snapshot.status === "unsupported") return "Preview only";
  if (snapshot.status === "permission-denied") return "Permission blocked";
  if (snapshot.status === "error") return "Detection error";
  if (snapshot.hasFace) return "Eyes tracked";
  return "Searching";
}

function formatEar(value: number | null) {
  return typeof value === "number" ? value.toFixed(3) : "--";
}

function formatDuration(durationMs: number) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

export default function DriversScreen() {
  const { session, user } = useAuth();
  const { data: profile, isLoading: isProfileLoading } =
    useCurrentUserProfile();
  
  // Local state management for session
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  
  const [snapshot, setSnapshot] = useState<DetectionSnapshot>(
    DEFAULT_DETECTION_SNAPSHOT,
  );
  const { setDrowsinessLevel, setStatus } = useDriverStore();
  const isHighRisk =
    snapshot.status === "alert" && snapshot.severity === "HIGH";
  const locationTracking = useLiveLocationTracking(isHighRisk);

  const drowsinessLevel = useMemo(
    () => getDrowsinessLevelFromEAR(snapshot.ear, snapshot.earThreshold),
    [snapshot.ear, snapshot.earThreshold],
  );
  const safetyScore = snapshot.isFaceMissing ? 0 : Math.max(0, 100 - drowsinessLevel);
  const locationTrackingBadge =
    locationTracking.error || (isHighRisk && !locationTracking.isTracking)
      ? "warning"
      : locationTracking.isTracking
        ? "danger"
        : "safe";
  const locationTrackingLabel = locationTracking.isTracking
    ? "Live tracking active"
    : isHighRisk
      ? "Waiting for permission"
      : "Standby";
  const locationTrackingDetail = locationTracking.error
    ? locationTracking.error
    : locationTracking.isTracking
      ? `Sending balanced-accuracy updates every 4 seconds${locationTracking.lastSentAt ? `, last sent at ${new Date(locationTracking.lastSentAt).toLocaleTimeString()}.` : "."}`
      : "Location tracking stays off until the detection state reaches HIGH risk.";

  useEffect(() => {
    setDrowsinessLevel(drowsinessLevel);
    setStatus(
      snapshot.status === "alert"
        ? "drowsy"
        : snapshot.status === "ready" || snapshot.status === "unsupported"
          ? "active"
          : "inactive",
    );
  }, [drowsinessLevel, setDrowsinessLevel, setStatus, snapshot.status]);

  if (isProfileLoading) {
    return (
      <ScreenWrapper>
        <Header
          title="Driver Monitor"
          subtitle="Loading account access..."
          logo={true}
        />
        <Card>
          <CardContent className="p-4">
            <Text className="text-gray-600 dark:text-gray-300">
              Checking driver access...
            </Text>
          </CardContent>
        </Card>
      </ScreenWrapper>
    );
  }

  if (profile?.role === "guardian") {
    return (
      <ScreenWrapper>
        <Header
          title="Driver Monitor"
          subtitle="Driver-only monitoring tools"
          logo={true}
        />
        <Card className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <Text className="text-amber-800 dark:text-amber-300 font-semibold">
              This screen is available to driver accounts only.
            </Text>
            <Text className="text-amber-700 dark:text-amber-400 text-sm mt-1">
              Sign in as a driver to use on-device drowsiness detection and
              event logging.
            </Text>
          </CardContent>
        </Card>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper scroll>
      <Header
        title="Driver Monitor"
        subtitle="Manual session control for on-device drowsiness detection"
        logo={true}
      />

      {!API_CONFIGURED ? (
        <Card className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <Text className="font-semibold text-amber-800 dark:text-amber-300">
              Backend sync is not configured.
            </Text>
            <Text className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              Add `EXPO_PUBLIC_API_URL` in the app env to send drowsiness events
              to FastAPI.
            </Text>
          </CardContent>
        </Card>
      ) : null}

      {snapshot.status === "alert" || snapshot.isFaceMissing ? (
        <View className="bg-red-100 dark:bg-red-900/30 p-4 rounded-2xl flex-row items-center mb-6 border border-red-200 dark:border-red-800/50">
          <AlertTriangle color="#ef4444" size={24} className="mr-3" />
          <View className="flex-1">
            <Text className="text-red-800 dark:text-red-300 font-bold text-base">
              {snapshot.isFaceMissing ? 'Driver Not Visible' : 'Drowsiness Warning'}
            </Text>
            <Text className="text-red-600 dark:text-red-400 text-xs mt-0.5">
              {snapshot.isFaceMissing 
                ? `No face detected for ${(snapshot.noFaceDurationMs / 1000).toFixed(1)}s. Please align camera.`
                : 'Local alert fired after the eyes stayed below the EAR threshold for more than 2 seconds.'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Session Control */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <Text
            className={`text-2xl font-bold mb-2 ${
              isSessionActive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {isSessionActive ? "Session Active" : "Session Inactive"}
          </Text>
          <Text className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            {isSessionActive
              ? "Real-time face tracking and drowsiness detection is running."
              : "Tap Start Session to begin monitoring. Camera access and processing will activate."}
          </Text>
          {!isSessionActive ? (
            <Button
              title={isCreatingSession ? "Starting Session..." : "Start Session"}
              onPress={async () => {
                if (!API_CONFIGURED) {
                  setSessionError("Backend API is not configured");
                  return;
                }
                
                setIsCreatingSession(true);
                setSessionError(null);
                
                try {
                  const result = await startDrivingSession();
                  
                  if (result.error) {
                    setSessionError(result.error.message);
                    setIsCreatingSession(false);
                    return;
                  }
                  
                  if (result.data?.session_id) {
                    setSessionId(result.data.session_id);
                    setIsSessionActive(true);
                    setIsCreatingSession(false);
                  } else {
                    setSessionError("No session ID returned from server");
                    setIsCreatingSession(false);
                  }
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Unknown error";
                  setSessionError(message);
                  setIsCreatingSession(false);
                }
              }}
              disabled={isCreatingSession}
              className="bg-emerald-500 hover:bg-emerald-600 w-full mb-3 text-white"
            >
              <ActivitySquare size={20} className="mr-2" />
            </Button>
          ) : (
            <Button
              title="End Session"
              onPress={() => {
                setIsSessionActive(false);
                setSessionId(null);
                setSnapshot(DEFAULT_DETECTION_SNAPSHOT);
                setSessionError(null);
              }}
              className="bg-red-500 hover:bg-red-600 w-full text-white"
            >
              <ShieldAlert size={20} className="mr-2" />
            </Button>
          )}
          
          {sessionError && (
            <View className="mt-3 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800/50">
              <Text className="text-red-700 dark:text-red-300 text-sm">
                {sessionError}
              </Text>
            </View>
          )}
        </CardContent>
      </Card>

      {isSessionActive ? (
        <>
          <CameraFeed
            accessToken={session?.access_token ?? null}
            onSnapshotChange={setSnapshot}
            sessionId={sessionId}
          />

          <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3 mt-6">
            Live Telemetry
          </Text>
        </>
      ) : (
        <Card className="h-96 items-center justify-center rounded-[32px] mb-6">
          <CardContent className="p-8 text-center">
            <ShieldAlert size={48} className="mx-auto mb-4 text-gray-400" />
            <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Monitoring Paused
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              Start a session above to activate the camera preview and real-time
              drowsiness detection.
            </Text>
          </CardContent>
        </Card>
      )}
      <Card className="mb-6">
        <CardContent className="p-0">
          <View className="p-4 flex-row items-center border-b border-gray-100 dark:border-gray-800">
            <View className="w-10 h-10 rounded-full bg-primary/10 dark:bg-[#064e3b]/30 items-center justify-center mr-4">
              <ShieldAlert size={20} color="#064e3b" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 dark:text-gray-400 text-xs mb-0.5">
                Detection Status
              </Text>
              <Text className="text-gray-900 dark:text-white font-bold text-base">
                {resolveStatusLabel(snapshot)}
              </Text>
            </View>
            <Badge variant={statusToBadge(snapshot.status)}>
              {snapshot.status === "alert"
                ? (snapshot.severity ?? "ALERT")
                : snapshot.status.toUpperCase()}
            </Badge>
          </View>

          <View className="p-4 flex-row items-center border-b border-gray-100 dark:border-gray-800">
            <View className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mr-4">
              <ActivitySquare size={20} color="#3b82f6" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 dark:text-gray-400 text-xs mb-0.5">
                EAR (Eye Aspect Ratio)
              </Text>
              <Text className="text-gray-900 dark:text-white font-bold text-base font-mono">
                {formatEar(snapshot.ear)}
              </Text>
            </View>
            <Text className="text-gray-400 text-xs text-right">
              Threshold: {snapshot.earThreshold.toFixed(2)}
            </Text>
          </View>

          <View className="p-4 flex-row items-center border-b border-gray-100 dark:border-gray-800">
            <View className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/30 items-center justify-center mr-4">
              <ShieldAlert size={20} color="#3b82f6" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 dark:text-gray-400 text-xs mb-0.5">
                Face Status
              </Text>
              <Text className={`font-bold text-base ${snapshot.isFaceMissing ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {snapshot.isFaceMissing ? `❌ Missing (${formatDuration(snapshot.noFaceDurationMs)})` : '✅ Detected'}
              </Text>
            </View>
            <Badge variant={snapshot.isFaceMissing ? 'destructive' : 'default'}>
              {snapshot.isFaceMissing ? 'DANGER' : 'OK'}
            </Badge>
          </View>

          <View className="p-4 flex-row items-center border-b border-gray-100 dark:border-gray-800">
            <View className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center mr-4">
              {API_CONFIGURED ? (
                <Wifi size={20} color="#d97706" />
              ) : (
                <WifiOff size={20} color="#d97706" />
              )}
            </View>
          </View>

          <View className="p-4 flex-row items-center border-b border-gray-100 dark:border-gray-800">
            <View className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center mr-4">
              {API_CONFIGURED ? (
                <Wifi size={20} color="#d97706" />
              ) : (
                <WifiOff size={20} color="#d97706" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 dark:text-gray-400 text-xs mb-0.5">
                Backend Sync
              </Text>
              <Text className="text-gray-900 dark:text-white font-bold text-base">
                {snapshot.backendStatus === "sent"
                  ? "Event logged"
                  : snapshot.backendStatus === "error"
                    ? "Sync failed"
                    : snapshot.backendStatus === "disabled"
                      ? "Disabled"
                      : "Waiting"}
              </Text>
            </View>
            <Text className="text-gray-400 text-xs text-right">
              {snapshot.drowsyEvents} alerts
            </Text>
          </View>

          <View className="p-4 flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 items-center justify-center mr-4">
              <ShieldAlert size={20} color="#10b981" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 dark:text-gray-400 text-xs mb-0.5">
                Safety Score
              </Text>
              <Text className="text-gray-900 dark:text-white font-bold text-base">
                {safetyScore}/100
              </Text>
            </View>
            <Text className="text-gray-400 text-xs text-right">
              Eyes closed: {formatDuration(snapshot.closureDurationMs)}
            </Text>
          </View>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="p-4 flex-row items-center">
          <View className="flex-1 pr-4">
            <Text className="text-gray-900 dark:text-white font-bold text-base">
              Guardian live location
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mt-1 text-sm leading-6">
              {locationTrackingDetail}
            </Text>
            {locationTracking.permissionStatus ? (
              <Text className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Permission: {locationTracking.permissionStatus}
              </Text>
            ) : null}
          </View>
          <Badge variant={locationTrackingBadge}>{locationTrackingLabel}</Badge>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="p-4">
          <Text className="text-gray-900 dark:text-white font-bold text-base">
            Current session
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 mt-1 text-sm leading-6">
            {isCreatingSession
              ? "Creating session..."
              : isSessionActive && sessionId
                ? `Session active (${sessionId.slice(0, 8)}...). Guardian notifications enabled for repeated events.`
                : "No session active. Click 'Start Session' to begin monitoring."}
          </Text>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <Text className="text-gray-900 dark:text-white font-bold text-base">
            Privacy-first flow
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 mt-1 text-sm leading-6">
            Camera frames stay on the device. The app only posts EAR, duration,
            severity, timestamp, and session metadata to the backend.
          </Text>
          {snapshot.backendMessage ? (
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              {snapshot.backendMessage}
            </Text>
          ) : null}
        </CardContent>
      </Card>
    </ScreenWrapper>
  );
}
