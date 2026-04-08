import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function dueDateState(dueDate: string | null): 'overdue' | 'today' | 'tomorrow' | 'normal' | null {
  if (!dueDate) return null;
  const d = parseISO(dueDate);
  if (isPast(d) && !isToday(d)) return 'overdue';
  if (isToday(d)) return 'today';
  if (isTomorrow(d)) return 'tomorrow';
  return 'normal';
}

export function dueDateColor(dueDate: string | null): string {
  const state = dueDateState(dueDate);
  if (state === 'overdue') return 'var(--overdue)';
  if (state === 'today' || state === 'tomorrow') return 'var(--due-today)';
  return 'var(--text-secondary)';
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return format(parseISO(date), 'MMM d');
}

export function formatDateFull(date: string | null): string {
  if (!date) return '—';
  return format(parseISO(date), 'MMM d, yyyy');
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function todayStr(): string {
  return format(new Date(), 'EEEE, MMMM d');
}
