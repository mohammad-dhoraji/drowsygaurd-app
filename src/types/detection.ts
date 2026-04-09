export type DetectionSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type DetectionStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'alert'
  | 'unsupported'
  | 'permission-denied'
  | 'error';
export type DetectionMode = 'web-live' | 'native-preview';
export type BackendSyncStatus = 'idle' | 'sent' | 'disabled' | 'error';
export type EventType = 'EYES_CLOSED' | 'NO_FACE';

export interface DetectionSnapshot {
  status: DetectionStatus;
  mode: DetectionMode;
  hasFace: boolean;
  isFaceMissing: boolean;
  noFaceDurationMs: number;
  ear: number | null;
  leftEar: number | null;
  rightEar: number | null;
  earThreshold: number;
  eyesClosed: boolean;
  closureDurationMs: number;
  eventType?: EventType;
  severity: DetectionSeverity | null;
  drowsyEvents: number;
  fps: number;
  backendStatus: BackendSyncStatus;
  backendMessage: string | null;
  statusMessage: string | null;
  lastProcessedAt: number | null;
  lastEventAt: string | null;
}

export interface CameraFeedProps {
  accessToken?: string | null;
  sessionId?: string | null;
  onSnapshotChange?: (snapshot: DetectionSnapshot) => void;
}

export const DEFAULT_DETECTION_SNAPSHOT: DetectionSnapshot = {
  status: 'idle',
  mode: 'native-preview',
  hasFace: false,
  isFaceMissing: false,
  noFaceDurationMs: 0,
  ear: null,
  leftEar: null,
  rightEar: null,
  earThreshold: 0.25,
  eyesClosed: false,
  closureDurationMs: 0,
  severity: null,
  drowsyEvents: 0,
  fps: 0,
  backendStatus: 'idle',
  backendMessage: null,
  statusMessage: 'Preparing camera...',
  lastProcessedAt: null,
  lastEventAt: null,
};

