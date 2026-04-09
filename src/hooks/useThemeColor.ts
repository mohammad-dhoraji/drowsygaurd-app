import { Colors, type ThemeColorName } from '@/constants/theme';
import { useTheme } from '@/providers/ThemeProvider';

type ThemeOverrides = {
  light?: string;
  dark?: string;
};

export function useThemeColor(
  overrides: ThemeOverrides = {},
  colorName: ThemeColorName = 'text'
) {
  const { colorScheme } = useTheme();
  const theme = Colors[colorScheme];

  return overrides[colorScheme] ?? theme[colorName];
}
