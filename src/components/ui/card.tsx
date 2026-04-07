import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tint?: 'lavender' | 'peach' | 'sky' | 'mint' | 'lemon' | 'rose' | 'none';
}

const tintMap = {
  lavender: 'bg-card-lavender',
  peach: 'bg-card-peach',
  sky: 'bg-card-sky',
  mint: 'bg-card-mint',
  lemon: 'bg-card-lemon',
  rose: 'bg-card-rose',
  none: 'bg-bg-surface',
};

export function Card({ className, tint = 'none', children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg p-5 shadow-card',
        tintMap[tint],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
