'use client';

import { cn } from '@/lib/utils';
import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-text-secondary font-ui">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'w-full px-4 py-3 bg-bg-subtle rounded-md border border-border text-base font-ui text-text-primary',
            'focus:outline-none focus:border-border-focus focus:ring-2 focus:ring-primary-light',
            'transition-all duration-150',
            error && 'border-danger',
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-danger font-ui">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Select };
