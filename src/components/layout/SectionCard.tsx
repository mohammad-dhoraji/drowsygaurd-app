import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/useThemeColor';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SectionCard({
  title,
  subtitle,
  children,
  footer,
  style,
}: SectionCardProps) {
  const surfaceColor = useThemeColor({}, 'surface');
  const borderColor = useThemeColor({}, 'border');

  return (
    <View style={[styles.card, { backgroundColor: surfaceColor, borderColor }, style]}>
      {title || subtitle ? (
        <View style={styles.header}>
          {title ? <ThemedText type="subtitle">{title}</ThemedText> : null}
          {subtitle ? (
            <ThemedText type="muted" style={styles.subtitle}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 4,
  },
  header: {
    gap: 6,
  },
  subtitle: {
    lineHeight: 20,
  },
  body: {
    gap: 14,
  },
  footer: {
    paddingTop: 4,
  },
});
