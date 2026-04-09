import React from 'react';
import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';

export interface ParallaxScrollViewProps extends ViewProps {
  headerBackgroundColor?: { light?: string; dark?: string };
  headerImage?: React.ReactNode;
  children: React.ReactNode;
}

export default function ParallaxScrollView({
  headerBackgroundColor,
  headerImage,
  children,
  ...props
}: ParallaxScrollViewProps) {
  const backgroundColor = useThemeColor(headerBackgroundColor ?? {}, 'surface');

  return (
    <View {...props} style={[styles.container, props.style]}>
      <View style={[styles.header, { backgroundColor }]}>{headerImage}</View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
  },
});
