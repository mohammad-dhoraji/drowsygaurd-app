import { Text, type TextProps } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Fonts } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'title'
    | 'subtitle'
    | 'default'
    | 'defaultSemiBold'
    | 'link'
    | 'mono'
    | 'muted';
  lightColor?: string;
  darkColor?: string;
};

export function ThemedText({
  type = 'default',
  lightColor,
  darkColor,
  style,
  ...rest
}: ThemedTextProps): React.ReactElement {
  const textColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    'text'
  );
  const mutedColor = useThemeColor({}, 'muted');

  const fontFamily = type === 'mono' ? Fonts.mono : Fonts.rounded;

  return (
    <Text
      style={[
        {
          color: textColor,
          fontFamily,
        },
        type === 'title' && {
          fontSize: 32,
          fontWeight: '700',
        },
        type === 'subtitle' && {
          fontSize: 22,
          fontWeight: '600',
        },
        type === 'default' && {
          fontSize: 16,
        },
        type === 'defaultSemiBold' && {
          fontSize: 16,
          fontWeight: '600',
        },
        type === 'link' && {
          fontSize: 16,
          fontWeight: '500',
        },
        type === 'mono' && {
          fontSize: 15,
        },
        type === 'muted' && {
          fontSize: 15,
          color: mutedColor,
        },
        style,
      ]}
      {...rest}
    />
  );
}
