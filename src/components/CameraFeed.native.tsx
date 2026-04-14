import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Audio } from 'expo-av';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import { useQueryClient } from '@tanstack/react-query';

import { DetectionOverlay } from '@/components/DetectionOverlay';
import { API_CONFIGURED, createDriverEvent } from '@/services/apiService';
import { processFaceFrame } from '@/services/realTimeDetection';
import { DEFAULT_DETECTION_SNAPSHOT, type CameraFeedProps, type DetectionSnapshot } from '@/types/detection';
import { DEFAULT_EAR_THRESHOLD, INITIAL_DROWSINESS_STATE, DrowsinessState } from '@/utils/drowsinessLogic';

const ALERT_SOUND_SOURCE = require('../../assets/alert.wav');

export default function CameraFeed({ onSnapshotChange, sessionId }: CameraFeedProps) {
  const queryClient = useQueryClient();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const [cameraReady, setCameraReady] = useState(false);
  
  const [snapshot, setSnapshot] = useState<DetectionSnapshot>({
    ...DEFAULT_DETECTION_SNAPSHOT,
    mode: 'native-preview',
    earThreshold: DEFAULT_EAR_THRESHOLD,
    backendStatus: API_CONFIGURED ? 'idle' : 'disabled',
    backendMessage: API_CONFIGURED
      ? 'Only event metadata is sent to the backend.'
      : 'Set EXPO_PUBLIC_API_URL to sync alerts to FastAPI.',
  });

  const currentStateRef = useRef<DrowsinessState>(INITIAL_DROWSINESS_STATE);
  const snapshotRef = useRef<DetectionSnapshot>(snapshot);
  const soundRef = useRef<Audio.Sound | null>(null);
  const alertActiveRef = useRef(false);
  const syncingRef = useRef(false);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    onSnapshotChange?.(snapshot);
  }, [onSnapshotChange, snapshot]);

  // =========================================================================
  // Backend event sync — mirrors CameraFeed.web.tsx syncEvent logic
  // =========================================================================
  const syncEvent = useCallback(
    async ({
      ear,
      durationMs,
      severity,
      eventType,
    }: {
      ear: number;
      durationMs: number;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
      eventType?: 'EYES_CLOSED' | 'NO_FACE';
    }) => {
      if (!API_CONFIGURED) {
        setSnapshot((prev) => ({
          ...prev,
          backendStatus: 'disabled',
          backendMessage:
            'Detection is local only because EXPO_PUBLIC_API_URL is missing.',
          lastEventAt: new Date().toISOString(),
        }));
        return;
      }

      // Prevent concurrent syncs
      if (syncingRef.current) return;
      syncingRef.current = true;

      try {
        const result = await createDriverEvent({
          ear_value: ear,
          duration_seconds: Number((durationMs / 1000).toFixed(2)),
          severity,
          event_type: eventType,
          session_id: sessionId ?? undefined,
        });

        if (result.error) {
          throw new Error(result.error.message);
        }

        // Invalidate React Query caches so Home and Logs pages update
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['driver-events'] }),
          queryClient.invalidateQueries({ queryKey: ['driver-summary'] }),
          queryClient.invalidateQueries({ queryKey: ['driver-sessions'] }),
        ]);

        setSnapshot((prev) => ({
          ...prev,
          backendStatus: 'sent',
          backendMessage:
            'Alert metadata sent to the backend. No camera frames were uploaded.',
          lastEventAt: new Date().toISOString(),
        }));
      } catch (error) {
        setSnapshot((prev) => ({
          ...prev,
          backendStatus: 'error',
          backendMessage:
            error instanceof Error
              ? error.message
              : 'Failed to sync alert to the backend.',
          lastEventAt: new Date().toISOString(),
        }));
      } finally {
        syncingRef.current = false;
      }
    },
    [queryClient, sessionId],
  );

  useEffect(() => {
    let mounted = true;

    const setupSound = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          ALERT_SOUND_SOURCE,
          { shouldPlay: false, isLooping: true, volume: 1 },
        );

        if (!mounted) {
          await sound.unloadAsync();
          return;
        }

        soundRef.current = sound;
      } catch {
        // Detection should keep running even if audio setup fails.
      }
    };

    void setupSound();

    return () => {
      mounted = false;

      if (soundRef.current) {
        void soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      alertActiveRef.current = false;
    };
  }, []);

  const handleFaceDetection = Worklets.createRunOnJS((faceObj: any | null) => {
    const { snapshot: newSnapshot, nextState, shouldTrigger } = processFaceFrame(
      faceObj, 
      currentStateRef.current, 
      snapshotRef.current
    );
    
    currentStateRef.current = nextState;
    const alertVisible =
      newSnapshot.isFaceMissing ||
      (newSnapshot.eyesClosed && newSnapshot.severity !== null);
    const status = alertVisible ? 'alert' : 'ready';

    if (alertVisible) {
      if (soundRef.current && !alertActiveRef.current) {
        void soundRef.current.replayAsync();
        alertActiveRef.current = true;
      }
    } else if (alertActiveRef.current) {
      if (soundRef.current) {
        void soundRef.current.stopAsync();
      }
      alertActiveRef.current = false;
    }
    
    setSnapshot({ ...newSnapshot, status });

    // =====================================================================
    // Backend sync: send event when drowsiness is confirmed
    // =====================================================================
    if (shouldTrigger && newSnapshot.severity) {
      void syncEvent({
        ear: newSnapshot.ear ?? 0,
        durationMs:
          newSnapshot.eventType === 'NO_FACE'
            ? newSnapshot.noFaceDurationMs
            : newSnapshot.closureDurationMs,
        severity: newSnapshot.severity,
        eventType: newSnapshot.eventType,
      });
    }
  });

  const { detectFaces } = useFaceDetector({
    performanceMode: 'fast',
    classificationMode: 'all',
    landmarkMode: 'none',
    contourMode: 'none',
    minFaceSize: 0.3,
  });

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    const faces = detectFaces(frame);
    if (faces && faces.length > 0) {
      handleFaceDetection(faces[0]);
    } else {
      handleFaceDetection(null);
    }
  }, [handleFaceDetection]);

  if (!hasPermission) {
    return (
      <View className="h-96 w-full items-center justify-center rounded-[32px] bg-gray-950 px-6">
        <Text className="text-center text-base font-semibold text-white">Camera access is required</Text>
        <Text className="mt-2 text-center text-sm leading-6 text-gray-300">
          Enable the front camera so the app can monitor you for drowsiness.
        </Text>
        <TouchableOpacity
          className="mt-5 rounded-full bg-primary px-5 py-3"
          onPress={() => {
            void requestPermission();
          }}>
          <Text className="font-semibold text-white">Grant camera access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (device == null) {
    return (
      <View className="h-96 w-full items-center justify-center rounded-[32px] bg-gray-950 px-6">
        <ActivityIndicator color="#10b981" />
        <Text className="mt-3 text-sm text-gray-300">No camera device found...</Text>
      </View>
    );
  }

  return (
    <View className="h-96 w-full overflow-hidden rounded-[32px] bg-gray-950">
      <Camera
        style={{ flex: 1 }}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
        onInitialized={() => {
          setCameraReady(true);
        }}
      />
      <DetectionOverlay
        snapshot={{
          ...snapshot,
          statusMessage:
            !cameraReady && snapshot.statusMessage === 'Preparing camera...'
              ? 'Initializing camera...'
              : snapshot.statusMessage,
        }}
      />
    </View>
  );
}
