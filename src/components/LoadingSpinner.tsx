import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full border-transparent border-t-neo-cyan animate-spin`}
        style={{
          borderTopColor: '#06b6d4',
          borderRightColor: 'rgba(6,182,212,0.3)',
          borderBottomColor: 'transparent',
          borderLeftColor: 'rgba(6,182,212,0.1)',
        }}
      />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen bg-neo-dark flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div
            className="w-16 h-16 rounded-full animate-spin"
            style={{
              border: '3px solid transparent',
              borderTopColor: '#06b6d4',
              borderRightColor: 'rgba(6,182,212,0.3)',
            }}
          />
          <div
            className="absolute inset-2 rounded-full animate-spin"
            style={{
              border: '2px solid transparent',
              borderTopColor: '#7c3aed',
              borderLeftColor: 'rgba(124,58,237,0.3)',
              animationDirection: 'reverse',
              animationDuration: '0.8s',
            }}
          />
        </div>
        <p className="text-neo-text-secondary text-sm animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
