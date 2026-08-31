import React from 'react';
import { Star } from 'lucide-react';

interface RatingBadgeProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export default function RatingBadge({
  rating,
  size = 'md',
  showIcon = true,
  className = '',
}: RatingBadgeProps) {
  const score = Math.round(rating * 10) / 10;

  const getColor = (r: number) => {
    if (r >= 7) return { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', text: '#22c55e' };
    if (r >= 5) return { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.4)', text: '#eab308' };
    return { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#ef4444' };
  };

  const colors = getColor(score);

  const sizeClasses = {
    sm: 'text-[11px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-0.5 gap-1',
    lg: 'text-xs px-2.5 py-1 gap-1.5',
  };

  const iconSizes = {
    sm: 10,
    md: 11,
    lg: 12,
  };

  return (
    <span
      className={`inline-flex items-center rounded-md font-semibold ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
      }}
    >
      {showIcon && <Star size={iconSizes[size]} fill="currentColor" />}
      {score.toFixed(1)}
    </span>
  );
}
