import React from 'react';
import { Text, View } from 'react-native';

import type { DetectionSnapshot } from '@/types/detection';

function resolveStatusLabel(snapshot: DetectionSnapshot) {
  if (snapshot.status === 'alert') return 'Drowsiness alert';
  if (snapshot.isFaceMissing) return `No face (${(snapshot.noFaceDurationMs / 1000).toFixed(1)}s)`;
  if (snapshot.status === 'ready') return snapshot.hasFace ? 'Face locked' : 'Searching for face';
  if (snapshot.status === 'unsupported') return 'Preview only';
  if (snapshot.status === 'permission-denied') return 'Camera blocked';
  if (snapshot.status === 'error') return 'Detection error';
  return 'Starting up';
}

function resolveStatusClasses(snapshot: DetectionSnapshot) {
  if (snapshot.status === 'alert') return 'bg-red-500';
  if (snapshot.isFaceMissing) return 'bg-red-500';
  if (snapshot.status === 'ready' && snapshot.hasFace) return 'bg-emerald-500';
  if (snapshot.status === 'unsupported') return 'bg-amber-500';
  if (snapshot.status === 'permission-denied' || snapshot.status === 'error') return 'bg-red-500';
  return 'bg-sky-500';
}

function formatEar(value: number | null) {
  return typeof value === 'number' ? value.toFixed(3) : '--';
}

function formatDuration(durationMs: number) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatBackend(snapshot: DetectionSnapshot) {
  if (snapshot.backendStatus === 'sent') return 'Synced';
  if (snapshot.backendStatus === 'disabled') return 'Offline';
  if (snapshot.backendStatus === 'error') return 'Retry needed';
  return 'Idle';
}

export function DetectionOverlay({ snapshot }: { snapshot: DetectionSnapshot }) {
  const frameBorderClass = snapshot.status === 'alert' || snapshot.isFaceMissing
    ? 'border-red-400 animate-pulse'
    : snapshot.hasFace
      ? 'border-emerald-300'
      : 'border-white/50';

  return (
    <View pointerEvents="none" className="absolute inset-0 justify-between p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center rounded-full bg-black/60 px-3 py-1.5">
          <View className={`mr-2 h-2.5 w-2.5 rounded-full ${resolveStatusClasses(snapshot)}`} />
          <Text className="text-xs font-bold uppercase tracking-[1px] text-white">
            {snapshot.mode === 'web-live' ? 'On-device detection' : 'Camera preview'}
          </Text>
        </View>

        <View className="rounded-full bg-black/60 px-3 py-1.5">
          <Text className="text-xs font-bold text-white">
            {snapshot.fps > 0 ? `${snapshot.fps.toFixed(0)} FPS` : '-- FPS'}
          </Text>
        </View>
      </View>

      <View className="flex-1 items-center justify-center">
        <View className={`h-64 w-48 rounded-[32px] border-2 ${frameBorderClass}`} />
      </View>

      <View className="gap-3">
        {snapshot.status === 'alert' ? (
          <View className="rounded-3xl border border-red-300 bg-red-500/90 px-4 py-3">
            <Text className="text-base font-bold text-white">Wake up and take a break.</Text>
            <Text className="mt-1 text-xs text-red-100">
              Eyes stayed closed beyond the alert threshold and the event was queued for logging.
            </Text>
          </View>
        ) : null}

        {snapshot.statusMessage ? (
          <View className="rounded-3xl bg-black/65 px-4 py-3">
            <Text className="text-sm font-semibold text-white">{resolveStatusLabel(snapshot)}</Text>
            <Text className="mt-1 text-xs leading-5 text-white/80">{snapshot.statusMessage}</Text>
          </View>
        ) : null}

        <View className="rounded-3xl bg-black/70 px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-white/60">EAR</Text>
            <Text className="font-mono text-lg font-bold text-white">{formatEar(snapshot.ear)}</Text>
          </View>

          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-white/60">Closed for</Text>
            <Text className="font-mono text-sm font-semibold text-white">{formatDuration(snapshot.closureDurationMs)}</Text>
          </View>

          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-white/60">Events</Text>
            <Text className="text-sm font-semibold text-white">{snapshot.drowsyEvents}</Text>
          </View>

          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-[11px] font-semibold uppercase tracking-[1px] text-white/60">Backend</Text>
            <Text className="text-sm font-semibold text-white">{formatBackend(snapshot)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

