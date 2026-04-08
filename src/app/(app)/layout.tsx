'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/theme-store';
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
} from 'lucide-react';

const navItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/portfolio', label: 'Portfolio', icon: FolderKanban },
  { href: '/ai', label: 'Ask AI', icon: Sparkles },
  { href: '#', label: 'Board', icon: Columns3, soon: true },
  { href: '#', label: 'Timeline', icon: Calendar, soon: true },
  { href: '#', label: 'Reports', icon: BarChart3, soon: true },
];

const pageTitles: Record<string, string> = {
  '/home': 'Home',
  '/tasks': 'Tasks',
  '/portfolio': 'Portfolio',
  '/ai': 'Ask AI',
  '/settings': 'Settings',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggle, set: setTheme } = useThemeStore();

  useEffect(() => {
    const saved = localStorage.getItem('pulse-theme') as 'dark' | 'light' | null;
    if (saved) setTheme(saved);
  }, [setTheme]);

  const currentTitle = Object.entries(pageTitles).find(([k]) =>
    pathname.startsWith(k)
  )?.[1] || '';

  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* App Container — floating card on gradient */}
      <div className="app-container min-h-[calc(100vh-48px)] flex">
        {/* Sidebar */}
        <aside className={cn(
          'shrink-0 flex flex-col border-r border-border transition-all duration-200',
          collapsed ? 'w-[56px]' : 'w-[220px]'
        )} style={{ background: 'var(--bg-muted)' }}>
          {/* Logo + collapse */}
          <div className={cn(
            'flex items-center h-14 border-b border-border',
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          )}>
            {!collapsed && (
              <span className="text-md font-bold text-tx-primary tracking-tight">PULSE</span>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-subtle text-tx-muted hover:text-tx-primary transition-colors"
            >
              {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-2 py-3 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.label}
                  href={item.soon ? '#' : item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-2.5 text-sm font-medium transition-all duration-150',
                    collapsed ? 'justify-center w-10 h-10 mx-auto rounded-lg' : 'h-9 px-3 rounded-md',
                    isActive
                      ? 'nav-pill-active'
                      : item.soon
                      ? 'text-tx-muted/50 cursor-default'
                      : 'text-tx-secondary hover:text-tx-primary hover:bg-subtle'
                  )}
                >
                  <item.icon size={18} strokeWidth={1.5} />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.soon && (
                        <span className="text-[9px] font-medium bg-subtle text-tx-muted rounded-xs px-1.5 py-px uppercase tracking-wider">
                          Soon
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom */}
          <div className="px-2 pb-3 flex flex-col gap-1">
            <button
              onClick={toggle}
              title={collapsed ? (theme === 'dark' ? 'Light' : 'Dark') : undefined}
              className={cn(
                'flex items-center gap-2.5 text-sm font-medium text-tx-secondary hover:text-tx-primary hover:bg-subtle transition-colors',
                collapsed ? 'justify-center w-10 h-10 mx-auto rounded-lg' : 'h-9 px-3 rounded-md'
              )}
            >
              {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
              {!collapsed && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
            </button>

            <Link
              href="/settings"
              title={collapsed ? 'Settings' : undefined}
              className={cn(
                'flex items-center gap-2.5 text-sm font-medium transition-colors',
                collapsed ? 'justify-center w-10 h-10 mx-auto rounded-lg' : 'h-9 px-3 rounded-md',
                pathname === '/settings'
                  ? 'nav-pill-active'
                  : 'text-tx-secondary hover:text-tx-primary hover:bg-subtle'
              )}
            >
              <Settings size={18} strokeWidth={1.5} />
              {!collapsed && <span>Settings</span>}
            </Link>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="h-14 px-6 flex items-center justify-between border-b border-border" style={{ background: 'var(--bg-surface)' }}>
            <span className="text-sm font-medium text-tx-secondary">{currentTitle}</span>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center shadow-sm">
                <span className="text-[11px] font-bold text-white">EJ</span>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-6 overflow-auto" style={{ background: 'var(--bg-app)' }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
