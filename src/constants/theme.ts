import { Platform } from 'react-native';

export const Fonts = {
  rounded: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
} as const;

export const Colors = {
  light: {
    background: '#F6FBF8',        // subtle green tint instead of gray-blue
    surface: '#FFFFFF',
    text: '#052E1C',              // deep green text (better branding)
    muted: '#6B7280',

    tint: '#22C55E',              // ✅ PRIMARY GREEN (fixed)
    border: '#D1E7DD',

    success: '#16A34A',
    warning: '#F59E0B',
    danger: '#EF4444',

    tabIconDefault: '#9CA3AF',
    tabIconSelected: '#22C55E',   // green active tab
  },

  dark: {
    background: '#07130F',        // green-tinted dark (NOT blue-black)
    surface: '#0F1F17',
    text: '#ECFDF5',              // soft green-white
    muted: '#9CA3AF',

    tint: '#22C55E',              // ✅ KEEP BRAND CONSISTENT
    border: '#1F2A24',

    success: '#22C55E',
    warning: '#FBBF24',
    danger: '#F87171',

    tabIconDefault: '#6B7280',
    tabIconSelected: '#22C55E',   // no more random blue
  },
} as const;

export type ThemeColorName = keyof typeof Colors.light;