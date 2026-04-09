import React from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ThemedText } from './themed-text';

export function HelloWave() {
  const waveRotation = useSharedValue(0);

  React.useEffect(() => {
    waveRotation.value = withRepeat(
      withSequence(withTiming(15, { duration: 200 }), withTiming(0, { duration: 200 })),
      -1,
      false
    );
  }, [waveRotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${waveRotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <ThemedText type="title">??</ThemedText>
    </Animated.View>
  );
}
