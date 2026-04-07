'use client';

import { cn } from '@/lib/utils';
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-text-secondary font-ui">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-4 py-3 bg-bg-subtle rounded-md border border-border text-base font-ui text-text-primary placeholder:text-text-muted',
            'focus:outline-none focus:border-border-focus focus:ring-2 focus:ring-primary-light',
            'transition-all duration-150',
            error && 'border-danger',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger font-ui">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-text-secondary font-ui">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'w-full px-4 py-3 bg-bg-subtle rounded-md border border-border text-base font-ui text-text-primary placeholder:text-text-muted',
            'focus:outline-none focus:border-border-focus focus:ring-2 focus:ring-primary-light',
            'transition-all duration-150 resize-none',
            error && 'border-danger',
            className
          )}
          rows={4}
          {...props}
        />
        {error && <p className="text-xs text-danger font-ui">{error}</p>}
      </div>
    );
  }
);
TextArea.displayName = 'TextArea';

export { Input, TextArea };
