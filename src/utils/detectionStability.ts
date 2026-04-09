export const DEFAULT_CALIBRATION_DURATION_MS = 4000;
export const DEFAULT_MIN_CALIBRATION_SAMPLES = 20;
export const DEFAULT_EAR_SMOOTHING_WINDOW = 7;
export const DEFAULT_MOBILE_THRESHOLD_GRACE = 0.035;

export interface EarCalibrationState {
  startedAt: number | null;
  sampleCount: number;
  sampleTotal: number;
  samples: number[];
  baselineEar: number | null;
  threshold: number;
  isComplete: boolean;
}

export interface EarCalibrationUpdate {
  state: EarCalibrationState;
  progress: number;
  justCompleted: boolean;
}

export function createEarCalibrationState(
  defaultThreshold: number,
): EarCalibrationState {
  return {
    startedAt: null,
    sampleCount: 0,
    sampleTotal: 0,
    samples: [],
    baselineEar: null,
    threshold: defaultThreshold,
    isComplete: false,
  };
}

export function resolveAdaptiveThreshold(
  baselineEar: number,
  {
    isMobile = false,
    multiplier = 0.7,
    mobileGrace = DEFAULT_MOBILE_THRESHOLD_GRACE,
  }: {
    isMobile?: boolean;
    multiplier?: number;
    mobileGrace?: number;
  } = {},
) {
  const baseThreshold = baselineEar * multiplier;

  if (!isMobile) {
    return baseThreshold;
  }

  // Mobile cameras are noisier, so add a small grace band while still basing the threshold on calibration.
  return Math.min(baselineEar * 0.82, baseThreshold + mobileGrace);
}

export function updateEarCalibration(
  currentState: EarCalibrationState,
  {
    ear,
    now,
    isMobile,
    durationMs = DEFAULT_CALIBRATION_DURATION_MS,
    minimumSamples = DEFAULT_MIN_CALIBRATION_SAMPLES,
  }: {
    ear: number | null;
    now: number;
    isMobile: boolean;
    durationMs?: number;
    minimumSamples?: number;
  },
): EarCalibrationUpdate {
  if (currentState.isComplete) {
    return {
      state: currentState,
      progress: 1,
      justCompleted: false,
    };
  }

  const startedAt = currentState.startedAt ?? now;
  const hasValidEar = typeof ear === "number" && Number.isFinite(ear);
  const sampleCount = currentState.sampleCount + (hasValidEar ? 1 : 0);
  const sampleTotal = currentState.sampleTotal + (hasValidEar ? ear : 0);
  const samples = hasValidEar ? [...currentState.samples, ear] : currentState.samples;
  const elapsedMs = now - startedAt;
  const progress = Math.max(
    0,
    Math.min(1, Math.min(elapsedMs / durationMs, sampleCount / minimumSamples)),
  );
  const shouldFinalize =
    elapsedMs >= durationMs && sampleCount >= minimumSamples;

  if (!shouldFinalize) {
    return {
      state: {
        ...currentState,
        startedAt,
        sampleCount,
        sampleTotal,
        samples,
      },
      progress,
      justCompleted: false,
    };
  }

  const sorted = samples.slice().sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * 0.2);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  const baselineSamples = trimmed.length > 0 ? trimmed : sorted;

  const baselineEar =
    baselineSamples.reduce((sum, value) => sum + value, 0) /
    baselineSamples.length;
  return {
    state: {
      startedAt,
      sampleCount,
      sampleTotal,
      samples,
      baselineEar,
      threshold: resolveAdaptiveThreshold(baselineEar, { isMobile }),
      isComplete: true,
    },
    progress: 1,
    justCompleted: true,
  };
}

export function appendEarSample(
  history: number[],
  value: number,
  windowSize = DEFAULT_EAR_SMOOTHING_WINDOW,
) {
  const nextHistory = [...history, value].slice(-windowSize);
  const smoothedEar =
    nextHistory.reduce((sum, current) => sum + current, 0) / nextHistory.length;

  return {
    history: nextHistory,
    smoothedEar,
  };
}

export function isLikelyMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return (
    typeof navigator !== "undefined" &&
    (navigator.userAgent.includes("Mobi") || navigator.maxTouchPoints > 1)
  );
}
