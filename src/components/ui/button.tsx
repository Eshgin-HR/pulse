'use client';

import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-ui font-semibold transition-all duration-150 rounded-full',
          variant === 'primary' && 'bg-primary text-text-inverse shadow-cta hover:bg-primary-hover hover:-translate-y-[1px]',
          variant === 'secondary' && 'bg-bg-subtle text-text-primary border border-border hover:bg-bg-muted',
          variant === 'ghost' && 'bg-transparent text-text-secondary hover:bg-bg-subtle',
          variant === 'danger' && 'bg-danger text-text-inverse hover:bg-accent-hover',
          size === 'sm' && 'px-4 py-2 text-sm',
          size === 'md' && 'px-6 py-3 text-base',
          size === 'lg' && 'px-8 py-4 text-md',
          props.disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
