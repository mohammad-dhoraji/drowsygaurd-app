import type React from 'react';
import { Platform } from 'react-native';

interface GuardianLiveMapProps {
  description?: string;
  latitude: number;
  longitude: number;
  title: string;
}

let GuardianLiveMap: React.ComponentType<GuardianLiveMapProps>;

if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  GuardianLiveMap = require('./GuardianLiveMap.web').default;
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  GuardianLiveMap = require('./GuardianLiveMap.native').default;
}

export default GuardianLiveMap;
