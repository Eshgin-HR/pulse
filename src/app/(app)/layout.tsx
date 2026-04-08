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
  Menu,
  X,
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

const mobileNavItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/board', label: 'Board', icon: Columns3 },
  { href: '/portfolio', label: 'Portfolio', icon: FolderKanban },
  { href: '/ai', label: 'AI', icon: Sparkles },
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggle, set: setTheme } = useThemeStore();

  useEffect(() => {
    const saved = localStorage.getItem('pulse-theme') as 'dark' | 'light' | null;
    if (saved) setTheme(saved);
    else document.documentElement.setAttribute('data-theme', 'dark');
  }, [setTheme]);

  // Close mobile menu on navigate
  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  const currentTitle = Object.entries(pageTitles).find(([k]) => pathname.startsWith(k))?.[1] || '';
  const sideW = collapsed ? 'w-[60px]' : 'w-[220px]';
  const mainMl = collapsed ? 'ml-[60px]' : 'ml-[220px]';

  return (
    <div className="flex min-h-screen bg-app">
      {/* ═══ DESKTOP SIDEBAR ═══ */}
      <aside className={cn(
        sideW,
        'hidden lg:flex shrink-0 bg-surface/50 backdrop-blur-xl border-r border-border fixed h-screen z-30 flex-col transition-all duration-200'
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

      {/* ═══ MOBILE SLIDE-OUT MENU ═══ */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[260px] bg-surface border-r border-border flex flex-col">
            <div className="flex items-center justify-between h-14 px-4 border-b border-border">
              <span className="text-md font-bold text-tx-primary">PULSE</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-md hover:bg-subtle text-tx-muted"><X size={18} /></button>
            </div>
            <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
              {navItems.map(item => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link key={item.label} href={item.href}
                    className={cn('flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-colors',
                      isActive ? 'bg-brand-subtle text-brand' : 'text-tx-secondary hover:text-tx-primary hover:bg-subtle')}>
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="px-3 pb-4 flex flex-col gap-1">
              <button onClick={toggle} className="flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium text-tx-secondary hover:bg-subtle">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <Link href="/settings" className={cn('flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-colors',
                pathname === '/settings' ? 'bg-brand-subtle text-brand' : 'text-tx-secondary hover:bg-subtle')}>
                <Settings size={18} /> Settings
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MAIN CONTENT ═══ */}
      <div className={cn('flex-1 flex flex-col transition-all duration-200', `lg:${mainMl}`)}>
        {/* Topbar — desktop */}
        <header className="hidden lg:flex h-12 bg-app/80 backdrop-blur-md border-b border-border px-6 items-center justify-between sticky top-0 z-20">
          <span className="text-sm font-medium text-tx-secondary">{currentTitle}</span>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-purple-400 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">EJ</span>
          </div>
        </header>

        {/* Topbar — mobile */}
        <header className="lg:hidden flex h-14 bg-surface border-b border-border px-4 items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="p-1.5 rounded-md hover:bg-subtle text-tx-secondary">
              <Menu size={20} />
            </button>
            <span className="text-md font-bold text-tx-primary">PULSE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-tx-muted">{currentTitle}</span>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-purple-400 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">EJ</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* ═══ MOBILE BOTTOM NAV ═══ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface/90 backdrop-blur-xl border-t border-border flex items-center justify-around px-2 z-30">
        {mobileNavItems.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.label} href={item.href}
              className={cn('flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors',
                isActive ? 'text-brand' : 'text-tx-muted')}>
              <item.icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
