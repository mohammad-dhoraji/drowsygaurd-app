import React from 'react';
import { View, ViewProps } from 'react-native';
import { twMerge } from 'tailwind-merge';

export function Card({ className, ...props }: ViewProps) {
  return (
    <View 
      className={twMerge('bg-white dark:bg-[#1f2937] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden', className)} 
      {...props} 
    />
  );
}

export function CardHeader({ className, ...props }: ViewProps) {
  return <View className={twMerge('px-4 py-3 border-b border-gray-100 dark:border-gray-800', className)} {...props} />;
}

export function CardContent({ className, ...props }: ViewProps) {
  return <View className={twMerge('p-4', className)} {...props} />;
}
