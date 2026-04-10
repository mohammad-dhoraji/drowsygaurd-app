import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Audio } from 'expo-av';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';

import { DetectionOverlay } from '@/components/DetectionOverlay';
import { processFaceFrame } from '@/services/realTimeDetection';
import { DEFAULT_DETECTION_SNAPSHOT, type CameraFeedProps, type DetectionSnapshot } from '@/types/detection';
import { DEFAULT_EAR_THRESHOLD, INITIAL_DROWSINESS_STATE, DrowsinessState } from '@/utils/drowsinessLogic';

const ALERT_SOUND_SOURCE = require('../../assets/alert.wav');

export default function CameraFeed({ onSnapshotChange }: CameraFeedProps) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const [cameraReady, setCameraReady] = useState(false);
  
  const [snapshot, setSnapshot] = useState<DetectionSnapshot>({
    ...DEFAULT_DETECTION_SNAPSHOT,
    mode: 'native-preview',
    earThreshold: DEFAULT_EAR_THRESHOLD,
    backendStatus: 'disabled',
  });

  const currentStateRef = useRef<DrowsinessState>(INITIAL_DROWSINESS_STATE);
  const snapshotRef = useRef<DetectionSnapshot>(snapshot);
  const soundRef = useRef<Audio.Sound | null>(null);
  const alertActiveRef = useRef(false);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    onSnapshotChange?.(snapshot);
  }, [onSnapshotChange, snapshot]);

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
    const { snapshot: newSnapshot, nextState } = processFaceFrame(
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
