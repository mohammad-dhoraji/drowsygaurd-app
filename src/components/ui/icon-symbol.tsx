import React from 'react';
import { Text, type TextProps } from 'react-native';

interface IconSymbolProps extends TextProps {
  name: string;
  size?: number;
  color?: string;
}

export function IconSymbol({ name, size = 24, color = 'black', ...props }: IconSymbolProps) {
  // Simple SF Symbol-like icons using Unicode
  const iconMap: Record<string, string> = {
    'house.fill': '🏠',
    'paperplane.fill': '✈️',
    'chevron.up': '▲',
    'chevron.down': '▼',
    'chevron.left.forwardslash.chevron.right': '↔️',
    'cube': '🧊',
    'square.and.arrow.up': '📤',
    'ellipsis': '⋯',
    'trash': '🗑️',
  };

  const icon = iconMap[name] || '?';

  return (
    <Text
      style={[
        {
          fontSize: size,
          color,
        },
        props.style,
      ]}
      {...props}>
      {icon}
    </Text>
  );
}
