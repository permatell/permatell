'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  size = 'md', 
  className,
  ...props 
}) => {
  const sizeClasses: Record<string, string> = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  return (
    <div 
      className={cn(
        'animate-spin rounded-full border-solid border-t-transparent',
        'border-primary',
        sizeClasses[size] || sizeClasses.md,
        className || ''
      )}
      {...props}
    />
  );
};
