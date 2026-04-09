import { View, type ViewProps } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({
  lightColor,
  darkColor,
  ...rest
}: ThemedViewProps): React.ReactElement {
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    'background'
  );

  return <View style={[{ backgroundColor }, rest.style]} {...rest} />;
}
