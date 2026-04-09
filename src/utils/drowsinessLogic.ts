import type { DetectionSeverity } from '@/types/detection';

export const DEFAULT_EAR_THRESHOLD = 0.25;
export const DEFAULT_CLOSED_EYE_DURATION_MS = 2000;
export const DEFAULT_PROCESS_INTERVAL_MS = 100;
export const DEFAULT_MISSING_FRAME_TOLERANCE = 2;
export const MISSING_FACE_THRESHOLD_MS = 1500;
export const FACE_MISSING_GRACE_MS = 500;
export const DEFAULT_FACE_MISSING_TOLERANCE = 5;

export type EyeState = 'OPEN' | 'CLOSED' | 'NO_FACE';
export type DrowsinessReason =
  | 'ear_above_threshold'
  | 'ear_below_threshold_started'
  | 'ear_below_threshold_holding'
  | 'closure_duration_reached'
  | 'ear_recovered'
  | 'invalid_ear_reset'
  | 'tracking_gap_held'
  | 'no_face_started'
  | 'no_face_holding'
  | 'no_face_threshold_reached'
  | 'face_recovered';

export interface DrowsinessState {
  eyeClosedStart: number | null;
  closedFrameCount: number;
  drowsyEvents: number;
  hasTriggeredForCurrentClosure: boolean;
  noFaceStart: number | null;
  isFaceMissing: boolean;
  hasTriggeredForCurrentNoFace: boolean;
  faceMissingFrameCount: number;
  lastValidEAR: number | null;
  missingFrameCount: number;
}

export type EventType = 'EYES_CLOSED' | 'NO_FACE';

export interface DrowsinessEvaluation {
  state: DrowsinessState;
  eyeState: EyeState;
  eyesClosed: boolean;
  isFaceMissing: boolean;
  closureDurationMs: number;
  noFaceDurationMs: number;
  closedFrameCount: number;
  shouldTrigger: boolean;
  eventType?: EventType;
  severity: DetectionSeverity | null;
  effectiveEar: number | null;
  reason: DrowsinessReason;
}

export const INITIAL_DROWSINESS_STATE: DrowsinessState = {
  eyeClosedStart: null,
  closedFrameCount: 0,
  drowsyEvents: 0,
  hasTriggeredForCurrentClosure: false,
  noFaceStart: null,
  isFaceMissing: false,
  hasTriggeredForCurrentNoFace: false,
  faceMissingFrameCount: 0,
  lastValidEAR: null,
  missingFrameCount: 0,
};

export function resolveSeverity(durationMs: number): DetectionSeverity {
  if (durationMs >= 6000) {
    return 'HIGH';
  }
  if (durationMs >= 3500) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function isValidEar(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function buildOpenEvaluation(
  state: DrowsinessState,
  effectiveEar: number | null,
  reason: DrowsinessReason,
): DrowsinessEvaluation {
  return {
    state,
    eyeState: 'OPEN',
    eyesClosed: false,
    isFaceMissing: false,
    closureDurationMs: 0,
    noFaceDurationMs: 0,
    closedFrameCount: 0,
    shouldTrigger: false,
    severity: null,
    effectiveEar,
    reason,
  };
}

export function evaluateDrowsiness(
  currentState: DrowsinessState,
  {
    ear,
    smoothedEar = null,
    hasValidDetection = true,
    now = Date.now(),
    threshold = DEFAULT_EAR_THRESHOLD,
    triggerDurationMs = DEFAULT_CLOSED_EYE_DURATION_MS,
    missingFrameTolerance = DEFAULT_MISSING_FRAME_TOLERANCE,
  }: {
    ear: number | null;
    smoothedEar?: number | null;
    hasValidDetection?: boolean;
    now?: number;
    threshold?: number;
    triggerDurationMs?: number;
    missingFrameTolerance?: number;
  },
): DrowsinessEvaluation {
  const preferredEar = isValidEar(smoothedEar) ? smoothedEar : ear;
  let effectiveEar = isValidEar(preferredEar) ? preferredEar : null;
  let nextState = currentState;
  let reason: DrowsinessReason = 'ear_above_threshold';

  // 🚨 NO FACE DETECTION LOGIC
  if (!hasValidDetection) {
    const faceMissingFrameCount = currentState.faceMissingFrameCount + 1;

    // Apply small grace period (avoid flicker)
    if (faceMissingFrameCount < DEFAULT_FACE_MISSING_TOLERANCE) {
      return {
        ...buildOpenEvaluation(
          {
            ...currentState,
            faceMissingFrameCount,
          },
          null,
          'no_face_started', 
        ),
        isFaceMissing: true,
        eyeState: 'NO_FACE',
      };
    }

    const noFaceStart = currentState.noFaceStart ?? now;
    const duration = now - noFaceStart;

    const shouldTrigger =
      duration >= MISSING_FACE_THRESHOLD_MS &&
      !currentState.hasTriggeredForCurrentNoFace;

    return {
      state: {
        ...currentState,
        noFaceStart,
        isFaceMissing: true,
        faceMissingFrameCount,
        hasTriggeredForCurrentNoFace: shouldTrigger
          ? true
          : currentState.hasTriggeredForCurrentNoFace,
        drowsyEvents: shouldTrigger
          ? currentState.drowsyEvents + 1
          : currentState.drowsyEvents,
      },
      eyeState: 'NO_FACE',
      eyesClosed: false,
      isFaceMissing: true,
      closureDurationMs: 0,
      noFaceDurationMs: duration,
      closedFrameCount: 0,
      shouldTrigger,
      eventType: 'NO_FACE',
      severity: shouldTrigger ? resolveSeverity(duration) : null,
      effectiveEar: null,
      reason:
        duration >= MISSING_FACE_THRESHOLD_MS
          ? 'no_face_threshold_reached'
          : 'no_face_holding',
    };
  }

  // ✅ FACE RECOVERED → RESET NO FACE STATE
  if (currentState.isFaceMissing) {
    nextState = {
      ...nextState,
      noFaceStart: null,
      isFaceMissing: false,
      hasTriggeredForCurrentNoFace: false,
      faceMissingFrameCount: 0,
    };
  }

  if (effectiveEar !== null) {
    nextState = {
      ...currentState,
      lastValidEAR: effectiveEar,
      missingFrameCount: 0,
    };
  } else if (
    currentState.eyeClosedStart !== null &&
    currentState.lastValidEAR !== null &&
    currentState.missingFrameCount < missingFrameTolerance
  ) {
    effectiveEar = currentState.lastValidEAR;
    nextState = {
      ...currentState,
      missingFrameCount: currentState.missingFrameCount + 1,
    };
    reason = 'tracking_gap_held';
  } else {
    const resetState: DrowsinessState = {
      ...currentState,
      eyeClosedStart: null,
      closedFrameCount: 0,
      hasTriggeredForCurrentClosure: false,
      missingFrameCount: 0,
    };

    return buildOpenEvaluation(resetState, null, 'invalid_ear_reset');
  }

  if (effectiveEar < threshold) {
    const eyeClosedStart = nextState.eyeClosedStart ?? now;
    const closureDurationMs = now - eyeClosedStart;
    const closedFrameCount = nextState.closedFrameCount + 1;
    const shouldTrigger =
      closureDurationMs >= triggerDurationMs &&
      !nextState.hasTriggeredForCurrentClosure;

    if (reason !== 'tracking_gap_held') {
      if (nextState.eyeClosedStart === null) {
        reason = 'ear_below_threshold_started';
      } else if (shouldTrigger) {
        reason = 'closure_duration_reached';
      } else {
        reason = 'ear_below_threshold_holding';
      }
    }

    return {
      state: {
        ...nextState,
        eyeClosedStart,
        closedFrameCount,
        drowsyEvents: shouldTrigger
          ? nextState.drowsyEvents + 1
          : nextState.drowsyEvents,
        hasTriggeredForCurrentClosure: shouldTrigger
          ? true
          : nextState.hasTriggeredForCurrentClosure,
      },
      eyeState: 'CLOSED',
      eyesClosed: true,
      isFaceMissing: false,
      closureDurationMs,
      noFaceDurationMs: 0,
      closedFrameCount,
      shouldTrigger,
      severity:
        closureDurationMs >= triggerDurationMs
          ? resolveSeverity(closureDurationMs)
          : null,
      effectiveEar,
      reason,
    };
  }

  const reopened = nextState.eyeClosedStart !== null;
  const resetState: DrowsinessState = {
    ...nextState,
    eyeClosedStart: null,
    closedFrameCount: 0,
    hasTriggeredForCurrentClosure: false,
  };

  return buildOpenEvaluation(
    resetState,
    effectiveEar,
    reopened ? 'ear_recovered' : 'ear_above_threshold',
  );
}

export function getDrowsinessLevelFromEAR(
  ear: number | null,
  threshold = DEFAULT_EAR_THRESHOLD,
) {
  if (!isValidEar(ear) || threshold <= 0) {
    return 0;
  }

  const ratio = (threshold - ear) / threshold;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}
