'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import { useThemeStore } from '@/stores/theme-store';
import { createClient } from '@/lib/supabase/client';
import { Task, URGENCY_CONFIG } from '@/types';
import { differenceInDays, parseISO } from 'date-fns';
import {
  Home,
  CheckSquare,
  Columns3,
  FolderKanban,
  Calendar,
  BarChart3,
  Sparkles,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Moon,
  Bell,
  AlertTriangle,
  Clock,
  X,
  CheckCheck,
} from 'lucide-react';

const navItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/portfolio', label: 'Portfolio', icon: FolderKanban },
  { href: '/board', label: 'Kanban Board', icon: Columns3 },
  { href: '/timeline', label: 'Timeline', icon: Calendar },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/ai', label: 'Ask AI', icon: Sparkles },
];

const pageTitles: Record<string, string> = {
  '/home': 'Home',
  '/tasks': 'Tasks',
  '/portfolio': 'Portfolio',
  '/board': 'Kanban Board',
  '/timeline': 'Timeline',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/ai': 'Ask AI',
};

type NotifTask = Task & {
  daysOverdue: number;
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggle, set: setTheme } = useThemeStore();
  const sideW = collapsed ? 'w-[60px]' : 'w-[220px]';
  const mainMl = collapsed ? 'ml-[60px]' : 'ml-[220px]';

  // Notifications
  const [bellOpen, setBellOpen] = useState(false);
  const [overdueTasks, setOverdueTasks] = useState<NotifTask[]>([]);
  const [dueTodayTasks, setDueTodayTasks] = useState<NotifTask[]>([]);
  const [seenAt, setSeenAt] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('pulse-theme') as 'dark' | 'light' | null;
    if (saved) setTheme(saved);
    else document.documentElement.setAttribute('data-theme', 'dark');

    setSeenAt(localStorage.getItem('pulse-notif-seen'));
  }, [setTheme]);

  // Fetch overdue tasks
  const fetchNotifications = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('tasks')
      .select('*, portfolio:portfolios(name, color)')
      .eq('is_archived', false)
      .neq('status', 'done')
      .not('due_date', 'is', null)
      .order('due_date');

    if (!data) return;
    const today = new Date().toISOString().split('T')[0];
    const overdue = data
      .filter(t => t.due_date && t.due_date < today)
      .map(t => ({ ...t, daysOverdue: differenceInDays(new Date(), parseISO(t.due_date!)) }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
    const dueToday = data
      .filter(t => t.due_date === today)
      .map(t => ({ ...t, daysOverdue: 0 }));

    setOverdueTasks(overdue);
    setDueTodayTasks(dueToday);
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  // Refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close bell on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('[data-bell]')) setBellOpen(false);
    }
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  const totalAlerts = overdueTasks.length + dueTodayTasks.length;
  const hasUnseen = seenAt ? overdueTasks.some(t => t.updated_at > seenAt) || dueTodayTasks.some(t => t.updated_at > seenAt) : totalAlerts > 0;

  function markSeen() {
    const now = new Date().toISOString();
    setSeenAt(now);
    localStorage.setItem('pulse-notif-seen', now);
  }

  const currentTitle = Object.entries(pageTitles).find(([k]) => pathname.startsWith(k))?.[1] || '';

  return (
    <div className="flex min-h-screen bg-app">
      {/* Sidebar */}
      <aside className={cn(
        sideW,
        'shrink-0 bg-surface/50 backdrop-blur-xl border-r border-border fixed h-screen z-30 flex flex-col transition-all duration-200'
      )}>
        <div className={cn('flex items-center h-12 border-b border-border', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          {!collapsed && <span className="text-sm font-bold text-tx-primary tracking-tight">PULSE</span>}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-md hover:bg-subtle text-tx-muted hover:text-tx-secondary transition-colors">
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.label} href={item.href} title={collapsed ? item.label : undefined}
                className={cn('flex items-center gap-2.5 rounded-md text-sm font-medium transition-all duration-100',
                  collapsed ? 'justify-center h-9 w-9 mx-auto' : 'h-8 px-2.5',
                  isActive ? 'bg-brand-subtle text-brand' : 'text-tx-secondary hover:text-tx-primary hover:bg-subtle')}>
                <item.icon size={16} className={cn(isActive && 'text-brand')} />
                {!collapsed && <span className="flex-1">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="px-2 pb-3 flex flex-col gap-1">
          <button onClick={toggle} title={collapsed ? (theme === 'dark' ? 'Light' : 'Dark') : undefined}
            className={cn('flex items-center gap-2.5 rounded-md text-sm font-medium text-tx-secondary hover:text-tx-primary hover:bg-subtle transition-colors',
              collapsed ? 'justify-center h-9 w-9 mx-auto' : 'h-8 px-2.5')}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>
          <Link href="/settings" title={collapsed ? 'Settings' : undefined}
            className={cn('flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors',
              collapsed ? 'justify-center h-9 w-9 mx-auto' : 'h-8 px-2.5',
              pathname === '/settings' ? 'bg-brand-subtle text-brand' : 'text-tx-secondary hover:text-tx-primary hover:bg-subtle')}>
            <Settings size={16} />
            {!collapsed && <span>Settings</span>}
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn(mainMl, 'flex-1 flex flex-col transition-all duration-200')}>
        {/* Topbar */}
        <header className="h-12 bg-app/80 backdrop-blur-md border-b border-border px-6 flex items-center justify-between sticky top-0 z-20">
          <span className="text-sm font-medium text-tx-secondary">{currentTitle}</span>
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative" data-bell onClick={e => e.stopPropagation()}>
              <button onClick={() => setBellOpen(!bellOpen)}
                className="relative p-1.5 rounded-md hover:bg-subtle text-tx-muted hover:text-tx-primary transition-colors">
                <Bell size={17} />
                {hasUnseen && totalAlerts > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--p-critical)] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {totalAlerts > 9 ? '9+' : totalAlerts}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {bellOpen && (
                <div className="absolute right-0 top-10 z-50 w-[360px] bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Bell size={14} className="text-tx-secondary" />
                      <span className="text-sm font-semibold text-tx-primary">Notifications</span>
                      {totalAlerts > 0 && (
                        <span className="text-2xs font-mono bg-[var(--p-critical-bg)] text-[var(--p-critical)] px-1.5 py-0.5 rounded-md">{totalAlerts}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {hasUnseen && (
                        <button onClick={markSeen} title="Mark all seen"
                          className="p-1 rounded hover:bg-subtle text-tx-muted hover:text-tx-primary transition-colors">
                          <CheckCheck size={14} />
                        </button>
                      )}
                      <button onClick={() => setBellOpen(false)} className="p-1 rounded hover:bg-subtle text-tx-muted hover:text-tx-primary">
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="max-h-[400px] overflow-y-auto">
                    {totalAlerts === 0 ? (
                      <div className="py-10 text-center">
                        <Bell size={20} className="text-tx-muted mx-auto mb-2" />
                        <p className="text-sm text-tx-muted">All clear. No overdue tasks.</p>
                      </div>
                    ) : (
                      <>
                        {/* Overdue */}
                        {overdueTasks.length > 0 && (
                          <div>
                            <div className="px-4 py-2 bg-[var(--p-critical-bg)]">
                              <div className="flex items-center gap-1.5">
                                <AlertTriangle size={12} className="text-[var(--p-critical)]" />
                                <span className="text-2xs font-semibold text-[var(--p-critical)] uppercase tracking-widest">
                                  Overdue ({overdueTasks.length})
                                </span>
                              </div>
                            </div>
                            {overdueTasks.map(task => {
                              const urgCfg = URGENCY_CONFIG[task.urgency];
                              return (
                                <Link key={task.id} href={`/tasks/${task.id}`} onClick={() => setBellOpen(false)}
                                  className="flex items-start gap-3 px-4 py-2.5 hover:bg-subtle transition-colors border-b border-border">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                    style={{ backgroundColor: 'var(--p-critical-bg)' }}>
                                    <span className="text-[10px] font-bold font-mono" style={{ color: 'var(--p-critical)' }}>
                                      {task.daysOverdue}d
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-tx-primary truncate">{task.title}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {task.portfolio && (
                                        <span className="text-2xs text-tx-muted">{(task.portfolio as { name: string }).name.split('—')[0].trim()}</span>
                                      )}
                                      <span className="text-2xs font-mono" style={{ color: 'var(--p-critical)' }}>
                                        Due {formatDate(task.due_date)}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md shrink-0"
                                    style={{ backgroundColor: urgCfg.bg, color: urgCfg.color }}>
                                    {urgCfg.label}
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        )}

                        {/* Due Today */}
                        {dueTodayTasks.length > 0 && (
                          <div>
                            <div className="px-4 py-2 bg-[var(--p-high-bg)]">
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-[var(--p-high)]" />
                                <span className="text-2xs font-semibold text-[var(--p-high)] uppercase tracking-widest">
                                  Due Today ({dueTodayTasks.length})
                                </span>
                              </div>
                            </div>
                            {dueTodayTasks.map(task => {
                              const urgCfg = URGENCY_CONFIG[task.urgency];
                              return (
                                <Link key={task.id} href={`/tasks/${task.id}`} onClick={() => setBellOpen(false)}
                                  className="flex items-start gap-3 px-4 py-2.5 hover:bg-subtle transition-colors border-b border-border">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                    style={{ backgroundColor: 'var(--p-high-bg)' }}>
                                    <Clock size={13} style={{ color: 'var(--p-high)' }} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-tx-primary truncate">{task.title}</p>
                                    {task.portfolio && (
                                      <span className="text-2xs text-tx-muted">{(task.portfolio as { name: string }).name.split('—')[0].trim()}</span>
                                    )}
                                  </div>
                                  <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md shrink-0"
                                    style={{ backgroundColor: urgCfg.bg, color: urgCfg.color }}>
                                    {urgCfg.label}
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-purple-400 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">EJ</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
