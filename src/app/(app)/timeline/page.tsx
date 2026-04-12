'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Task, Portfolio, TaskStatus, Urgency, STATUS_CONFIG, URGENCY_CONFIG } from '@/types';
import { cn, formatDate } from '@/lib/utils';
import {
  addDays, addMonths, subMonths, startOfWeek, startOfMonth, endOfMonth,
  differenceInDays, format, parseISO, isToday, isBefore, isAfter,
  eachDayOfInterval, eachWeekOfInterval,
} from 'date-fns';
import Link from 'next/link';
import {
  Activity, CheckCircle2, AlertTriangle, Clock, ChevronDown, X,
  ChevronRight, ChevronLeft, CalendarDays, GanttChart,
} from 'lucide-react';

type ViewMode = 'gantt' | 'calendar';
type Zoom = 'week' | 'month' | 'quarter';
type GroupBy = 'portfolio' | 'status' | 'urgency' | 'none';

// ═══ GANTT HELPERS ═══
function getTimelineRange(zoom: Zoom) {
  const now = new Date();
  if (zoom === 'week') { const s = addDays(startOfWeek(now, { weekStartsOn: 1 }), -7); return { start: s, end: addDays(s, 28), days: 28 }; }
  if (zoom === 'month') { const s = addDays(startOfMonth(now), -7); return { start: s, end: addDays(s, 60), days: 60 }; }
  const s = addDays(startOfMonth(now), -14); return { start: s, end: addDays(s, 120), days: 120 };
}

function getDateHeaders(start: Date, end: Date, zoom: Zoom) {
  if (zoom === 'quarter') return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map(d => ({ date: d, label: format(d, 'MMM d'), sublabel: '', isToday: false, isWeekend: false }));
  return eachDayOfInterval({ start, end }).map(d => ({
    date: d, label: format(d, 'd'), sublabel: zoom === 'week' ? format(d, 'EEE') : (d.getDate() === 1 ? format(d, 'MMM') : ''),
    isToday: isToday(d), isWeekend: d.getDay() === 0 || d.getDay() === 6,
  }));
}

interface TaskGroup { key: string; label: string; color: string; tasks: Task[]; collapsed: boolean; }

export default function TimelinePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>('gantt');
  const [zoom, setZoom] = useState<Zoom>('month');
  const [groupBy, setGroupBy] = useState<GroupBy>('portfolio');
  const [filterPortfolios, setFilterPortfolios] = useState<string[]>([]);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  // Calendar state
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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
  const filtered = useMemo(() => {
    let r = [...tasks];
    if (filterPortfolios.length > 0) r = r.filter(t => t.portfolio_id && filterPortfolios.includes(t.portfolio_id));
    return r;
  }, [tasks, filterPortfolios]);

  const stats = useMemo(() => ({
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    overdue: tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length,
  }), [tasks, today]);

  // Gantt data
  const { start: timeStart, end: timeEnd, days: totalDays } = useMemo(() => getTimelineRange(zoom), [zoom]);
  const headers = useMemo(() => getDateHeaders(timeStart, timeEnd, zoom), [timeStart, timeEnd, zoom]);
  const todayPct = (differenceInDays(new Date(), timeStart) / totalDays) * 100;
  const colWidth = zoom === 'quarter' ? 80 : zoom === 'month' ? 28 : 40;
  const gridWidth = headers.length * colWidth;

  const groups: TaskGroup[] = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'All Tasks', color: 'var(--brand)', tasks: filtered, collapsed: false }];
    if (groupBy === 'portfolio') {
      const g = portfolios.map(p => ({ key: p.id, label: p.name.split('—')[0].trim(), color: p.color, tasks: filtered.filter(t => t.portfolio_id === p.id), collapsed: collapsedGroups.has(p.id) }));
      const u = filtered.filter(t => !t.portfolio_id);
      if (u.length) g.push({ key: 'none', label: 'No Portfolio', color: '#71717A', tasks: u, collapsed: collapsedGroups.has('none') });
      return g.filter(x => x.tasks.length > 0);
    }
    if (groupBy === 'status') return (['todo', 'in_progress', 'in_review', 'done'] as TaskStatus[]).map(s => ({ key: s, label: STATUS_CONFIG[s].label, color: STATUS_CONFIG[s].color, tasks: filtered.filter(t => t.status === s), collapsed: collapsedGroups.has(s) })).filter(x => x.tasks.length > 0);
    return (['critical', 'high', 'medium', 'low'] as Urgency[]).map(u => ({ key: u, label: URGENCY_CONFIG[u].label, color: URGENCY_CONFIG[u].color, tasks: filtered.filter(t => t.urgency === u), collapsed: collapsedGroups.has(u) })).filter(x => x.tasks.length > 0);
  }, [filtered, groupBy, portfolios, collapsedGroups]);

  function toggleGroup(key: string) { setCollapsedGroups(prev => { const n = new Set(prev); if (n.has(key)) { n.delete(key); } else { n.add(key); } return n; }); }
  function toggleMulti<T>(arr: T[], val: T, setter: (v: T[]) => void) { setter(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]); }

  function getBarStyle(task: Task) {
    const tS = task.start_date ? parseISO(task.start_date) : parseISO(task.created_at);
    const tE = task.due_date ? parseISO(task.due_date) : tS;
    const hasDuration = !!(task.start_date && task.due_date);
    const cS = isBefore(tS, timeStart) ? timeStart : tS;
    const cE = isAfter(tE, timeEnd) ? timeEnd : tE;
    const leftPct = Math.max((differenceInDays(cS, timeStart) / totalDays) * 100, 0);
    const widthPct = Math.min((Math.max(differenceInDays(cE, cS), 1) / totalDays) * 100, 100 - leftPct);
    const isOverdue = !!(task.due_date && task.due_date < today && task.status !== 'done');
    const overdueWidthPct = isOverdue ? (differenceInDays(new Date(), parseISO(task.due_date!)) / totalDays) * 100 : 0;
    return { leftPct, widthPct, hasDuration, isOverdue, overdueWidthPct };
  }

  // ═══ CALENDAR DATA ═══
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calMonth);
    const monthEnd = endOfMonth(calMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = addDays(startOfWeek(addDays(monthEnd, 7), { weekStartsOn: 1 }), -1);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [calMonth]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    filtered.forEach(t => {
      if (t.due_date) {
        const key = t.due_date;
        if (!map[key]) map[key] = [];
        map[key].push(t);
      }
    });
    return map;
  }, [filtered]);

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
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-tx-primary tracking-tight">Timeline</h1>
          {/* View Toggle */}
          <div className="flex items-center h-8 rounded-lg border border-border overflow-hidden">
            <button onClick={() => setViewMode('gantt')}
              className={cn('px-3 h-full text-sm font-medium flex items-center gap-1.5 transition-colors',
                viewMode === 'gantt' ? 'bg-brand text-tx-inverse' : 'bg-surface text-tx-secondary hover:bg-subtle')}>
              <GanttChart size={14} /> Gantt
            </button>
            <button onClick={() => setViewMode('calendar')}
              className={cn('px-3 h-full text-sm font-medium flex items-center gap-1.5 transition-colors',
                viewMode === 'calendar' ? 'bg-brand text-tx-inverse' : 'bg-surface text-tx-secondary hover:bg-subtle')}>
              <CalendarDays size={14} /> Calendar
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Portfolio filter */}
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

          {/* Gantt-only controls */}
          {viewMode === 'gantt' && (
            <>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}
                className="h-8 px-3 rounded-lg border border-border text-sm font-medium text-tx-secondary bg-surface appearance-none cursor-pointer">
                <option value="portfolio">Group: Portfolio</option>
                <option value="status">Group: Status</option>
                <option value="urgency">Group: Urgency</option>
                <option value="none">No grouping</option>
              </select>
              <div className="flex items-center h-8 rounded-lg border border-border overflow-hidden">
                {(['week', 'month', 'quarter'] as Zoom[]).map(z => (
                  <button key={z} onClick={() => setZoom(z)}
                    className={cn('px-3 h-full text-sm font-medium transition-colors capitalize',
                      zoom === z ? 'bg-brand text-tx-inverse' : 'bg-surface text-tx-secondary hover:bg-subtle')}>{z}</button>
                ))}
              </div>
            </>
          )}

          {/* Calendar-only controls */}
          {viewMode === 'calendar' && (
            <div className="flex items-center gap-2">
              <button onClick={() => setCalMonth(subMonths(calMonth, 1))} className="h-8 w-8 rounded-lg border border-border bg-surface flex items-center justify-center text-tx-secondary hover:bg-subtle">
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm font-semibold text-tx-primary w-[130px] text-center">{format(calMonth, 'MMMM yyyy')}</span>
              <button onClick={() => setCalMonth(addMonths(calMonth, 1))} className="h-8 w-8 rounded-lg border border-border bg-surface flex items-center justify-center text-tx-secondary hover:bg-subtle">
                <ChevronRight size={14} />
              </button>
              <button onClick={() => setCalMonth(new Date())} className="h-8 px-3 rounded-lg border border-border text-sm font-medium text-tx-secondary bg-surface hover:bg-subtle">Today</button>
            </div>
          )}

          {filterPortfolios.length > 0 && (
            <button onClick={() => setFilterPortfolios([])} className="h-8 px-2 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-subtle"><X size={14} /></button>
          )}
        </div>
      </div>

      {/* ═══ GANTT VIEW ═══ */}
      {viewMode === 'gantt' && (
        <>
          <div className="card-gradient rounded-xl overflow-hidden">
            <div className="flex">
              {/* Left: Task Names */}
              <div className="w-[220px] shrink-0 border-r border-border">
                <div className="h-12 border-b border-border px-3 flex items-center">
                  <span className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Tasks</span>
                </div>
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
                        className={cn('flex items-center gap-2 px-3 h-8 border-b border-border hover:bg-subtle/50 transition-colors', groupBy !== 'none' && 'pl-7')}
                        onMouseEnter={() => setHoveredTask(task.id)} onMouseLeave={() => setHoveredTask(null)}>
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_CONFIG[task.status].color }} />
                        <span className={cn('text-2xs text-tx-primary truncate', task.status === 'done' && 'line-through text-tx-muted')}>{task.title}</span>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>

              {/* Right: Timeline Grid */}
              <div className="flex-1 overflow-x-auto">
                <div style={{ minWidth: gridWidth }}>
                  <div className="h-12 border-b border-border flex">
                    {headers.map((h, i) => (
                      <div key={i} className={cn('flex flex-col items-center justify-center border-r border-border', h.isWeekend && 'bg-subtle/30')}
                        style={{ width: colWidth, minWidth: colWidth }}>
                        {h.sublabel && <span className="text-[9px] text-tx-muted font-medium">{h.sublabel}</span>}
                        <span className={cn('text-2xs font-medium', h.isToday ? 'text-brand font-bold' : 'text-tx-secondary')}>{h.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="relative">
                    {todayPct >= 0 && todayPct <= 100 && (
                      <div className="absolute top-0 bottom-0 w-px z-10" style={{ left: `${todayPct}%`, background: 'var(--p-critical)', opacity: 0.6 }}>
                        <div className="absolute -top-0 -left-[3px] w-[7px] h-[7px] rounded-full" style={{ background: 'var(--p-critical)' }} />
                      </div>
                    )}
                    {groups.map(group => (
                      <div key={group.key}>
                        {groupBy !== 'none' && <div className="h-8 border-b border-border bg-subtle/30" />}
                        {!group.collapsed && group.tasks.map(task => {
                          const bar = getBarStyle(task);
                          return (
                            <div key={task.id} className="h-8 border-b border-border relative"
                              onMouseEnter={() => setHoveredTask(task.id)} onMouseLeave={() => setHoveredTask(null)}>
                              {bar.hasDuration ? (
                                <Link href={`/tasks/${task.id}`}
                                  className={cn('absolute top-1.5 h-5 rounded-sm cursor-pointer transition-all', hoveredTask === task.id ? 'opacity-100 shadow-sm' : 'opacity-80')}
                                  style={{ left: `${bar.leftPct}%`, width: `${Math.max(bar.widthPct, 0.5)}%`, backgroundColor: task.status === 'done' ? STATUS_CONFIG[task.status].color : ((task.portfolio as Portfolio)?.color || 'var(--brand)') }}
                                  title={`${task.title}\n${task.start_date ? formatDate(task.start_date) : '?'} → ${task.due_date ? formatDate(task.due_date) : '?'}`}>
                                  <span className="text-[9px] font-medium text-white px-1 truncate block leading-5">{bar.widthPct > 3 ? task.title : ''}</span>
                                </Link>
                              ) : (
                                <Link href={`/tasks/${task.id}`} className="absolute top-2 w-3 h-3 rotate-45 rounded-sm cursor-pointer"
                                  style={{ left: `${bar.leftPct}%`, backgroundColor: (task.portfolio as Portfolio)?.color || 'var(--brand)' }} title={task.title} />
                              )}
                              {bar.isOverdue && bar.overdueWidthPct > 0 && (
                                <div className="absolute top-2.5 h-3 rounded-sm opacity-40"
                                  style={{ left: `${bar.leftPct + bar.widthPct}%`, width: `${Math.min(bar.overdueWidthPct, 100 - bar.leftPct - bar.widthPct)}%`, backgroundColor: 'var(--p-critical)', backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.2) 6px)' }} />
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
          <div className="flex items-center gap-4 mt-3 px-1">
            <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-sm bg-brand" /><span className="text-2xs text-tx-muted">Duration</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-sm opacity-40" style={{ backgroundColor: 'var(--p-critical)' }} /><span className="text-2xs text-tx-muted">Overdue</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rotate-45 rounded-sm bg-brand" /><span className="text-2xs text-tx-muted">No dates</span></div>
            <div className="flex items-center gap-1.5"><div className="w-px h-3" style={{ backgroundColor: 'var(--p-critical)' }} /><span className="text-2xs text-tx-muted">Today</span></div>
          </div>
        </>
      )}

      {/* ═══ CALENDAR VIEW ═══ */}
      {viewMode === 'calendar' && (
        <div className="card-gradient rounded-xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="py-2 text-center text-2xs font-semibold text-tx-muted uppercase tracking-widest border-r border-border last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayTasks = tasksByDate[dateStr] || [];
              const isCurrentMonth = day.getMonth() === calMonth.getMonth();
              const isTodayDate = isToday(day);

              return (
                <div key={i} className={cn(
                  'min-h-[100px] border-r border-b border-border p-1.5 transition-colors',
                  !isCurrentMonth && 'bg-subtle/30',
                  isTodayDate && 'bg-brand-subtle',
                )}>
                  {/* Date number */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                      isTodayDate ? 'bg-brand text-white font-bold' : isCurrentMonth ? 'text-tx-primary' : 'text-tx-muted'
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[9px] font-mono text-tx-muted">{dayTasks.length}</span>
                    )}
                  </div>

                  {/* Tasks */}
                  <div className="flex flex-col gap-0.5">
                    {dayTasks.slice(0, 3).map(task => {
                      const isOverdue = task.due_date && task.due_date < today && task.status !== 'done';
                      const portfolio = task.portfolio as Portfolio | undefined;
                      return (
                        <Link key={task.id} href={`/tasks/${task.id}`}
                          className={cn(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded truncate block transition-colors hover:opacity-80',
                            task.status === 'done' ? 'line-through opacity-50' : ''
                          )}
                          style={{
                            backgroundColor: isOverdue ? 'var(--p-critical-bg)' : (portfolio?.color ? portfolio.color + '20' : 'var(--bg-subtle)'),
                            color: isOverdue ? 'var(--p-critical)' : 'var(--text-primary)',
                            borderLeft: `2px solid ${isOverdue ? 'var(--p-critical)' : (portfolio?.color || 'var(--brand)')}`,
                          }}>
                          {task.title}
                        </Link>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <button onClick={() => setSelectedDay(dateStr)}
                        className="text-[9px] text-brand font-medium px-1.5 hover:underline text-left">
                        +{dayTasks.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Day popup */}
          {selectedDay && tasksByDate[selectedDay] && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedDay(null)}>
              <div className="bg-surface border border-border rounded-xl shadow-lg w-full max-w-[400px] mx-4 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div>
                    <h3 className="text-sm font-semibold text-tx-primary">{format(parseISO(selectedDay), 'EEEE, MMMM d')}</h3>
                    <p className="text-2xs text-tx-muted">{tasksByDate[selectedDay].length} tasks</p>
                  </div>
                  <button onClick={() => setSelectedDay(null)} className="p-1 rounded-md hover:bg-subtle text-tx-muted hover:text-tx-primary">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  <div className="flex flex-col gap-1">
                    {tasksByDate[selectedDay].map(task => {
                      const isOverdue = task.due_date && task.due_date < today && task.status !== 'done';
                      const portfolio = task.portfolio as Portfolio | undefined;
                      const urgCfg = URGENCY_CONFIG[task.urgency];
                      return (
                        <Link key={task.id} href={`/tasks/${task.id}`}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-subtle transition-colors',
                            task.status === 'done' && 'opacity-50'
                          )}>
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_CONFIG[task.status].color }} />
                          <div className="flex-1 min-w-0">
                            <span className={cn('text-sm text-tx-primary truncate block', task.status === 'done' && 'line-through')}>
                              {task.title}
                            </span>
                            {portfolio && (
                              <span className="text-2xs text-tx-muted">{portfolio.name.split('—')[0].trim()}</span>
                            )}
                          </div>
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md shrink-0"
                            style={{ backgroundColor: urgCfg.bg, color: urgCfg.color }}>
                            {urgCfg.label}
                          </span>
                          {isOverdue && (
                            <span className="text-[9px] font-bold text-[var(--p-critical)]">LATE</span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
