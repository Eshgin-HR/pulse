'use client';

import { cn } from '@/lib/utils';

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  suffix = '%',
  className,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-secondary font-ui">{label}</span>
        <span className="text-sm font-mono font-medium text-text-primary">
          {value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary"
        style={{
          background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${percentage}%, var(--color-bg-muted) ${percentage}%, var(--color-bg-muted) 100%)`,
        }}
      />
    </div>
  );
}
