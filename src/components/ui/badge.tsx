import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'p1' | 'p2' | 'p3';
  children: React.ReactNode;
  className?: string;
}

const variantStyles = {
  default: 'bg-bg-subtle text-text-secondary',
  success: 'bg-success-light text-success',
  warning: 'bg-warning-light text-warning',
  danger: 'bg-danger-light text-danger',
  info: 'bg-info-light text-info',
  p1: 'bg-danger-light text-p1',
  p2: 'bg-warning-light text-p2',
  p3: 'bg-bg-subtle text-p3',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-bold uppercase tracking-wide font-ui',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
