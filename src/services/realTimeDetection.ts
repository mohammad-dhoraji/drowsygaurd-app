import { DrowsinessState, evaluateDrowsiness } from '@/utils/drowsinessLogic';
import { DetectionSnapshot } from '@/types/detection';

const EAR_BUFFER_SIZE = 3;
let earBuffer: number[] = [];

// ML Kit gives 0.0 (closed) → 1.0 (open)
// Our EAR expects ~0.15 (closed) → ~0.40 (open)
// Linear mapping: ear = 0.15 + (prob * 0.25)
export function mlKitProbToEAR(prob: number): number {
  return 0.15 + prob * 0.25;
}

export function computeEAR(leftProb: number, rightProb: number): number {
  const leftEar = mlKitProbToEAR(leftProb);
  const rightEar = mlKitProbToEAR(rightProb);
  return (leftEar + rightEar) / 2;
}

export function smoothEAR(raw: number): number {
  earBuffer.push(raw);
  if (earBuffer.length > EAR_BUFFER_SIZE) earBuffer.shift();
  return earBuffer.reduce((a, b) => a + b, 0) / earBuffer.length;
}

export function resetEarBuffer() {
  earBuffer = [];
}

export function processFaceFrame(
  face: {
    leftEyeOpenProbability?: number;
    rightEyeOpenProbability?: number;
    bounds?: any;
  } | null,
  currentState: DrowsinessState,
  baseSnapshot: DetectionSnapshot
): { snapshot: DetectionSnapshot; nextState: DrowsinessState; shouldTrigger: boolean } {
  const hasValidDetection = !!face;

  let leftProb = 0;
  let rightProb = 0;
  let rawEar: number | null = null;
  let smoothed = null;

  if (hasValidDetection) {
    leftProb = face.leftEyeOpenProbability ?? 0;
    rightProb = face.rightEyeOpenProbability ?? 0;
    rawEar = computeEAR(leftProb, rightProb);
    smoothed = smoothEAR(rawEar);
  } else {
    resetEarBuffer();
  }

  const evaluation = evaluateDrowsiness(currentState, {
    ear: rawEar,
    smoothedEar: smoothed,
    hasValidDetection,
  });

  const nextState = evaluation.state;
  const shouldTrigger = evaluation.shouldTrigger;

  let statusMessage = baseSnapshot.statusMessage;
  if (!hasValidDetection) {
    statusMessage = evaluation.isFaceMissing ? 'Face missing' : 'Finding face...';
  } else if (shouldTrigger) {
    statusMessage = 'ALERT: Drowsiness Detected!';
  } else if (evaluation.eyeState === 'CLOSED') {
    statusMessage = 'Eyes closed...';
  } else {
    statusMessage = 'Monitoring active';
  }

  const snapshot: DetectionSnapshot = {
    ...baseSnapshot,
    hasFace: hasValidDetection,
    isFaceMissing: evaluation.isFaceMissing,
    noFaceDurationMs: evaluation.noFaceDurationMs,
    ear: rawEar,
    leftEar: hasValidDetection ? mlKitProbToEAR(leftProb) : null,
    rightEar: hasValidDetection ? mlKitProbToEAR(rightProb) : null,
    eyesClosed: evaluation.eyesClosed,
    closureDurationMs: evaluation.closureDurationMs,
    severity: evaluation.severity,
    drowsyEvents: nextState.drowsyEvents,
    statusMessage,
    lastProcessedAt: Date.now(),
    eventType: evaluation.eventType,
  };

  return { snapshot, nextState, shouldTrigger };
}
