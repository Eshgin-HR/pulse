'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Task, Portfolio, TaskStatus, Urgency, STATUS_CONFIG, URGENCY_CONFIG } from '@/types';
import { cn, formatDate } from '@/lib/utils';
import { differenceInDays, parseISO, format, getDay, subDays, subWeeks, subMonths, isAfter, isBefore } from 'date-fns';
import {
  BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Clock,
  Sparkles, Send, Loader2, RefreshCw, PieChart, Activity,
  ChevronDown, X, ArrowLeftRight, Filter,
} from 'lucide-react';

type DateRange = 'this_week' | '2_weeks' | 'this_month' | '3_months' | 'all';
type CompareMode = 'none' | 'period' | 'portfolio';

function getDateCutoff(range: DateRange): Date | null {
  const now = new Date();
  if (range === 'this_week') return subDays(now, 7);
  if (range === '2_weeks') return subWeeks(now, 2);
  if (range === 'this_month') return subMonths(now, 1);
  if (range === '3_months') return subMonths(now, 3);
  return null;
}

function getPrevPeriodRange(range: DateRange): [Date, Date] | null {
  const now = new Date();
  if (range === 'this_week') return [subDays(now, 14), subDays(now, 7)];
  if (range === '2_weeks') return [subWeeks(now, 4), subWeeks(now, 2)];
  if (range === 'this_month') return [subMonths(now, 2), subMonths(now, 1)];
  if (range === '3_months') return [subMonths(now, 6), subMonths(now, 3)];
  return null;
}

function computeMetrics(taskList: Task[], today: string) {
  const total = taskList.length;
  const done = taskList.filter(t => t.status === 'done').length;
  const inProgress = taskList.filter(t => t.status === 'in_progress').length;
  const inReview = taskList.filter(t => t.status === 'in_review').length;
  const todo = taskList.filter(t => t.status === 'todo').length;
  const overdue = taskList.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length;
  const noDueDate = taskList.filter(t => !t.due_date && t.status !== 'done').length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
  const overdueRate = (total - done) > 0 ? Math.round((overdue / (total - done)) * 100) : 0;
  const completedWithDates = taskList.filter(t => t.status === 'done' && t.start_date && t.due_date);
  const avgDays = completedWithDates.length > 0
    ? Math.round(completedWithDates.reduce((s, t) => s + differenceInDays(parseISO(t.due_date!), parseISO(t.start_date!)), 0) / completedWithDates.length)
    : null;
  return { total, done, inProgress, inReview, todo, overdue, noDueDate, completionRate, overdueRate, avgDays };
}

export default function ReportsPage() {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [filterPortfolios, setFilterPortfolios] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<TaskStatus[]>([]);
  const [filterUrgencies, setFilterUrgencies] = useState<Urgency[]>([]);
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  // Comparison
  const [compareMode, setCompareMode] = useState<CompareMode>('none');
  const [comparePortfolioA, setComparePortfolioA] = useState('');
  const [comparePortfolioB, setComparePortfolioB] = useState('');

  // AI states
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiAnswerLoading, setAiAnswerLoading] = useState(false);
  const [sectionInsights, setSectionInsights] = useState<Record<string, string>>({});
  const [sectionLoading, setSectionLoading] = useState<Record<string, boolean>>({});

  // Bottlenecks
  const [bottlenecks, setBottlenecks] = useState<{ type: string; severity: string; title: string; detail: string; tasks?: string[] }[]>([]);
  const [bottleneckAi, setBottleneckAi] = useState('');
  const [bottleneckLoading, setBottleneckLoading] = useState(false);
  const [expandedBottleneck, setExpandedBottleneck] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from('tasks').select('*, portfolio:portfolios(*)').eq('is_archived', false).order('due_date', { ascending: true }),
        supabase.from('portfolios').select('*').eq('is_archived', false).order('sort_order'),
      ]);
      if (t) setAllTasks(t);
      if (p) {
        setPortfolios(p);
        if (p.length >= 2) { setComparePortfolioA(p[0].id); setComparePortfolioB(p[1].id); }
      }
      setLoading(false);
      // Auto-fetch bottlenecks
      fetchBottlenecks();
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchBottlenecks() {
    setBottleneckLoading(true);
    try {
      const res = await fetch('/api/ai/bottlenecks', { method: 'POST' });
      const data = await res.json();
      if (data.bottlenecks) setBottlenecks(data.bottlenecks);
      if (data.aiAnalysis) setBottleneckAi(data.aiAnalysis);
    } catch { /* ignore */ }
    setBottleneckLoading(false);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setOpenFilter(null);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const today = new Date().toISOString().split('T')[0];

  // Apply filters
  const filteredTasks = useMemo(() => {
    let result = [...allTasks];
    const cutoff = getDateCutoff(dateRange);
    if (cutoff) result = result.filter(t => t.created_at && isAfter(parseISO(t.created_at), cutoff));
    if (filterPortfolios.length > 0) result = result.filter(t => t.portfolio_id && filterPortfolios.includes(t.portfolio_id));
    if (filterStatuses.length > 0) result = result.filter(t => filterStatuses.includes(t.status));
    if (filterUrgencies.length > 0) result = result.filter(t => filterUrgencies.includes(t.urgency));
    return result;
  }, [allTasks, dateRange, filterPortfolios, filterStatuses, filterUrgencies]);

  // Previous period tasks for comparison
  const prevPeriodTasks = useMemo(() => {
    if (compareMode !== 'period' || dateRange === 'all') return [];
    const range = getPrevPeriodRange(dateRange);
    if (!range) return [];
    let result = allTasks.filter(t => t.created_at && isAfter(parseISO(t.created_at), range[0]) && isBefore(parseISO(t.created_at), range[1]));
    if (filterPortfolios.length > 0) result = result.filter(t => t.portfolio_id && filterPortfolios.includes(t.portfolio_id));
    if (filterStatuses.length > 0) result = result.filter(t => filterStatuses.includes(t.status));
    if (filterUrgencies.length > 0) result = result.filter(t => filterUrgencies.includes(t.urgency));
    return result;
  }, [allTasks, compareMode, dateRange, filterPortfolios, filterStatuses, filterUrgencies]);

  const metrics = useMemo(() => computeMetrics(filteredTasks, today), [filteredTasks, today]);
  const prevMetrics = useMemo(() => compareMode === 'period' ? computeMetrics(prevPeriodTasks, today) : null, [prevPeriodTasks, compareMode, today]);

  // Portfolio comparison
  const portfolioAMetrics = useMemo(() => {
    if (compareMode !== 'portfolio' || !comparePortfolioA) return null;
    return computeMetrics(filteredTasks.filter(t => t.portfolio_id === comparePortfolioA), today);
  }, [filteredTasks, compareMode, comparePortfolioA, today]);
  const portfolioBMetrics = useMemo(() => {
    if (compareMode !== 'portfolio' || !comparePortfolioB) return null;
    return computeMetrics(filteredTasks.filter(t => t.portfolio_id === comparePortfolioB), today);
  }, [filteredTasks, compareMode, comparePortfolioB, today]);

  const hasFilters = dateRange !== 'all' || filterPortfolios.length > 0 || filterStatuses.length > 0 || filterUrgencies.length > 0;

  function toggleMulti<T>(arr: T[], val: T, setter: (v: T[]) => void) {
    setter(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  }
  function clearFilters() {
    setDateRange('all'); setFilterPortfolios([]); setFilterStatuses([]); setFilterUrgencies([]); setCompareMode('none');
  }

  // Charts
  const statusDist = useMemo(() => (['todo', 'in_progress', 'in_review', 'done'] as const).map(s => ({
    status: s, count: filteredTasks.filter(t => t.status === s).length, config: STATUS_CONFIG[s],
  })), [filteredTasks]);

  const urgencyDist = useMemo(() => (['critical', 'high', 'medium', 'low'] as const).map(u => ({
    urgency: u, count: filteredTasks.filter(t => t.status !== 'done' && t.urgency === u).length, config: URGENCY_CONFIG[u],
  })), [filteredTasks]);

  const portfolioHealth = useMemo(() => portfolios.map(p => {
    const pTasks = filteredTasks.filter(t => t.portfolio_id === p.id);
    const done = pTasks.filter(t => t.status === 'done').length;
    const overdue = pTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length;
    const inProg = pTasks.filter(t => t.status === 'in_progress').length;
    const total = pTasks.length;
    return { ...p, total, done, overdue, inProg, pct: total > 0 ? Math.round((done / total) * 100) : 0, risk: total > 0 ? Math.round(((overdue * 3) / total) * 100) : 0 };
  }).sort((a, b) => b.risk - a.risk), [filteredTasks, portfolios, today]);

  const dayPatterns = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const created = new Array(7).fill(0);
    const completed = new Array(7).fill(0);
    filteredTasks.forEach(t => {
      created[getDay(parseISO(t.created_at))]++;
      if (t.status === 'done') completed[getDay(parseISO(t.updated_at))]++;
    });
    return days.map((n, i) => ({ name: n, created: created[i], completed: completed[i] }));
  }, [filteredTasks]);

  const overdueAging = useMemo(() => filteredTasks
    .filter(t => t.due_date && t.due_date < today && t.status !== 'done')
    .map(t => ({ ...t, daysOverdue: differenceInDays(new Date(), parseISO(t.due_date!)) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue), [filteredTasks, today]);

  const maxBar = Math.max(...urgencyDist.map(u => u.count), 1);
  const maxStatusBar = Math.max(...statusDist.map(s => s.count), 1);
  const maxDayBar = Math.max(...dayPatterns.map(d => Math.max(d.created, d.completed)), 1);

  // AI functions
  const fetchAiSummary = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'summary' }) });
      const data = await res.json();
      setAiSummary(data.response || '');
    } catch { setAiSummary('Failed.'); }
    setAiLoading(false);
  }, []);

  useEffect(() => { if (!loading && allTasks.length > 0 && !aiSummary) fetchAiSummary(); }, [loading, allTasks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchSectionInsight(section: string) {
    setSectionLoading(p => ({ ...p, [section]: true }));
    try {
      const res = await fetch('/api/ai/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'section', message: section }) });
      const data = await res.json();
      setSectionInsights(p => ({ ...p, [section]: data.response || '' }));
    } catch { setSectionInsights(p => ({ ...p, [section]: 'Failed.' })); }
    setSectionLoading(p => ({ ...p, [section]: false }));
  }

  async function askAi() {
    if (!aiQuestion.trim()) return;
    setAiAnswerLoading(true);
    try {
      const res = await fetch('/api/ai/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'question', message: aiQuestion }) });
      const data = await res.json();
      setAiAnswer(data.response || '');
    } catch { setAiAnswer('Failed.'); }
    setAiAnswerLoading(false);
  }

  function SectionInsight({ section }: { section: string }) {
    const insight = sectionInsights[section];
    const isL = sectionLoading[section];
    return (
      <div className="mt-3 pt-3 border-t border-border">
        {insight ? (
          <div className="flex items-start gap-2"><Sparkles size={12} className="text-brand shrink-0 mt-0.5" /><p className="text-2xs text-tx-secondary leading-relaxed">{insight}</p></div>
        ) : (
          <button onClick={() => fetchSectionInsight(section)} disabled={isL} className="flex items-center gap-1.5 text-2xs text-tx-muted hover:text-brand transition-colors">
            {isL ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}{isL ? 'Analyzing...' : 'Get AI insight'}
          </button>
        )}
      </div>
    );
  }

  function Delta({ current, prev, suffix = '' }: { current: number; prev: number; suffix?: string }) {
    const diff = current - prev;
    if (diff === 0) return <span className="text-2xs text-tx-muted">→ no change</span>;
    return (
      <span className={cn('text-2xs font-medium', diff > 0 ? 'text-[var(--s-done)]' : 'text-[var(--p-critical)]')}>
        {diff > 0 ? '↑' : '↓'} {Math.abs(diff)}{suffix}
      </span>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  const dateRangeOptions: { value: DateRange; label: string }[] = [
    { value: 'all', label: 'All time' }, { value: 'this_week', label: 'This week' },
    { value: '2_weeks', label: '2 weeks' }, { value: 'this_month', label: 'This month' }, { value: '3_months', label: '3 months' },
  ];

  return (
    <div className="max-w-[1100px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-tx-primary tracking-tight">Reports & Insights</h1>
          <p className="text-sm text-tx-muted mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
      </div>

      {/* ═══ FILTER BAR ═══ */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter size={14} className="text-tx-muted" />

        {/* Date Range */}
        <div className="relative" data-dropdown onClick={e => e.stopPropagation()}>
          <button onClick={() => setOpenFilter(openFilter === 'date' ? null : 'date')}
            className={cn('h-8 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors',
              dateRange !== 'all' ? 'border-brand text-brand bg-brand-subtle' : 'border-border text-tx-secondary bg-surface hover:bg-subtle')}>
            {dateRangeOptions.find(o => o.value === dateRange)?.label} <ChevronDown size={12} />
          </button>
          {openFilter === 'date' && (
            <div className="absolute top-10 left-0 z-50 bg-surface border border-border rounded-xl shadow-lg py-1 w-[150px]">
              {dateRangeOptions.map(o => (
                <button key={o.value} onClick={() => { setDateRange(o.value); setOpenFilter(null); }}
                  className={cn('w-full text-left px-3 py-1.5 text-sm hover:bg-subtle transition-colors', dateRange === o.value ? 'text-brand font-medium' : 'text-tx-secondary')}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Portfolio multi-select */}
        <div className="relative" data-dropdown onClick={e => e.stopPropagation()}>
          <button onClick={() => setOpenFilter(openFilter === 'portfolio' ? null : 'portfolio')}
            className={cn('h-8 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors',
              filterPortfolios.length > 0 ? 'border-brand text-brand bg-brand-subtle' : 'border-border text-tx-secondary bg-surface hover:bg-subtle')}>
            Portfolio {filterPortfolios.length > 0 && `(${filterPortfolios.length})`} <ChevronDown size={12} />
          </button>
          {openFilter === 'portfolio' && (
            <div className="absolute top-10 left-0 z-50 bg-surface border border-border rounded-xl shadow-lg py-2 w-[220px]">
              {portfolios.map(p => (
                <button key={p.id} onClick={() => toggleMulti(filterPortfolios, p.id, setFilterPortfolios)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-subtle transition-colors">
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

        {/* Status multi-select */}
        <div className="relative" data-dropdown onClick={e => e.stopPropagation()}>
          <button onClick={() => setOpenFilter(openFilter === 'status' ? null : 'status')}
            className={cn('h-8 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors',
              filterStatuses.length > 0 ? 'border-brand text-brand bg-brand-subtle' : 'border-border text-tx-secondary bg-surface hover:bg-subtle')}>
            Status {filterStatuses.length > 0 && `(${filterStatuses.length})`} <ChevronDown size={12} />
          </button>
          {openFilter === 'status' && (
            <div className="absolute top-10 left-0 z-50 bg-surface border border-border rounded-xl shadow-lg py-2 w-[180px]">
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <button key={k} onClick={() => toggleMulti(filterStatuses, k as TaskStatus, setFilterStatuses)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-subtle transition-colors">
                  <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center', filterStatuses.includes(k as TaskStatus) ? 'border-brand bg-brand' : 'border-border')}>
                    {filterStatuses.includes(k as TaskStatus) && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                  </div>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} /><span className="text-tx-primary">{v.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Urgency multi-select */}
        <div className="relative" data-dropdown onClick={e => e.stopPropagation()}>
          <button onClick={() => setOpenFilter(openFilter === 'urgency' ? null : 'urgency')}
            className={cn('h-8 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors',
              filterUrgencies.length > 0 ? 'border-brand text-brand bg-brand-subtle' : 'border-border text-tx-secondary bg-surface hover:bg-subtle')}>
            Urgency {filterUrgencies.length > 0 && `(${filterUrgencies.length})`} <ChevronDown size={12} />
          </button>
          {openFilter === 'urgency' && (
            <div className="absolute top-10 left-0 z-50 bg-surface border border-border rounded-xl shadow-lg py-2 w-[180px]">
              {Object.entries(URGENCY_CONFIG).map(([k, v]) => (
                <button key={k} onClick={() => toggleMulti(filterUrgencies, k as Urgency, setFilterUrgencies)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-subtle transition-colors">
                  <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center', filterUrgencies.includes(k as Urgency) ? 'border-brand bg-brand' : 'border-border')}>
                    {filterUrgencies.includes(k as Urgency) && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                  </div>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} /><span className="text-tx-primary">{v.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Compare toggle */}
        <div className="relative" data-dropdown onClick={e => e.stopPropagation()}>
          <button onClick={() => setOpenFilter(openFilter === 'compare' ? null : 'compare')}
            className={cn('h-8 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors',
              compareMode !== 'none' ? 'border-brand text-brand bg-brand-subtle' : 'border-border text-tx-secondary bg-surface hover:bg-subtle')}>
            <ArrowLeftRight size={13} /> Compare <ChevronDown size={12} />
          </button>
          {openFilter === 'compare' && (
            <div className="absolute top-10 left-0 z-50 bg-surface border border-border rounded-xl shadow-lg py-2 w-[200px]">
              {[
                { value: 'none' as CompareMode, label: 'No comparison' },
                { value: 'period' as CompareMode, label: 'vs Previous period' },
                { value: 'portfolio' as CompareMode, label: 'Portfolio A vs B' },
              ].map(o => (
                <button key={o.value} onClick={() => { setCompareMode(o.value); setOpenFilter(null); }}
                  className={cn('w-full text-left px-3 py-1.5 text-sm hover:bg-subtle transition-colors', compareMode === o.value ? 'text-brand font-medium' : 'text-tx-secondary')}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {hasFilters && (
          <button onClick={clearFilters} className="h-8 px-3 rounded-lg text-sm font-medium text-tx-muted hover:text-tx-primary hover:bg-subtle transition-colors flex items-center gap-1">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Portfolio comparison selectors */}
      {compareMode === 'portfolio' && (
        <div className="flex items-center gap-3 mb-4 p-3 card-gradient rounded-xl">
          <span className="text-2xs font-semibold text-tx-muted uppercase tracking-widest">Compare:</span>
          <select value={comparePortfolioA} onChange={e => setComparePortfolioA(e.target.value)}
            className="h-8 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary appearance-none">
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.name.split('—')[0].trim()}</option>)}
          </select>
          <ArrowLeftRight size={14} className="text-tx-muted" />
          <select value={comparePortfolioB} onChange={e => setComparePortfolioB(e.target.value)}
            className="h-8 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary appearance-none">
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.name.split('—')[0].trim()}</option>)}
          </select>
        </div>
      )}

      {/* ═══ AI SUMMARY ═══ */}
      <div className="card-gradient rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Sparkles size={14} className="text-brand" /><h2 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">AI Summary</h2></div>
          <button onClick={fetchAiSummary} disabled={aiLoading} className="p-1.5 rounded-md hover:bg-subtle text-tx-muted"><RefreshCw size={13} className={aiLoading ? 'animate-spin' : ''} /></button>
        </div>
        {aiLoading ? <div className="flex items-center gap-2 py-4"><Loader2 size={14} className="animate-spin text-brand" /><span className="text-sm text-tx-muted">Analyzing...</span></div>
          : <p className="text-sm text-tx-primary leading-relaxed">{aiSummary}</p>}
      </div>

      {/* ═══ BOTTLENECKS ═══ */}
      <div className="card-gradient rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-[var(--p-critical)]" />
            <h2 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Bottleneck Detection</h2>
          </div>
          <button onClick={fetchBottlenecks} disabled={bottleneckLoading}
            className="p-1.5 rounded-md hover:bg-subtle text-tx-muted hover:text-tx-primary transition-colors">
            <RefreshCw size={13} className={bottleneckLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {bottleneckLoading ? (
          <div className="flex items-center gap-2 py-6"><Loader2 size={14} className="animate-spin text-brand" /><span className="text-sm text-tx-muted">Scanning for bottlenecks...</span></div>
        ) : bottlenecks.length === 0 ? (
          <div className="py-6 text-center"><CheckCircle2 size={20} className="text-[var(--s-done)] mx-auto mb-2" /><p className="text-sm text-tx-muted">No bottlenecks detected. Nice work.</p></div>
        ) : (
          <>
            {/* AI Diagnosis */}
            {bottleneckAi && (
              <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-brand-subtle">
                <Sparkles size={13} className="text-brand shrink-0 mt-0.5" />
                <p className="text-sm text-tx-primary leading-relaxed">{bottleneckAi}</p>
              </div>
            )}

            {/* Bottleneck Cards */}
            <div className="flex flex-col gap-2">
              {bottlenecks.map((b, i) => (
                <div key={i} className={cn(
                  'rounded-lg border p-3 transition-colors',
                  b.severity === 'critical' ? 'border-[var(--p-critical)]/30 bg-[var(--p-critical-bg)]' :
                  b.severity === 'high' ? 'border-[var(--p-high)]/30 bg-[var(--p-high-bg)]' :
                  'border-border bg-subtle/50'
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('text-2xs font-bold uppercase px-1.5 py-0.5 rounded',
                          b.severity === 'critical' ? 'bg-[var(--p-critical)] text-white' :
                          b.severity === 'high' ? 'bg-[var(--p-high)] text-white' :
                          'bg-tx-muted text-white'
                        )}>{b.severity}</span>
                        <span className="text-sm font-semibold text-tx-primary">{b.title}</span>
                      </div>
                      <p className="text-2xs text-tx-secondary leading-relaxed">{b.detail}</p>
                    </div>
                    {b.tasks && b.tasks.length > 0 && (
                      <button onClick={() => setExpandedBottleneck(expandedBottleneck === i ? null : i)}
                        className="text-2xs text-tx-muted hover:text-brand transition-colors shrink-0">
                        {expandedBottleneck === i ? 'Hide' : `${b.tasks.length} tasks`}
                      </button>
                    )}
                  </div>
                  {expandedBottleneck === i && b.tasks && (
                    <div className="mt-2 pt-2 border-t border-border/50 flex flex-col gap-1">
                      {b.tasks.map((t, j) => (
                        <span key={j} className="text-2xs text-tx-secondary">• {t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ═══ KPI CARDS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Completion', value: `${metrics.completionRate}%`, prev: prevMetrics?.completionRate, icon: CheckCircle2, color: 'var(--s-done)', suffix: '%' },
          { label: 'Overdue Rate', value: `${metrics.overdueRate}%`, prev: prevMetrics?.overdueRate, icon: AlertTriangle, color: metrics.overdueRate > 20 ? 'var(--p-critical)' : undefined, suffix: '%', invertDelta: true },
          { label: 'Active', value: `${metrics.total - metrics.done}`, prev: prevMetrics ? prevMetrics.total - prevMetrics.done : undefined, icon: Activity, useTP: true },
          { label: 'Avg Days', value: metrics.avgDays !== null ? `${metrics.avgDays}d` : '—', prev: prevMetrics?.avgDays ?? undefined, icon: Clock, useTP: true, suffix: 'd' },
        ].map(kpi => (
          <div key={kpi.label} className="card-gradient rounded-xl px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xs font-medium text-tx-muted uppercase tracking-widest">{kpi.label}</span>
              <kpi.icon size={13} className="text-tx-muted/60" />
            </div>
            <div className="flex items-end gap-2">
              <p className={cn("text-2xl font-semibold font-mono", kpi.useTP && "text-tx-primary")} style={kpi.color ? { color: kpi.color } : undefined}>{kpi.value}</p>
              {compareMode === 'period' && kpi.prev !== undefined && (
                <Delta current={parseInt(kpi.value) || 0} prev={kpi.prev} suffix={kpi.suffix} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ═══ PORTFOLIO COMPARISON ═══ */}
      {compareMode === 'portfolio' && portfolioAMetrics && portfolioBMetrics && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          {[{ name: portfolios.find(p => p.id === comparePortfolioA)?.name || 'A', m: portfolioAMetrics },
            { name: portfolios.find(p => p.id === comparePortfolioB)?.name || 'B', m: portfolioBMetrics }].map(side => (
            <div key={side.name} className="card-gradient rounded-xl p-5">
              <h3 className="text-sm font-semibold text-tx-primary mb-3 truncate">{side.name.split('—')[0].trim()}</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Tasks', value: side.m.total },
                  { label: 'Done', value: side.m.done, color: 'var(--s-done)' },
                  { label: 'Overdue', value: side.m.overdue, color: side.m.overdue > 0 ? 'var(--p-critical)' : undefined },
                  { label: 'Completion', value: `${side.m.completionRate}%`, color: 'var(--s-done)' },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-2xs text-tx-muted">{item.label}</p>
                    <p className="text-lg font-semibold font-mono text-tx-primary" style={item.color ? { color: item.color } : undefined}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Status */}
        <div className="card-gradient rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4"><PieChart size={14} className="text-tx-muted" /><h3 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Status Breakdown</h3></div>
          <div className="flex flex-col gap-2.5">
            {statusDist.map(s => (
              <div key={s.status} className="flex items-center gap-3">
                <span className="text-2xs font-medium text-tx-secondary w-[80px]">{s.config.label}</span>
                <div className="flex-1 h-6 bg-subtle rounded-md overflow-hidden">
                  <div className="h-full rounded-md flex items-center px-2" style={{ width: `${Math.max((s.count / maxStatusBar) * 100, 8)}%`, backgroundColor: s.config.color }}>
                    <span className="text-[10px] font-bold text-white">{s.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <SectionInsight section="Status distribution" />
        </div>

        {/* Urgency */}
        <div className="card-gradient rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4"><AlertTriangle size={14} className="text-tx-muted" /><h3 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Urgency Distribution</h3></div>
          <div className="flex flex-col gap-2.5">
            {urgencyDist.map(u => (
              <div key={u.urgency} className="flex items-center gap-3">
                <span className="text-2xs font-medium text-tx-secondary w-[80px] capitalize">{u.config.label}</span>
                <div className="flex-1 h-6 bg-subtle rounded-md overflow-hidden">
                  <div className="h-full rounded-md flex items-center px-2" style={{ width: `${Math.max((u.count / maxBar) * 100, 8)}%`, backgroundColor: u.config.color }}>
                    <span className="text-[10px] font-bold text-white">{u.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <SectionInsight section="Urgency distribution" />
        </div>
      </div>

      {/* Portfolio Health */}
      <div className="card-gradient rounded-xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-4"><BarChart3 size={14} className="text-tx-muted" /><h3 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Portfolio Health</h3></div>
        <div className="flex flex-col gap-3">
          {portfolioHealth.map(p => (
            <div key={p.id} className="flex items-center gap-4">
              <div className="w-[160px] shrink-0">
                <p className="text-sm font-medium text-tx-primary truncate">{p.name.split('—')[0].trim()}</p>
                <p className="text-2xs text-tx-muted">{p.total} tasks · {p.done} done · {p.overdue} overdue</p>
              </div>
              <div className="flex-1">
                <div className="h-5 bg-subtle rounded-md overflow-hidden flex">
                  <div className="h-full" style={{ width: `${p.pct}%`, backgroundColor: 'var(--s-done)' }} />
                  <div className="h-full" style={{ width: `${p.total > 0 ? Math.round((p.inProg / p.total) * 100) : 0}%`, backgroundColor: 'var(--s-inprogress)' }} />
                  {p.overdue > 0 && <div className="h-full" style={{ width: `${p.total > 0 ? Math.round((p.overdue / p.total) * 100) : 0}%`, backgroundColor: 'var(--p-critical)' }} />}
                </div>
              </div>
              <span className="w-[50px] text-right text-sm font-semibold font-mono text-tx-primary">{p.pct}%</span>
            </div>
          ))}
        </div>
        <SectionInsight section="Portfolio health" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Day patterns */}
        <div className="card-gradient rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4"><TrendingUp size={14} className="text-tx-muted" /><h3 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Day of Week</h3></div>
          <div className="flex items-end gap-1.5 h-[120px]">
            {dayPatterns.map(d => (
              <div key={d.name} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center gap-0.5" style={{ height: 90 }}>
                  <div className="w-full rounded-sm" style={{ height: `${Math.max((d.created / maxDayBar) * 80, 4)}px`, backgroundColor: 'var(--s-inprogress)', marginTop: 'auto' }} />
                  <div className="w-full rounded-sm" style={{ height: `${Math.max((d.completed / maxDayBar) * 80, 4)}px`, backgroundColor: 'var(--s-done)' }} />
                </div>
                <span className="text-[10px] text-tx-muted font-medium">{d.name}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--s-inprogress)' }} /><span className="text-2xs text-tx-muted">Created</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--s-done)' }} /><span className="text-2xs text-tx-muted">Completed</span></div>
          </div>
          <SectionInsight section="Day of week patterns" />
        </div>

        {/* Overdue aging */}
        <div className="card-gradient rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4"><AlertTriangle size={14} className="text-tx-muted" /><h3 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Overdue Aging</h3></div>
          {overdueAging.length === 0 ? (
            <div className="py-8 text-center"><CheckCircle2 size={20} className="text-tx-muted mx-auto mb-2" /><p className="text-sm text-tx-muted">No overdue tasks</p></div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
              {overdueAging.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-1.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--p-critical-bg)' }}>
                    <span className="text-xs font-bold font-mono" style={{ color: 'var(--p-critical)' }}>{t.daysOverdue}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-tx-primary truncate">{t.title}</p>
                    <p className="text-2xs text-tx-muted">{t.portfolio?.name?.split('—')[0].trim() || '—'} · Due {formatDate(t.due_date)}</p>
                  </div>
                  <span className="text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-md shrink-0" style={{ backgroundColor: URGENCY_CONFIG[t.urgency].bg, color: URGENCY_CONFIG[t.urgency].color }}>{t.urgency}</span>
                </div>
              ))}
            </div>
          )}
          <SectionInsight section="Overdue aging" />
        </div>
      </div>

      {/* Ask AI */}
      <div className="card-gradient rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4"><Sparkles size={14} className="text-brand" /><h3 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Ask AI About Your Data</h3></div>
        <div className="flex gap-2">
          <input type="text" value={aiQuestion} onChange={e => setAiQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAi()}
            placeholder="e.g. Which portfolio is most at risk? What should I prioritize?" className="flex-1 h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-border-focus" />
          <button onClick={askAi} disabled={aiAnswerLoading || !aiQuestion.trim()} className="h-9 px-4 rounded-lg bg-brand text-tx-inverse text-sm font-semibold hover:bg-brand-hover disabled:opacity-40">
            {aiAnswerLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        {aiAnswer && (
          <div className="mt-4 p-4 bg-subtle rounded-lg"><div className="flex items-start gap-2"><Sparkles size={12} className="text-brand shrink-0 mt-1" /><p className="text-sm text-tx-primary leading-relaxed whitespace-pre-line">{aiAnswer}</p></div></div>
        )}
      </div>
    </div>
  );
}
