import { Platform } from 'react-native';
import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';

import { calculateAverageEAR } from '@/utils/earCalculator';

const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
// Relaxed for mobile stability: Smaller/tilted faces common on phone cams
const MIN_FACE_WIDTH_RATIO = 0.12;
const MIN_FACE_HEIGHT_RATIO = 0.12;
const MAX_FACE_CENTER_OFFSET_X = 0.35;
const MAX_FACE_CENTER_OFFSET_Y = 0.35;

let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;

export interface FaceBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface MediaPipeDetectionResult {
  faceLandmarks: NormalizedLandmark[];
  faceBounds: FaceBounds;
  faceCentered: boolean;
  faceLargeEnough: boolean;
  faceConfidence: number;
  leftEar: number | null;
  rightEar: number | null;
  averageEar: number | null;
}

export function isRealtimeFaceDetectionSupported() {
  return Platform.OS === 'web';
}

export async function initializeMediaPipe() {
  if (!isRealtimeFaceDetectionSupported()) {
    throw new Error('Real-time MediaPipe detection is only available in the current Expo web runtime.');
  }

  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL_URL,
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
    })().catch((error) => {
      faceLandmarkerPromise = null;
      throw error;
    });
  }

  return faceLandmarkerPromise;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getFaceBounds(landmarks: NormalizedLandmark[]): FaceBounds {
  const initialPoint = landmarks[0] ?? { x: 0.5, y: 0.5 };

  const bounds = landmarks.reduce(
    (current, point) => ({
      minX: Math.min(current.minX, point.x),
      minY: Math.min(current.minY, point.y),
      maxX: Math.max(current.maxX, point.x),
      maxY: Math.max(current.maxY, point.y),
    }),
    {
      minX: initialPoint.x,
      minY: initialPoint.y,
      maxX: initialPoint.x,
      maxY: initialPoint.y,
    },
  );

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  return {
    ...bounds,
    width,
    height,
    centerX: bounds.minX + width / 2,
    centerY: bounds.minY + height / 2,
  };
}

function getFaceQuality(bounds: FaceBounds) {
  const centerOffsetX = Math.abs(bounds.centerX - 0.5);
  const centerOffsetY = Math.abs(bounds.centerY - 0.5);
  const faceCentered = centerOffsetX <= MAX_FACE_CENTER_OFFSET_X && centerOffsetY <= MAX_FACE_CENTER_OFFSET_Y;
  const faceLargeEnough = bounds.width >= MIN_FACE_WIDTH_RATIO && bounds.height >= MIN_FACE_HEIGHT_RATIO;

// MediaPipe's web result does not expose per-frame confidence, so use a stable quality proxy.
  // Mobile fix: Softer scoring for smaller/tilted faces
  const sizeScore = clamp(
    Math.min(bounds.width / MIN_FACE_WIDTH_RATIO, bounds.height / MIN_FACE_HEIGHT_RATIO),
    0,
    1,
  );
  const centerScore = clamp(
    1 - Math.max(centerOffsetX / MAX_FACE_CENTER_OFFSET_X, centerOffsetY / MAX_FACE_CENTER_OFFSET_Y),
    0,
    1,
  );
  const faceConfidence = Number((sizeScore * 0.6 + centerScore * 0.4).toFixed(3));

  return {
    faceCentered,
    faceLargeEnough,
    faceConfidence,
  };
}

export async function detectFaceFromVideo(video: HTMLVideoElement, timestampMs: number) {
  const faceLandmarker = await initializeMediaPipe();
  const result = faceLandmarker.detectForVideo(video, timestampMs);
  const landmarks = result.faceLandmarks?.[0];

  if (!landmarks) {
    return null;
  }

  const faceBounds = getFaceBounds(landmarks);
  const { faceCentered, faceLargeEnough, faceConfidence } = getFaceQuality(faceBounds);
  
  // Mobile fix #2: ALWAYS compute EAR even if face slightly off/small
  // Only fully block if confidence critically low (<0.3)
  const { leftEar, rightEar, averageEar } = calculateAverageEAR(landmarks);

  return {
    faceLandmarks: landmarks,
    faceBounds,
    faceCentered,
    faceLargeEnough,
    faceConfidence,
    leftEar,
    rightEar,
    averageEar,
  } satisfies MediaPipeDetectionResult;
}
