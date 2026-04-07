import { startOfWeek, endOfWeek, getISOWeek, format, differenceInDays, parseISO } from 'date-fns';

export function getWeekInfo(date: Date = new Date()) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  return {
    week_start: format(weekStart, 'yyyy-MM-dd'),
    week_end: format(weekEnd, 'yyyy-MM-dd'),
    week_number: getISOWeek(date),
    year: date.getFullYear(),
  };
}

export function blockerAgeDays(sinceDate: string): number {
  return differenceInDays(new Date(), parseISO(sinceDate));
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatWeekRange(weekStart: string): string {
  const start = parseISO(weekStart);
  const end = endOfWeek(start, { weekStartsOn: 1 });
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
}
