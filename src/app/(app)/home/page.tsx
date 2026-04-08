'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Task, Portfolio, STATUS_CONFIG, URGENCY_CONFIG, PORTFOLIO_STATUS_CONFIG } from '@/types';
import { cn, getGreeting, todayStr, formatDate, dueDateColor } from '@/lib/utils';
import Link from 'next/link';
import { ArrowUpRight, Clock, TrendingUp, AlertTriangle, Activity } from 'lucide-react';

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*, portfolio:portfolios(*)')
        .eq('is_archived', false)
        .order('due_date', { ascending: true });

      const { data: portfoliosData } = await supabase
        .from('portfolios')
        .select('*')
        .eq('is_archived', false)
        .order('sort_order');

      if (tasksData) setTasks(tasksData);
      if (portfoliosData) {
        const today = new Date().toISOString().split('T')[0];
        const enriched = portfoliosData.map((p) => {
          const pTasks = (tasksData || []).filter((t) => t.portfolio_id === p.id);
          return {
            ...p,
            task_count: pTasks.length,
            done_count: pTasks.filter((t) => t.status === 'done').length,
            overdue_count: pTasks.filter((t) => t.due_date && t.due_date < today && t.status !== 'done').length,
            nearest_due: pTasks
              .filter((t) => t.due_date && t.status !== 'done')
              .sort((a, b) => (a.due_date! > b.due_date! ? 1 : -1))[0]?.due_date || null,
          };
        });
        setPortfolios(enriched);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const completedThisWeek = tasks.filter((t) => {
    if (t.status !== 'done') return false;
    const d = new Date(t.updated_at);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  });
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== 'done');
  const inProgress = tasks.filter((t) => t.status === 'in_progress');

  const priorityTasks = [...tasks]
    .filter((t) => t.status !== 'done' && !t.is_archived)
    .sort((a, b) => {
      const aOv = a.due_date && a.due_date < today ? 1 : 0;
      const bOv = b.due_date && b.due_date < today ? 1 : 0;
      if (bOv !== aOv) return bOv - aOv;
      const aToday = a.due_date === today ? 1 : 0;
      const bToday = b.due_date === today ? 1 : 0;
      if (bToday !== aToday) return bToday - aToday;
      const urg = { critical: 4, high: 3, medium: 2, low: 1 };
      if (urg[b.urgency] !== urg[a.urgency]) return urg[b.urgency] - urg[a.urgency];
      if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : 1;
      return 0;
    })
    .slice(0, 5);

  const stats = [
    { label: 'Active Tasks', value: activeTasks.length, icon: Activity, useTextPrimary: true },
    { label: 'Done This Week', value: completedThisWeek.length, icon: TrendingUp, color: '#22C55E' },
    { label: 'Overdue', value: overdue.length, icon: AlertTriangle, color: overdue.length > 0 ? '#EF4444' : undefined, useTextPrimary: overdue.length === 0 },
    { label: 'In Progress', value: inProgress.length, icon: Clock, color: '#3B82F6' },
  ];

  return (
    <div className="max-w-[1100px]">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-tx-primary tracking-tight">
          {getGreeting()}, Eshgeen
        </h1>
        <p className="text-sm text-tx-muted mt-1">{todayStr()}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-10">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="card-gradient rounded-xl px-5 py-4 group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xs font-medium text-tx-muted uppercase tracking-widest">
                {stat.label}
              </span>
              <stat.icon size={14} className="text-tx-muted/60" />
            </div>
            <p
              className={cn("text-3xl font-semibold font-mono tracking-tight", stat.useTextPrimary && "text-tx-primary")}
              style={stat.color ? { color: stat.color } : undefined}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Priority Feed — Mini Task Cards */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-tx-muted uppercase tracking-widest">
            Needs attention
          </h2>
          <Link href="/tasks" className="text-xs font-medium text-tx-muted hover:text-brand transition-colors flex items-center gap-1">
            All tasks <ArrowUpRight size={12} />
          </Link>
        </div>
        <div className="grid gap-2.5">
          {priorityTasks.map((task) => {
            const isOverdue = task.due_date && task.due_date < today;
            const statusCfg = STATUS_CONFIG[task.status];
            const urgCfg = URGENCY_CONFIG[task.urgency];
            return (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="card-gradient rounded-xl px-4 py-3.5 group flex gap-3 items-start"
              >
                {/* Checkbox */}
                <div className="mt-0.5 shrink-0">
                  <div
                    className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors group-hover:border-brand"
                    style={{ borderColor: statusCfg.color }}
                  >
                    {task.status === 'done' && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4.5 7.5L8 2.5" stroke={statusCfg.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-tx-primary truncate group-hover:text-brand transition-colors">
                      {task.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {task.portfolio && (
                      <span
                        className="text-2xs font-medium px-1.5 py-0.5 rounded text-tx-secondary bg-subtle"
                      >
                        {task.portfolio.name.split('—')[0].trim()}
                      </span>
                    )}
                    <span
                      className="text-2xs font-medium px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}
                    >
                      {statusCfg.label}
                    </span>
                    {false && task.description && (
                      <span className="text-2xs text-tx-muted truncate max-w-[200px]">
                        {task.description}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side — date + urgency */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className="text-2xs font-semibold uppercase px-2 py-0.5 rounded-md"
                    style={{ backgroundColor: urgCfg.bg, color: urgCfg.color }}
                  >
                    {urgCfg.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <Clock size={11} style={{ color: dueDateColor(task.due_date) }} />
                    <span
                      className="text-xs font-mono tabular-nums"
                      style={{ color: dueDateColor(task.due_date), fontWeight: isOverdue ? 600 : 400 }}
                    >
                      {task.due_date ? formatDate(task.due_date) : 'No date'}
                    </span>
                    {isOverdue && (
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--overdue)' }}>
                        overdue
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Portfolios */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-tx-muted uppercase tracking-widest">
            Portfolios
          </h2>
          <Link href="/portfolio" className="text-xs font-medium text-tx-muted hover:text-brand transition-colors flex items-center gap-1">
            View all <ArrowUpRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {portfolios.map((p) => {
            const pStatus = PORTFOLIO_STATUS_CONFIG[p.status];
            const pct = p.task_count ? Math.round(((p.done_count || 0) / p.task_count) * 100) : 0;
            return (
              <Link
                key={p.id}
                href={`/portfolio/${p.id}`}
                className="card-gradient rounded-xl overflow-hidden group"
              >
                {/* Gradient accent line */}
                <div className="h-[2px] opacity-60" style={{ background: `linear-gradient(90deg, ${p.color}, transparent)` }} />

                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-tx-primary truncate group-hover:text-brand transition-colors">
                        {p.name}
                      </h3>
                      {p.description && (
                        <p className="text-2xs text-tx-muted mt-0.5 truncate">{p.description}</p>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md shrink-0 ml-2"
                      style={{ backgroundColor: pStatus.bg, color: pStatus.color }}
                    >
                      {pStatus.label}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1 bg-subtle rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: p.color }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold font-mono text-tx-primary">{p.task_count || 0}</span>
                        <span className="text-2xs text-tx-muted">tasks</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold font-mono" style={{ color: '#22C55E' }}>{p.done_count || 0}</span>
                        <span className="text-2xs text-tx-muted">done</span>
                      </div>
                      {(p.overdue_count || 0) > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold font-mono" style={{ color: '#EF4444' }}>{p.overdue_count}</span>
                          <span className="text-2xs text-tx-muted">late</span>
                        </div>
                      )}
                    </div>
                    {p.nearest_due && (
                      <span className="text-2xs text-tx-muted font-mono">
                        Due {formatDate(p.nearest_due)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
