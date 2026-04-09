import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable } from 'react-native';

export function HapticTab(props: BottomTabBarButtonProps) {
  const { onPressIn, ...rest } = props;

  return (
    <Pressable
      {...(rest as any)}
      onPressIn={(event) => {
        void Haptics.selectionAsync();
        onPressIn?.(event);
      }}
    />
  );
}
