import { Text, View } from 'react-native';

interface GuardianLiveMapProps {
  description?: string;
  latitude: number;
  longitude: number;
  title: string;
}

export default function GuardianLiveMap({
  description,
  latitude,
  longitude,
  title,
}: GuardianLiveMapProps) {
  return (
    <View className="flex-1 items-center justify-center bg-slate-950 px-6">
      <View className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/90 p-6">
        <Text className="text-xs font-bold uppercase tracking-[2px] text-emerald-300">
          Live location
        </Text>
        <Text className="mt-3 text-2xl font-bold text-white">{title}</Text>
        {description ? (
          <Text className="mt-2 text-sm leading-6 text-slate-300">{description}</Text>
        ) : null}
        <View className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <Text className="text-sm font-semibold text-emerald-200">Latest coordinates</Text>
          <Text className="mt-2 font-mono text-base text-white">{latitude.toFixed(5)}</Text>
          <Text className="mt-1 font-mono text-base text-white">{longitude.toFixed(5)}</Text>
        </View>
        <Text className="mt-5 text-xs leading-5 text-slate-400">
          Native builds show the live map with react-native-maps. Web keeps the same realtime data feed and marker coordinates.
        </Text>
      </View>
    </View>
  );
}
