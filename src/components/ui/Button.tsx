import React from 'react';
import { TouchableOpacity, Text, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { twMerge } from 'tailwind-merge';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends TouchableOpacityProps {
  variant?: ButtonVariant;
  title: string;
  loading?: boolean;
  className?: string;
  textClassName?: string;
}

export function Button({ variant = 'primary', title, loading, className, textClassName, disabled, ...props }: ButtonProps) {
  const baseStyle = 'flex-row items-center justify-center py-3.5 px-4 rounded-xl active:opacity-80';
  
  const variants = {
    primary: 'bg-primary dark:bg-primary-light',
    secondary: 'bg-secondary dark:bg-secondary-dark',
    danger: 'bg-danger text-white',
    ghost: 'bg-transparent',
  };

  const textVariants = {
    primary: 'text-white font-semibold text-base tracking-tight',
    secondary: 'text-primary-dark font-semibold text-base tracking-tight',
    danger: 'text-white font-semibold text-base tracking-tight',
    ghost: 'text-primary dark:text-secondary font-semibold text-base',
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity 
      className={twMerge(baseStyle, variants[variant], isDisabled ? 'opacity-50' : '', className)} 
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? '#064e3b' : '#fff'} />
      ) : (
        <Text className={twMerge(textVariants[variant], textClassName)}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
