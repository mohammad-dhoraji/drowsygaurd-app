import { useCallback, useRef } from 'react';

import {
  appendEarSample,
  DEFAULT_EAR_SMOOTHING_WINDOW,
} from '@/utils/detectionStability';
import {
  DEFAULT_EAR_THRESHOLD,
  evaluateDrowsiness,
  INITIAL_DROWSINESS_STATE,
  type DrowsinessEvaluation,
  type DrowsinessState,
} from '@/utils/drowsinessLogic';

export interface ProcessDrowsinessFrameInput {
  ear: number | null;
  hasValidDetection?: boolean;
  now: number;
  threshold?: number;
}

export interface ProcessedDrowsinessFrame extends DrowsinessEvaluation {
  rawEar: number | null;
  smoothedEar: number | null;
  threshold: number;
}

export function useDrowsinessDetector({
  defaultThreshold = DEFAULT_EAR_THRESHOLD,
  smoothingWindow = DEFAULT_EAR_SMOOTHING_WINDOW,
}: {
  defaultThreshold?: number;
  smoothingWindow?: number;
} = {}) {
  const detectorStateRef = useRef<DrowsinessState>(INITIAL_DROWSINESS_STATE);
  const earHistoryRef = useRef<number[]>([]);

  const resetDetector = useCallback(() => {
    detectorStateRef.current = INITIAL_DROWSINESS_STATE;
    earHistoryRef.current = [];
  }, []);

  const processFrame = useCallback(
    ({
      ear,
      hasValidDetection,
      now,
      threshold = defaultThreshold,
    }: ProcessDrowsinessFrameInput): ProcessedDrowsinessFrame => {
      let smoothedEar: number | null = null;

      if (typeof ear === 'number' && Number.isFinite(ear)) {
        const smoothing = appendEarSample(
          earHistoryRef.current,
          ear,
          smoothingWindow,
        );
        earHistoryRef.current = smoothing.history;
        smoothedEar = smoothing.smoothedEar;
      } else {
        earHistoryRef.current = [];
      }

      const evaluation = evaluateDrowsiness(detectorStateRef.current, {
        ear,
        smoothedEar,
        hasValidDetection,
        now,
        threshold,
      });

      detectorStateRef.current = evaluation.state;

      return {
        ...evaluation,
        rawEar: ear,
        smoothedEar,
        threshold,
      };
    },
    [defaultThreshold, smoothingWindow],
  );

  return {
    detectorStateRef,
    processFrame,
    resetDetector,
  };
}
