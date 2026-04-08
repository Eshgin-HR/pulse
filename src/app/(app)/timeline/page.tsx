'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Task, Portfolio, TaskStatus, Urgency, STATUS_CONFIG, URGENCY_CONFIG } from '@/types';
import { cn, formatDate } from '@/lib/utils';
import {
  addDays, startOfWeek, startOfMonth,
  differenceInDays, format, parseISO, isToday, isBefore, isAfter, eachDayOfInterval,
  eachWeekOfInterval,
} from 'date-fns';
import Link from 'next/link';
import {
  Activity, CheckCircle2, AlertTriangle, Clock, ChevronDown, X,
  ChevronRight,
} from 'lucide-react';

type Zoom = 'week' | 'month' | 'quarter';
type GroupBy = 'portfolio' | 'status' | 'urgency' | 'none';

function getTimelineRange(zoom: Zoom): { start: Date; end: Date; days: number } {
  const now = new Date();
  if (zoom === 'week') {
    const start = addDays(startOfWeek(now, { weekStartsOn: 1 }), -7);
    const end = addDays(start, 28);
    return { start, end, days: 28 };
  }
  if (zoom === 'month') {
    const start = addDays(startOfMonth(now), -7);
    const end = addDays(start, 60);
    return { start, end, days: 60 };
  }
  // quarter
  const start = addDays(startOfMonth(now), -14);
  const end = addDays(start, 120);
  return { start, end, days: 120 };
}

function getDateHeaders(start: Date, end: Date, zoom: Zoom) {
  if (zoom === 'week') {
    return eachDayOfInterval({ start, end }).map(d => ({
      date: d, label: format(d, 'd'), sublabel: format(d, 'EEE'), isToday: isToday(d),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    }));
  }
  if (zoom === 'month') {
    return eachDayOfInterval({ start, end }).map(d => ({
      date: d, label: format(d, 'd'), sublabel: d.getDate() === 1 ? format(d, 'MMM') : '', isToday: isToday(d),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    }));
  }
  // quarter — show weeks
  return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map(d => ({
    date: d, label: format(d, 'MMM d'), sublabel: '', isToday: false,
    isWeekend: false,
  }));
}

interface TaskGroup {
  key: string;
  label: string;
  color: string;
  tasks: Task[];
  collapsed: boolean;
}

export default function TimelinePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);

  const [zoom, setZoom] = useState<Zoom>('month');
  const [groupBy, setGroupBy] = useState<GroupBy>('portfolio');
  const [filterPortfolios, setFilterPortfolios] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<TaskStatus[]>([]);
  const [filterUrgencies, setFilterUrgencies] = useState<Urgency[]>([]);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from('tasks').select('*, portfolio:portfolios(*)').eq('is_archived', false).order('due_date', { ascending: true }),
        supabase.from('portfolios').select('*').eq('is_archived', false).order('sort_order'),
      ]);
      if (t) setTasks(t);
      if (p) setPortfolios(p);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    function h(e: MouseEvent) { if (!(e.target as HTMLElement).closest('[data-dropdown]')) setOpenFilter(null); }
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const { start: timeStart, end: timeEnd, days: totalDays } = useMemo(() => getTimelineRange(zoom), [zoom]);
  const headers = useMemo(() => getDateHeaders(timeStart, timeEnd, zoom), [timeStart, timeEnd, zoom]);

  // Filter
  const filtered = useMemo(() => {
    let r = [...tasks];
    if (filterPortfolios.length > 0) r = r.filter(t => t.portfolio_id && filterPortfolios.includes(t.portfolio_id));
    if (filterStatuses.length > 0) r = r.filter(t => filterStatuses.includes(t.status));
    if (filterUrgencies.length > 0) r = r.filter(t => filterUrgencies.includes(t.urgency));
    return r;
  }, [tasks, filterPortfolios, filterStatuses, filterUrgencies]);

  // Stats
  const stats = useMemo(() => ({
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    overdue: tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length,
  }), [tasks, today]);

  // Groups
  const groups: TaskGroup[] = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'All Tasks', color: 'var(--brand)', tasks: filtered, collapsed: false }];
    if (groupBy === 'portfolio') {
      const grouped = portfolios.map(p => ({
        key: p.id, label: p.name.split('—')[0].trim(), color: p.color,
        tasks: filtered.filter(t => t.portfolio_id === p.id),
        collapsed: collapsedGroups.has(p.id),
      }));
      const ungrouped = filtered.filter(t => !t.portfolio_id);
      if (ungrouped.length) grouped.push({ key: 'none', label: 'No Portfolio', color: '#71717A', tasks: ungrouped, collapsed: collapsedGroups.has('none') });
      return grouped.filter(g => g.tasks.length > 0);
    }
    if (groupBy === 'status') {
      return (['todo', 'in_progress', 'in_review', 'done'] as TaskStatus[]).map(s => ({
        key: s, label: STATUS_CONFIG[s].label, color: STATUS_CONFIG[s].color,
        tasks: filtered.filter(t => t.status === s), collapsed: collapsedGroups.has(s),
      })).filter(g => g.tasks.length > 0);
    }
    // urgency
    return (['critical', 'high', 'medium', 'low'] as Urgency[]).map(u => ({
      key: u, label: URGENCY_CONFIG[u].label, color: URGENCY_CONFIG[u].color,
      tasks: filtered.filter(t => t.urgency === u), collapsed: collapsedGroups.has(u),
    })).filter(g => g.tasks.length > 0);
  }, [filtered, groupBy, portfolios, collapsedGroups]);

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => { const n = new Set(prev); if (n.has(key)) { n.delete(key); } else { n.add(key); } return n; });
  }

  function toggleMulti<T>(arr: T[], val: T, setter: (v: T[]) => void) {
    setter(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  }

  const hasFilters = filterPortfolios.length > 0 || filterStatuses.length > 0 || filterUrgencies.length > 0;

  // Bar positioning
  function getBarStyle(task: Task) {
    const taskStart = task.start_date ? parseISO(task.start_date) : parseISO(task.created_at);
    const taskEnd = task.due_date ? parseISO(task.due_date) : taskStart;
    const hasDuration = task.start_date && task.due_date;

    const clampedStart = isBefore(taskStart, timeStart) ? timeStart : taskStart;
    const clampedEnd = isAfter(taskEnd, timeEnd) ? timeEnd : taskEnd;

    const startOffset = differenceInDays(clampedStart, timeStart);
    const duration = Math.max(differenceInDays(clampedEnd, clampedStart), 1);

    const leftPct = (startOffset / totalDays) * 100;
    const widthPct = (duration / totalDays) * 100;

    // Check if overdue
    const isOverdue = task.due_date && task.due_date < today && task.status !== 'done';
    const overdueDays = isOverdue ? differenceInDays(new Date(), parseISO(task.due_date!)) : 0;
    const overdueWidthPct = (overdueDays / totalDays) * 100;

    return { leftPct: Math.max(leftPct, 0), widthPct: Math.min(widthPct, 100 - leftPct), hasDuration, isOverdue, overdueWidthPct };
  }

  // Today line position
  const todayOffset = differenceInDays(new Date(), timeStart);
  const todayPct = (todayOffset / totalDays) * 100;

  const colWidth = zoom === 'quarter' ? 80 : zoom === 'month' ? 28 : 40;
  const gridWidth = headers.length * colWidth;

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total', value: stats.total, icon: Activity, useTP: true },
          { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'var(--s-inprogress)' },
          { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: stats.overdue > 0 ? 'var(--p-critical)' : undefined, useTP: stats.overdue === 0 },
          { label: 'Done', value: stats.done, icon: CheckCircle2, color: 'var(--s-done)' },
        ].map(s => (
          <div key={s.label} className="card-gradient rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xs font-medium text-tx-muted uppercase tracking-widest">{s.label}</span>
              <s.icon size={13} className="text-tx-muted/60" />
            </div>
            <p className={cn("text-xl font-semibold font-mono", s.useTP && "text-tx-primary")} style={s.color ? { color: s.color } : undefined}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Header + Controls */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-tx-primary tracking-tight">Timeline</h1>
        <div className="flex items-center gap-2">
          {/* Filters */}
          <div className="relative" data-dropdown onClick={e => e.stopPropagation()}>
            <button onClick={() => setOpenFilter(openFilter === 'portfolio' ? null : 'portfolio')}
              className={cn('h-8 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5',
                filterPortfolios.length > 0 ? 'border-brand text-brand bg-brand-subtle' : 'border-border text-tx-secondary bg-surface hover:bg-subtle')}>
              Portfolio {filterPortfolios.length > 0 && `(${filterPortfolios.length})`} <ChevronDown size={12} />
            </button>
            {openFilter === 'portfolio' && (
              <div className="absolute right-0 top-10 z-50 bg-surface border border-border rounded-xl shadow-lg py-2 w-[220px]">
                {portfolios.map(p => (
                  <button key={p.id} onClick={() => toggleMulti(filterPortfolios, p.id, setFilterPortfolios)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-subtle">
                    <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center', filterPortfolios.includes(p.id) ? 'border-brand bg-brand' : 'border-border')}>
                      {filterPortfolios.includes(p.id) && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-tx-primary truncate">{p.name.split('—')[0].trim()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Group By */}
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}
            className="h-8 px-3 rounded-lg border border-border text-sm font-medium text-tx-secondary bg-surface appearance-none cursor-pointer">
            <option value="portfolio">Group: Portfolio</option>
            <option value="status">Group: Status</option>
            <option value="urgency">Group: Urgency</option>
            <option value="none">No grouping</option>
          </select>

          {/* Zoom */}
          <div className="flex items-center h-8 rounded-lg border border-border overflow-hidden">
            {(['week', 'month', 'quarter'] as Zoom[]).map(z => (
              <button key={z} onClick={() => setZoom(z)}
                className={cn('px-3 h-full text-sm font-medium transition-colors capitalize',
                  zoom === z ? 'bg-brand text-tx-inverse' : 'bg-surface text-tx-secondary hover:bg-subtle')}>
                {z}
              </button>
            ))}
          </div>

          {hasFilters && (
            <button onClick={() => { setFilterPortfolios([]); setFilterStatuses([]); setFilterUrgencies([]); }}
              className="h-8 px-2 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-subtle"><X size={14} /></button>
          )}
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="card-gradient rounded-xl overflow-hidden">
        <div className="flex">
          {/* Left: Task Names */}
          <div className="w-[220px] shrink-0 border-r border-border">
            {/* Header */}
            <div className="h-12 border-b border-border px-3 flex items-center">
              <span className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Tasks</span>
            </div>
            {/* Groups + Tasks */}
            {groups.map(group => (
              <div key={group.key}>
                {groupBy !== 'none' && (
                  <button onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center gap-2 px-3 h-8 bg-subtle/50 border-b border-border hover:bg-subtle transition-colors">
                    <ChevronRight size={12} className={cn('text-tx-muted transition-transform', !group.collapsed && 'rotate-90')} />
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                    <span className="text-2xs font-semibold text-tx-primary truncate">{group.label}</span>
                    <span className="text-2xs text-tx-muted ml-auto">{group.tasks.length}</span>
                  </button>
                )}
                {!group.collapsed && group.tasks.map(task => (
                  <Link key={task.id} href={`/tasks/${task.id}`}
                    className={cn('flex items-center gap-2 px-3 h-8 border-b border-border hover:bg-subtle/50 transition-colors',
                      groupBy !== 'none' && 'pl-7')}
                    onMouseEnter={() => setHoveredTask(task.id)} onMouseLeave={() => setHoveredTask(null)}>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_CONFIG[task.status].color }} />
                    <span className={cn('text-2xs text-tx-primary truncate', task.status === 'done' && 'line-through text-tx-muted')}>
                      {task.title}
                    </span>
                  </Link>
                ))}
              </div>
            ))}
          </div>

          {/* Right: Timeline Grid */}
          <div className="flex-1 overflow-x-auto">
            <div style={{ minWidth: gridWidth }}>
              {/* Date Headers */}
              <div className="h-12 border-b border-border flex">
                {headers.map((h, i) => (
                  <div key={i} className={cn('flex flex-col items-center justify-center border-r border-border', h.isWeekend && 'bg-subtle/30')}
                    style={{ width: colWidth, minWidth: colWidth }}>
                    {h.sublabel && <span className="text-[9px] text-tx-muted font-medium">{h.sublabel}</span>}
                    <span className={cn('text-2xs font-medium', h.isToday ? 'text-brand font-bold' : 'text-tx-secondary')}>{h.label}</span>
                  </div>
                ))}
              </div>

              {/* Task Bars */}
              <div className="relative">
                {/* Today line */}
                {todayPct >= 0 && todayPct <= 100 && (
                  <div className="absolute top-0 bottom-0 w-px z-10" style={{ left: `${todayPct}%`, background: 'var(--p-critical)', opacity: 0.6 }}>
                    <div className="absolute -top-0 -left-[3px] w-[7px] h-[7px] rounded-full" style={{ background: 'var(--p-critical)' }} />
                  </div>
                )}

                {groups.map(group => (
                  <div key={group.key}>
                    {groupBy !== 'none' && (
                      <div className="h-8 border-b border-border bg-subtle/30" />
                    )}
                    {!group.collapsed && group.tasks.map(task => {
                      const bar = getBarStyle(task);
                      const statusCfg = STATUS_CONFIG[task.status];
                      return (
                        <div key={task.id} className="h-8 border-b border-border relative"
                          onMouseEnter={() => setHoveredTask(task.id)} onMouseLeave={() => setHoveredTask(null)}>
                          {/* Weekend bg stripes */}
                          {headers.map((h, i) => h.isWeekend && (
                            <div key={i} className="absolute top-0 bottom-0 bg-subtle/20" style={{ left: `${(i / headers.length) * 100}%`, width: `${(1 / headers.length) * 100}%` }} />
                          ))}

                          {/* Task bar */}
                          {bar.hasDuration ? (
                            <Link href={`/tasks/${task.id}`}
                              className={cn('absolute top-1.5 h-5 rounded-sm cursor-pointer transition-all',
                                hoveredTask === task.id ? 'opacity-100 shadow-sm' : 'opacity-80')}
                              style={{
                                left: `${bar.leftPct}%`,
                                width: `${Math.max(bar.widthPct, 0.5)}%`,
                                backgroundColor: task.status === 'done' ? statusCfg.color : (task.portfolio as Portfolio)?.color || 'var(--brand)',
                              }}
                              title={`${task.title}\n${task.start_date ? formatDate(task.start_date) : '?'} → ${task.due_date ? formatDate(task.due_date) : '?'}`}>
                              <span className="text-[9px] font-medium text-white px-1 truncate block leading-5">
                                {bar.widthPct > 3 ? task.title : ''}
                              </span>
                            </Link>
                          ) : (
                            // No duration — show diamond marker
                            <Link href={`/tasks/${task.id}`}
                              className="absolute top-2 w-3 h-3 rotate-45 rounded-sm cursor-pointer"
                              style={{
                                left: `${bar.leftPct}%`,
                                backgroundColor: (task.portfolio as Portfolio)?.color || 'var(--brand)',
                              }}
                              title={task.title} />
                          )}

                          {/* Overdue extension */}
                          {bar.isOverdue && bar.overdueWidthPct > 0 && (
                            <div className="absolute top-2.5 h-3 rounded-sm opacity-40"
                              style={{
                                left: `${bar.leftPct + bar.widthPct}%`,
                                width: `${Math.min(bar.overdueWidthPct, 100 - bar.leftPct - bar.widthPct)}%`,
                                backgroundColor: 'var(--p-critical)',
                                backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.2) 6px)',
                              }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-1">
        <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-sm bg-brand" /><span className="text-2xs text-tx-muted">Task duration</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-sm opacity-40" style={{ backgroundColor: 'var(--p-critical)' }} /><span className="text-2xs text-tx-muted">Overdue</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rotate-45 rounded-sm bg-brand" style={{ transform: 'rotate(45deg) scale(0.6)' }} /><span className="text-2xs text-tx-muted">No duration</span></div>
        <div className="flex items-center gap-1.5"><div className="w-px h-3" style={{ backgroundColor: 'var(--p-critical)' }} /><span className="text-2xs text-tx-muted">Today</span></div>
      </div>
    </div>
  );
}
