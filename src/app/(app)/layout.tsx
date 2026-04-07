'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Kanban,
  BarChart3,
  Settings,
  PenLine,
  TrendingUp,
  History,
} from 'lucide-react';

const sidebarLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/log', label: 'Log Week', icon: PenLine },
  { href: '/kanban', label: 'Kanban', icon: Kanban },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/history', label: 'History', icon: History },
  { href: '/growth', label: 'Growth', icon: TrendingUp },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const mobileNavLinks = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/kanban', label: 'Kanban', icon: Kanban },
  { href: '/log', label: 'Log', icon: PenLine, isCta: true },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'More', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[240px] border-r border-border bg-bg-surface fixed h-full z-30">
        <div className="px-6 py-5 border-b border-border">
          <h1 className="font-display text-xl text-text-primary tracking-tight">PULSE</h1>
          <p className="text-xs text-text-muted font-ui mt-0.5">PASHA Holding</p>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {sidebarLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-ui font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary-light text-primary'
                    : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary'
                )}
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-[240px] pb-20 lg:pb-0">
        {/* Desktop Topbar */}
        <header className="hidden lg:flex items-center justify-between h-16 px-8 border-b border-border bg-bg-surface sticky top-0 z-20">
          <div />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center">
              <span className="text-xs font-bold text-primary font-ui">EJ</span>
            </div>
          </div>
        </header>

        {/* Mobile Topbar */}
        <header className="lg:hidden flex items-center justify-between h-14 px-5 border-b border-border bg-bg-surface sticky top-0 z-20">
          <h1 className="font-display text-lg text-text-primary">PULSE</h1>
          <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center">
            <span className="text-xs font-bold text-primary font-ui">EJ</span>
          </div>
        </header>

        <div className="px-5 lg:px-8 py-6 max-w-[860px] mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-[60px] bg-bg-surface border-t border-border flex items-center justify-around px-2 z-30 shadow-nav">
        {mobileNavLinks.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          if (link.isCta) {
            return (
              <Link
                key={link.href}
                href={link.href}
                className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-cta -mt-4"
              >
                <link.icon size={20} className="text-text-inverse" />
              </Link>
            );
          }
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex flex-col items-center gap-0.5 text-xs font-ui',
                isActive ? 'text-primary' : 'text-text-muted'
              )}
            >
              <link.icon size={20} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
