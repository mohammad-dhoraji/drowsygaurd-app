export interface FaceLandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export const LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380] as const;
export const RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144] as const;

function dist(a: FaceLandmarkPoint, b: FaceLandmarkPoint) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function calculateEAR(eyeLandmarks: FaceLandmarkPoint[]) {
  if (eyeLandmarks.length < 6) {
    return null;
  }

  const A = dist(eyeLandmarks[1], eyeLandmarks[5]);
  const B = dist(eyeLandmarks[2], eyeLandmarks[4]);
  const C = dist(eyeLandmarks[0], eyeLandmarks[3]);

  if (C === 0) {
    return null;
  }

  return (A + B) / (2.0 * C);
}

function extractEyeLandmarks(faceLandmarks: FaceLandmarkPoint[], eyeIndices: readonly number[]) {
  const eyeLandmarks = eyeIndices
    .map((index) => faceLandmarks[index])
    .filter((point): point is FaceLandmarkPoint => Boolean(point));

  return eyeLandmarks.length === eyeIndices.length ? eyeLandmarks : null;
}

export function calculateAverageEAR(faceLandmarks: FaceLandmarkPoint[]) {
  const leftEyeLandmarks = extractEyeLandmarks(faceLandmarks, LEFT_EYE_INDICES);
  const rightEyeLandmarks = extractEyeLandmarks(faceLandmarks, RIGHT_EYE_INDICES);

  if (!leftEyeLandmarks || !rightEyeLandmarks) {
    return {
      leftEar: null,
      rightEar: null,
      averageEar: null,
    };
  }

  const leftEar = calculateEAR(leftEyeLandmarks);
  const rightEar = calculateEAR(rightEyeLandmarks);

  if (leftEar === null || rightEar === null) {
    return {
      leftEar,
      rightEar,
      averageEar: null,
    };
  }

  return {
    leftEar,
    rightEar,
    averageEar: (leftEar + rightEar) / 2,
  };
}
