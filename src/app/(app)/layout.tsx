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
  { href: '/board', label: 'Board', icon: Columns3 },
  { href: '#', label: 'Timeline', icon: Calendar, soon: true },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/ai', label: 'Ask AI', icon: Sparkles },
];

const pageTitles: Record<string, string> = {
  '/home': 'Home',
  '/tasks': 'Tasks',
  '/portfolio': 'Portfolio',
  '/settings': 'Settings',
  '/board': 'Board',
  '/reports': 'Reports',
  '/ai': 'Ask AI',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggle, set: setTheme } = useThemeStore();
  const sideW = collapsed ? 'w-[60px]' : 'w-[220px]';
  const mainMl = collapsed ? 'ml-[60px]' : 'ml-[220px]';

  // Load saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('pulse-theme') as 'dark' | 'light' | null;
    if (saved) {
      setTheme(saved);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, [setTheme]);

  const currentTitle = Object.entries(pageTitles).find(([k]) =>
    pathname.startsWith(k)
  )?.[1] || '';

  return (
    <div className="flex min-h-screen bg-app">
      {/* Sidebar */}
      <aside className={cn(
        sideW,
        'shrink-0 bg-surface/50 backdrop-blur-xl border-r border-border fixed h-screen z-30 flex flex-col transition-all duration-200'
      )}>
        {/* Logo + collapse */}
        <div className={cn(
          'flex items-center h-12 border-b border-border',
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        )}>
          {!collapsed && (
            <span className="text-sm font-bold text-tx-primary tracking-tight">PULSE</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md hover:bg-subtle text-tx-muted hover:text-tx-secondary transition-colors"
          >
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.label}
                href={item.soon ? '#' : item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md text-sm font-medium transition-all duration-100',
                  collapsed ? 'justify-center h-9 w-9 mx-auto' : 'h-8 px-2.5',
                  isActive
                    ? 'bg-brand-subtle text-brand'
                    : item.soon
                    ? 'text-tx-muted/50 cursor-default'
                    : 'text-tx-secondary hover:text-tx-primary hover:bg-subtle'
                )}
              >
                <item.icon size={16} className={cn(isActive && 'text-brand')} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.soon && (
                      <span className="text-[9px] font-medium bg-subtle text-tx-muted rounded px-1.5 py-px uppercase tracking-wider">
                        Soon
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom — theme toggle + settings */}
        <div className="px-2 pb-3 flex flex-col gap-1">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            title={collapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md text-sm font-medium text-tx-secondary hover:text-tx-primary hover:bg-subtle transition-colors',
              collapsed ? 'justify-center h-9 w-9 mx-auto' : 'h-8 px-2.5'
            )}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          {/* Settings */}
          <Link
            href="/settings"
            title={collapsed ? 'Settings' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors',
              collapsed ? 'justify-center h-9 w-9 mx-auto' : 'h-8 px-2.5',
              pathname === '/settings'
                ? 'bg-brand-subtle text-brand'
                : 'text-tx-secondary hover:text-tx-primary hover:bg-subtle'
            )}
          >
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
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-purple-400 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">EJ</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
