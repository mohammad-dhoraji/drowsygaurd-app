import React, { useState } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ThemedText } from '../themed-text';
import { IconSymbol } from './icon-symbol';

export interface CollapsibleProps extends ViewProps {
  title: string;
  children: React.ReactNode;
}

export function Collapsible({ title, children, ...props }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const height = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    height: withTiming(height.value),
    opacity: withTiming(height.value > 0 ? 1 : 0),
  }));

  return (
    <View {...props}>
      <Pressable
        onPress={() => {
          height.value = isOpen ? 0 : 1000; // Approximate max height
          setIsOpen(!isOpen);
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }}>
        <ThemedText type="subtitle">{title}</ThemedText>
        <IconSymbol
          size={20}
          name={isOpen ? 'chevron.up' : 'chevron.down'}
          color="#808080"
        />
      </Pressable>
      <Animated.View style={[{ overflow: 'hidden' }, animatedStyle]}>
        <View style={{ paddingVertical: 8, paddingHorizontal: 8 }}>{children}</View>
      </Animated.View>
    </View>
  );
}
