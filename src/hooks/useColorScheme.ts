import { useTheme } from '../providers/ThemeProvider';

export function useColorScheme() {
  const { colorScheme } = useTheme();
  return colorScheme;
}
