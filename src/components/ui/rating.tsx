'use client';

import { cn } from '@/lib/utils';

interface RatingProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  label?: string;
  leftLabel?: string;
  rightLabel?: string;
}

export function Rating({
  value,
  onChange,
  max = 5,
  label,
  leftLabel,
  rightLabel,
}: RatingProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-sm font-medium text-text-secondary font-ui">{label}</span>
      )}
      <div className="flex items-center gap-2">
        {leftLabel && (
          <span className="text-xs text-text-muted font-ui">{leftLabel}</span>
        )}
        <div className="flex gap-1.5">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cn(
                'w-9 h-9 rounded-full text-sm font-mono font-medium transition-all duration-150',
                n === value
                  ? 'bg-primary text-text-inverse shadow-sm'
                  : 'bg-bg-subtle text-text-secondary hover:bg-primary-light'
              )}
            >
              {n}
            </button>
          ))}
        </div>
        {rightLabel && (
          <span className="text-xs text-text-muted font-ui">{rightLabel}</span>
        )}
      </div>
    </div>
  );
}
