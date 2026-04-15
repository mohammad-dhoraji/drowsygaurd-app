import React, {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Text, View } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

import { DetectionOverlay } from '@/components/DetectionOverlay';
import { useDrowsinessDetector } from '@/hooks/useDrowsinessDetector';
import { API_CONFIGURED, createDriverEvent } from '@/services/apiService';
import {
  detectFaceFromVideo,
  initializeMediaPipe,
} from '@/services/mediapipeService';
import {
  DEFAULT_DETECTION_SNAPSHOT,
  type CameraFeedProps,
  type DetectionSnapshot,
} from '@/types/detection';
import { isLikelyMobileBrowser } from '@/utils/detectionStability';
import {
  DEFAULT_CLOSED_EYE_DURATION_MS,
  DEFAULT_EAR_THRESHOLD,
  DEFAULT_PROCESS_INTERVAL_MS,
  type DrowsinessReason,
  type EyeState,
} from '@/utils/drowsinessLogic';

const ALERT_SOUND_SOURCE = require('../../assets/alert.wav');

const mirroredVideoStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  transform: 'scaleX(-1)',
};

function getPreferredVideoConstraints(): MediaTrackConstraints {
  return {
    facingMode: { ideal: 'user' },
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 24, max: 30 },
    aspectRatio: { ideal: 16 / 9 },
  };
}

function logDetectionFrame({
  eyeState,
  reason,
  ear,
  rawEar,
  smoothedEar,
  lastValidEAR,
  missingFrameCount,
  threshold,
  faceConfidence,
  closedFrames,
}: {
  eyeState: EyeState;
  reason: DrowsinessReason;
  ear: number | null;
  rawEar: number | null;
  smoothedEar: number | null;
  lastValidEAR: number | null;
  missingFrameCount: number;
  threshold: number;
  faceConfidence: number;
  closedFrames: number;
}) {
  if (!__DEV__) {
    return;
  }

  // console.debug('[DrowsinessDetection]', {
  //   eyeState,
  //   reason,
  //   effectiveEAR: ear,
  //   rawEAR: rawEar,
  //   smoothedEAR: smoothedEar,
  //   threshold,
  //   lastValidEAR,
  //   missingFrameCount,
  //   closedFrames,
  //   faceConfidence,
  // });
}

function buildStatusMessage({
  hasFace,
  landmarksStable,
  faceConfidence,
  eyesClosed,
  closureDurationMs,
  reason,
}: {
  hasFace: boolean;
  landmarksStable: boolean;
  faceConfidence: number;
  eyesClosed: boolean;
  closureDurationMs: number;
  reason: DrowsinessReason;
}) {
  if (!hasFace) {
    return reason === 'tracking_gap_held'
      ? 'Face briefly dropped. Holding the last closed-eye state while tracking recovers.'
      : 'Face not detected. Keep your head centered and well lit.';
  }

  if (!landmarksStable) {
    return reason === 'tracking_gap_held'
      ? 'Eye landmarks briefly dropped. Holding the last closed-eye state for continuity.'
      : 'Eye landmarks are unstable. Keep lighting even and hold your head steady.';
  }

  if (faceConfidence < 0.45) {
    return eyesClosed
      ? 'Face quality dipped, but closed-eye tracking is still active.'
      : 'Face quality is low. Detection is still running, but centering will improve stability.';
  }

  if (eyesClosed) {
    return `Eyes closed for ${(closureDurationMs / 1000).toFixed(1)}s. Alert threshold is ${(DEFAULT_CLOSED_EYE_DURATION_MS / 1000).toFixed(1)}s.`;
  }

  return 'Face tracked. Monitoring for sustained eye closure.';
}

export default function CameraFeed({
  onSnapshotChange,
  sessionId,
}: CameraFeedProps) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRequestRef = useRef<number | null>(null);
  const lastProcessedRef = useRef(0);
  const processingRef = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const alertActiveRef = useRef(false);
  const isMobileBrowserRef = useRef(isLikelyMobileBrowser());
  const { processFrame, resetDetector } = useDrowsinessDetector();

  const [snapshot, setSnapshot] = useState<DetectionSnapshot>({
    ...DEFAULT_DETECTION_SNAPSHOT,
    mode: 'web-live',
    earThreshold: DEFAULT_EAR_THRESHOLD,
    status: 'initializing',
    statusMessage: 'Starting browser camera and loading MediaPipe.',
    backendStatus: API_CONFIGURED ? 'idle' : 'disabled',
    backendMessage: API_CONFIGURED
      ? 'Only event metadata is sent to the backend.'
      : 'Set EXPO_PUBLIC_API_URL to sync alerts to FastAPI.',
  });

  useEffect(() => {
    onSnapshotChange?.(snapshot);
  }, [onSnapshotChange, snapshot]);

  const updateSnapshot = useCallback((patch: Partial<DetectionSnapshot>) => {
    startTransition(() => {
      setSnapshot((current) => ({
        ...current,
        ...patch,
      }));
    });
  }, []);

  const playAlert = useCallback(async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Haptics should never block the alert path.
    }

    try {
      if (soundRef.current && !alertActiveRef.current) {
        await soundRef.current.playAsync();
        await soundRef.current.setIsLoopingAsync(true);
        alertActiveRef.current = true;
      }
    } catch {
      // Audio playback should not block event creation.
    }
  }, []);

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
        console.warn('⚠️ API_CONFIGURED is false - backend sync disabled');
        updateSnapshot({
          backendStatus: 'disabled',
          backendMessage:
            'Detection is local only because EXPO_PUBLIC_API_URL is missing.',
          lastEventAt: new Date().toISOString(),
        });
        return;
      }

      try {
        // Validate payload
        if (!severity || !['LOW', 'MEDIUM', 'HIGH'].includes(severity)) {
          throw new Error(`Invalid severity: ${severity}`);
        }
        if (durationMs < 0) {
          throw new Error(`Invalid duration: ${durationMs}ms`);
        }
        if (isNaN(ear) || !isFinite(ear)) {
          throw new Error(`Invalid EAR value: ${ear}`);
        }

        const payload = {
          ear_value: ear,
          duration_seconds: Number((durationMs / 1000).toFixed(2)),
          severity,
          event_type: eventType,
          session_id: sessionId ?? undefined,
        };

        console.log('📤 SYNC_EVENT_PAYLOAD:', payload);

        const result = await createDriverEvent(payload);

        console.log('📡 SYNC_EVENT_RESPONSE:', result);

        if (result.error) {
          throw new Error(result.error.message);
        }

        console.log('✅ EVENT_SYNCED_SUCCESS: ID', result.data?.id);

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['driver-events'] }),
          queryClient.invalidateQueries({ queryKey: ['driver-summary'] }),
          queryClient.invalidateQueries({ queryKey: ['driver-sessions'] }),
        ]);

        updateSnapshot({
          backendStatus: 'sent',
          backendMessage:
            'Alert metadata sent to the backend. No camera frames were uploaded.',
          lastEventAt: new Date().toISOString(),
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to sync alert to the backend.';
        console.error('❌ SYNC_EVENT_ERROR:', errorMessage, error);
        updateSnapshot({
          backendStatus: 'error',
          backendMessage: errorMessage,
          lastEventAt: new Date().toISOString(),
        });
      }
    },
    [queryClient, sessionId, updateSnapshot],
  );

  useEffect(() => {
    let active = true;

    const setup = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          ALERT_SOUND_SOURCE,
          { shouldPlay: false, volume: 1 },
        );

        if (!active) {
          await sound.unloadAsync();
          return;
        }

        soundRef.current = sound;
      } catch {
        // Sound is optional compared to detection and backend sync.
      }

      try {
        resetDetector();
        lastProcessedRef.current = 0;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: getPreferredVideoConstraints(),
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const [videoTrack] = stream.getVideoTracks();

        if (videoTrack?.applyConstraints) {
          try {
            await videoTrack.applyConstraints(getPreferredVideoConstraints());
          } catch {
            // Some mobile browsers only partially honor constraints.
          }
        }

        if (__DEV__) {
          console.debug('[DrowsinessDetection]', {
            cameraSettings: videoTrack?.getSettings?.() ?? null,
            isMobileBrowser: isMobileBrowserRef.current,
          });
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          throw new Error('Camera video element is not available.');
        }

        video.srcObject = stream;
        await video.play();

        updateSnapshot({
          status: 'initializing',
          statusMessage: 'Camera is live. Loading MediaPipe face landmarks.',
        });

        await initializeMediaPipe();

        if (!active) {
          return;
        }

        updateSnapshot({
          status: 'ready',
          statusMessage:
            'Live face tracking is ready. Monitoring for sustained eye closure.',
        });

        const step = async (timestamp: number) => {
          frameRequestRef.current = window.requestAnimationFrame(
            (nextTimestamp) => {
              void step(nextTimestamp);
            },
          );

          if (
            processingRef.current ||
            timestamp - lastProcessedRef.current < DEFAULT_PROCESS_INTERVAL_MS
          ) {
            return;
          }

          const currentVideo = videoRef.current;
          if (
            !currentVideo ||
            currentVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
          ) {
            return;
          }

          processingRef.current = true;

          try {
            const detection = await detectFaceFromVideo(currentVideo, timestamp);
            const frameDelta =
              lastProcessedRef.current > 0
                ? timestamp - lastProcessedRef.current
                : DEFAULT_PROCESS_INTERVAL_MS;
            const fps =
              frameDelta > 0
                ? 1000 / frameDelta
                : 1000 / DEFAULT_PROCESS_INTERVAL_MS;

            const hasValidDetection = !!detection && detection.averageEar !== null;
            const evaluation = processFrame({
              ear: detection?.averageEar ?? null,
              now: timestamp,
              threshold: DEFAULT_EAR_THRESHOLD,
              hasValidDetection,
            });

            lastProcessedRef.current = timestamp;

            const hasFace = Boolean(detection);
            const landmarksStable = Boolean(
              detection &&
                detection.averageEar !== null &&
                detection.leftEar !== null &&
                detection.rightEar !== null,
            );
            const faceConfidence = detection?.faceConfidence ?? 0;
            const severity = evaluation.severity;
            const status =
              evaluation.shouldTrigger ||
              (evaluation.eyesClosed && severity !== null)
                ? 'alert'
                : 'ready';

            logDetectionFrame({
              eyeState: evaluation.eyeState,
              reason: evaluation.reason,
              ear: evaluation.effectiveEar,
              rawEar: evaluation.rawEar,
              smoothedEar: evaluation.smoothedEar,
              lastValidEAR: evaluation.state.lastValidEAR,
              missingFrameCount: evaluation.state.missingFrameCount,
              threshold: evaluation.threshold,
              faceConfidence,
              closedFrames: evaluation.closedFrameCount,
            });

            updateSnapshot({
              status,
              hasFace,
              isFaceMissing: evaluation.isFaceMissing,
              noFaceDurationMs: evaluation.noFaceDurationMs,
              ear: evaluation.effectiveEar,
              leftEar: detection?.leftEar ?? null,
              rightEar: detection?.rightEar ?? null,
              earThreshold: evaluation.threshold,
              eyesClosed: evaluation.eyesClosed,
              closureDurationMs: evaluation.closureDurationMs,
              severity,
              fps,
              drowsyEvents: evaluation.state.drowsyEvents,
              lastProcessedAt: timestamp,
              statusMessage: buildStatusMessage({
                hasFace,
                landmarksStable,
                faceConfidence,
                eyesClosed: evaluation.eyesClosed,
                closureDurationMs: evaluation.closureDurationMs,
                reason: evaluation.reason,
              }),
            });

            // Continuous alarm while drowsy state active
            if (evaluation.eyesClosed || evaluation.isFaceMissing) {
              if (!alertActiveRef.current) {
                await playAlert();
              }
            } else if (alertActiveRef.current) {
              // Clear alert when state recovers
              try {
                if (soundRef.current) {
                  await soundRef.current.stopAsync();
                  await soundRef.current.setIsLoopingAsync(false);
                }
                alertActiveRef.current = false;
              } catch {
                // Ignore audio stop errors
              }
            }

            if (severity) {
              console.log('Drowsiness alert triggered:', evaluation.eventType, evaluation.closureDurationMs || evaluation.noFaceDurationMs, 'ms');
              await syncEvent({
                ear: evaluation.effectiveEar ?? 0,
                durationMs: evaluation.eventType === 'NO_FACE' ? evaluation.noFaceDurationMs : evaluation.closureDurationMs,
                severity,
                eventType: evaluation.eventType,
              });
            }
          } catch (error) {
            updateSnapshot({
              status: 'error',
              statusMessage:
                error instanceof Error
                  ? error.message
                  : 'MediaPipe failed while processing the current frame.',
            });
          } finally {
            processingRef.current = false;
          }
        };

        frameRequestRef.current = window.requestAnimationFrame((timestamp) => {
          void step(timestamp);
        });
      } catch (error) {
        const blocked =
          error instanceof DOMException && error.name === 'NotAllowedError';
        updateSnapshot({
          status: blocked ? 'permission-denied' : 'error',
          statusMessage: blocked
            ? 'Browser camera access was denied. Allow the front camera to start detection.'
            : error instanceof Error
              ? error.message
              : 'Unable to start the browser camera.',
        });
      }
    };

    void setup();

    return () => {
      active = false;
      resetDetector();

      if (frameRequestRef.current !== null) {
        window.cancelAnimationFrame(frameRequestRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());

      if (soundRef.current) {
        void soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      alertActiveRef.current = false;
    };
  }, [playAlert, processFrame, resetDetector, syncEvent, updateSnapshot]);

  return (
    <View className="h-96 w-full overflow-hidden rounded-[32px] bg-gray-950">
      <video
        autoPlay
        muted
        playsInline
        ref={videoRef}
        style={mirroredVideoStyle}
      />
      <DetectionOverlay snapshot={snapshot} />

      {snapshot.status === 'initializing' ? (
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <ActivityIndicator color="#10b981" />
          <Text className="mt-3 text-sm text-white">
            Booting real-time detection...
          </Text>
        </View>
      ) : null}
    </View>
  );
}
