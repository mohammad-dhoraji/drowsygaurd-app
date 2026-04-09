import type { ReactNode } from 'react';
import type { Edge } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';

interface ScreenWrapperProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  refreshControl?: ScrollViewProps['refreshControl'];
}

export function ScreenWrapper({
  children,
  scroll = false,
  edges = ['top', 'bottom'],
  style,
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
  refreshControl,
}: ScreenWrapperProps) {
  const backgroundColor = useThemeColor({}, 'background');

  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, { backgroundColor }, style]}>
      {scroll ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, contentContainerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 20,
  },
});
