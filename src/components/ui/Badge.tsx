import React from 'react';
import { View, Text } from 'react-native';
import { twMerge } from 'tailwind-merge';

type BadgeProps = {
  variant?: 'safe' | 'warning' | 'danger' | 'default';
  children: React.ReactNode;
  className?: string;
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  const variants = {
    safe: 'bg-safe/10 dark:bg-safe/20',
    warning: 'bg-warning/10 dark:bg-warning/20',
    danger: 'bg-danger/10 dark:bg-danger/20',
    default: 'bg-gray-100 dark:bg-gray-800',
  };

  const textVariants = {
    safe: 'text-safe dark:text-green-400',
    warning: 'text-warning dark:text-amber-400',
    danger: 'text-danger dark:text-red-400',
    default: 'text-gray-700 dark:text-gray-300',
  };

  return (
    <View className={twMerge('px-2.5 py-0.5 rounded-full flex-row items-center self-start', variants[variant], className)}>
      <Text className={twMerge('text-xs font-bold uppercase tracking-wider', textVariants[variant])}>{children}</Text>
    </View>
  );
}
