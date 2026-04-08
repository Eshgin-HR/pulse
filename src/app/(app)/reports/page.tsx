'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Task, Portfolio, STATUS_CONFIG, URGENCY_CONFIG } from '@/types';
import { cn, formatDate } from '@/lib/utils';
import { differenceInDays, parseISO, format, getDay } from 'date-fns';
import {
  BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Clock,
  Sparkles, Send, Loader2, RefreshCw, PieChart, Activity,
} from 'lucide-react';

export default function ReportsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);

  // AI states
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiAnswerLoading, setAiAnswerLoading] = useState(false);
  const [sectionInsights, setSectionInsights] = useState<Record<string, string>>({});
  const [sectionLoading, setSectionLoading] = useState<Record<string, boolean>>({});

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

  // Generate AI summary on load
  useEffect(() => {
    if (!loading && tasks.length > 0 && !aiSummary) { // eslint-disable-line react-hooks/exhaustive-deps
      fetchAiSummary();
    }
  }, [loading, tasks.length]);

  async function fetchAiSummary() {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'summary' }),
      });
      const data = await res.json();
      setAiSummary(data.response || '');
    } catch { setAiSummary('Failed to generate summary.'); }
    setAiLoading(false);
  }

  async function fetchSectionInsight(section: string) {
    setSectionLoading(prev => ({ ...prev, [section]: true }));
    try {
      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'section', message: section }),
      });
      const data = await res.json();
      setSectionInsights(prev => ({ ...prev, [section]: data.response || '' }));
    } catch {
      setSectionInsights(prev => ({ ...prev, [section]: 'Failed to generate insight.' }));
    }
    setSectionLoading(prev => ({ ...prev, [section]: false }));
  }

  async function askAi() {
    if (!aiQuestion.trim()) return;
    setAiAnswerLoading(true);
    try {
      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'question', message: aiQuestion }),
      });
      const data = await res.json();
      setAiAnswer(data.response || '');
    } catch { setAiAnswer('Failed to get answer.'); }
    setAiAnswerLoading(false);
  }

  const today = new Date().toISOString().split('T')[0];

  // ═══ COMPUTED METRICS ═══
  const metrics = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const inReview = tasks.filter(t => t.status === 'in_review').length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const overdue = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length;
    const noDueDate = tasks.filter(t => !t.due_date && t.status !== 'done').length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const overdueRate = (total - done) > 0 ? Math.round((overdue / (total - done)) * 100) : 0;

    // Avg days to complete (for done tasks with both start and due dates)
    const completedWithDates = tasks.filter(t => t.status === 'done' && t.start_date && t.due_date);
    const avgDays = completedWithDates.length > 0
      ? Math.round(completedWithDates.reduce((sum, t) => sum + differenceInDays(parseISO(t.due_date!), parseISO(t.start_date!)), 0) / completedWithDates.length)
      : null;

    return { total, done, inProgress, inReview, todo, overdue, noDueDate, completionRate, overdueRate, avgDays };
  }, [tasks, today]);

  // Portfolio health
  const portfolioHealth = useMemo(() => {
    return portfolios.map(p => {
      const pTasks = tasks.filter(t => t.portfolio_id === p.id);
      const done = pTasks.filter(t => t.status === 'done').length;
      const overdue = pTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length;
      const inProgress = pTasks.filter(t => t.status === 'in_progress').length;
      const total = pTasks.length;
      const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;
      const riskScore = total > 0 ? Math.round(((overdue * 3 + (total - done - inProgress)) / total) * 100) : 0;
      return { ...p, total, done, overdue, inProgress, completionPct, riskScore };
    }).sort((a, b) => b.riskScore - a.riskScore);
  }, [tasks, portfolios, today]);

  // Urgency distribution
  const urgencyDist = useMemo(() => {
    const active = tasks.filter(t => t.status !== 'done');
    return (['critical', 'high', 'medium', 'low'] as const).map(u => ({
      urgency: u,
      count: active.filter(t => t.urgency === u).length,
      config: URGENCY_CONFIG[u],
    }));
  }, [tasks]);

  // Status distribution
  const statusDist = useMemo(() => {
    return (['todo', 'in_progress', 'in_review', 'done'] as const).map(s => ({
      status: s,
      count: tasks.filter(t => t.status === s).length,
      config: STATUS_CONFIG[s],
    }));
  }, [tasks]);

  // Day of week patterns
  const dayPatterns = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const created = new Array(7).fill(0);
    const completed = new Array(7).fill(0);
    tasks.forEach(t => {
      const cDay = getDay(parseISO(t.created_at));
      created[cDay]++;
      if (t.status === 'done') {
        const dDay = getDay(parseISO(t.updated_at));
        completed[dDay]++;
      }
    });
    return days.map((name, i) => ({ name, created: created[i], completed: completed[i] }));
  }, [tasks]);

  // Overdue aging
  const overdueAging = useMemo(() => {
    return tasks
      .filter(t => t.due_date && t.due_date < today && t.status !== 'done')
      .map(t => ({
        ...t,
        daysOverdue: differenceInDays(new Date(), parseISO(t.due_date!)),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [tasks, today]);

  const maxBar = Math.max(...urgencyDist.map(u => u.count), 1);
  const maxStatusBar = Math.max(...statusDist.map(s => s.count), 1);
  const maxDayBar = Math.max(...dayPatterns.map(d => Math.max(d.created, d.completed)), 1);

  function SectionInsight({ section }: { section: string }) {
    const insight = sectionInsights[section];
    const isLoading = sectionLoading[section];
    return (
      <div className="mt-3 pt-3 border-t border-border">
        {insight ? (
          <div className="flex items-start gap-2">
            <Sparkles size={12} className="text-brand shrink-0 mt-0.5" />
            <p className="text-2xs text-tx-secondary leading-relaxed">{insight}</p>
          </div>
        ) : (
          <button
            onClick={() => fetchSectionInsight(section)}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-2xs text-tx-muted hover:text-brand transition-colors"
          >
            {isLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {isLoading ? 'Analyzing...' : 'Get AI insight'}
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1100px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-tx-primary tracking-tight">Reports & Insights</h1>
          <p className="text-sm text-tx-muted mt-0.5">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
      </div>

      {/* ═══ AI EXECUTIVE SUMMARY ═══ */}
      <div className="card-gradient rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-brand" />
            <h2 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">AI Summary</h2>
          </div>
          <button onClick={fetchAiSummary} disabled={aiLoading}
            className="p-1.5 rounded-md hover:bg-subtle text-tx-muted hover:text-tx-primary transition-colors">
            <RefreshCw size={13} className={aiLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        {aiLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 size={14} className="animate-spin text-brand" />
            <span className="text-sm text-tx-muted">Analyzing workspace...</span>
          </div>
        ) : (
          <p className="text-sm text-tx-primary leading-relaxed">{aiSummary}</p>
        )}
      </div>

      {/* ═══ KPI CARDS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Completion Rate', value: `${metrics.completionRate}%`, icon: CheckCircle2, color: 'var(--s-done)' },
          { label: 'Overdue Rate', value: `${metrics.overdueRate}%`, icon: AlertTriangle, color: metrics.overdueRate > 20 ? 'var(--p-critical)' : 'var(--text-primary)' },
          { label: 'Active Tasks', value: `${metrics.total - metrics.done}`, icon: Activity, useTextPrimary: true },
          { label: 'Avg Days', value: metrics.avgDays !== null ? `${metrics.avgDays}d` : '—', icon: Clock, useTextPrimary: true },
        ].map(kpi => (
          <div key={kpi.label} className="card-gradient rounded-xl px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xs font-medium text-tx-muted uppercase tracking-widest">{kpi.label}</span>
              <kpi.icon size={13} className="text-tx-muted/60" />
            </div>
            <p className={cn("text-2xl font-semibold font-mono", kpi.useTextPrimary && "text-tx-primary")}
              style={kpi.color ? { color: kpi.color } : undefined}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* ═══ STATUS BREAKDOWN ═══ */}
        <div className="card-gradient rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart size={14} className="text-tx-muted" />
            <h3 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Status Breakdown</h3>
          </div>
          <div className="flex flex-col gap-2.5">
            {statusDist.map(s => (
              <div key={s.status} className="flex items-center gap-3">
                <span className="text-2xs font-medium text-tx-secondary w-[80px]">{s.config.label}</span>
                <div className="flex-1 h-6 bg-subtle rounded-md overflow-hidden">
                  <div className="h-full rounded-md transition-all flex items-center px-2"
                    style={{ width: `${Math.max((s.count / maxStatusBar) * 100, 8)}%`, backgroundColor: s.config.color }}>
                    <span className="text-[10px] font-bold text-white">{s.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <SectionInsight section="Status distribution" />
        </div>

        {/* ═══ URGENCY DISTRIBUTION ═══ */}
        <div className="card-gradient rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={14} className="text-tx-muted" />
            <h3 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Urgency Distribution</h3>
          </div>
          <div className="flex flex-col gap-2.5">
            {urgencyDist.map(u => (
              <div key={u.urgency} className="flex items-center gap-3">
                <span className="text-2xs font-medium text-tx-secondary w-[80px] capitalize">{u.config.label}</span>
                <div className="flex-1 h-6 bg-subtle rounded-md overflow-hidden">
                  <div className="h-full rounded-md transition-all flex items-center px-2"
                    style={{ width: `${Math.max((u.count / maxBar) * 100, 8)}%`, backgroundColor: u.config.color }}>
                    <span className="text-[10px] font-bold text-white">{u.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <SectionInsight section="Urgency distribution" />
        </div>
      </div>

      {/* ═══ PORTFOLIO HEALTH ═══ */}
      <div className="card-gradient rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={14} className="text-tx-muted" />
          <h3 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Portfolio Health</h3>
        </div>
        <div className="flex flex-col gap-3">
          {portfolioHealth.map(p => (
            <div key={p.id} className="flex items-center gap-4">
              <div className="w-[160px] shrink-0">
                <p className="text-sm font-medium text-tx-primary truncate">{p.name.split('—')[0].trim()}</p>
                <p className="text-2xs text-tx-muted">{p.total} tasks · {p.done} done · {p.overdue} overdue</p>
              </div>
              <div className="flex-1">
                <div className="h-5 bg-subtle rounded-md overflow-hidden flex">
                  <div className="h-full transition-all" style={{ width: `${p.completionPct}%`, backgroundColor: 'var(--s-done)' }} />
                  <div className="h-full transition-all" style={{ width: `${p.total > 0 ? Math.round((p.inProgress / p.total) * 100) : 0}%`, backgroundColor: 'var(--s-inprogress)' }} />
                  {p.overdue > 0 && (
                    <div className="h-full transition-all" style={{ width: `${p.total > 0 ? Math.round((p.overdue / p.total) * 100) : 0}%`, backgroundColor: 'var(--p-critical)' }} />
                  )}
                </div>
              </div>
              <div className="w-[50px] text-right">
                <span className="text-sm font-semibold font-mono text-tx-primary">{p.completionPct}%</span>
              </div>
            </div>
          ))}
        </div>
        <SectionInsight section="Portfolio health and workload balance" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* ═══ DAY OF WEEK PATTERNS ═══ */}
        <div className="card-gradient rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-tx-muted" />
            <h3 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Day of Week Patterns</h3>
          </div>
          <div className="flex items-end gap-1.5 h-[120px]">
            {dayPatterns.map(d => (
              <div key={d.name} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center gap-0.5" style={{ height: 90 }}>
                  <div className="w-full rounded-sm transition-all" style={{
                    height: `${Math.max((d.created / maxDayBar) * 80, 4)}px`,
                    backgroundColor: 'var(--s-inprogress)',
                    marginTop: 'auto',
                  }} />
                  <div className="w-full rounded-sm transition-all" style={{
                    height: `${Math.max((d.completed / maxDayBar) * 80, 4)}px`,
                    backgroundColor: 'var(--s-done)',
                  }} />
                </div>
                <span className="text-[10px] text-tx-muted font-medium">{d.name}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--s-inprogress)' }} />
              <span className="text-2xs text-tx-muted">Created</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--s-done)' }} />
              <span className="text-2xs text-tx-muted">Completed</span>
            </div>
          </div>
          <SectionInsight section="Day of week productivity patterns" />
        </div>

        {/* ═══ OVERDUE AGING ═══ */}
        <div className="card-gradient rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={14} className="text-tx-muted" />
            <h3 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Overdue Aging</h3>
          </div>
          {overdueAging.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 size={20} className="text-tx-muted mx-auto mb-2" />
              <p className="text-sm text-tx-muted">No overdue tasks</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
              {overdueAging.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-1.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--p-critical-bg)' }}>
                    <span className="text-xs font-bold font-mono" style={{ color: 'var(--p-critical)' }}>{t.daysOverdue}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-tx-primary truncate">{t.title}</p>
                    <p className="text-2xs text-tx-muted">{t.portfolio?.name?.split('—')[0].trim() || '—'} · Due {formatDate(t.due_date)}</p>
                  </div>
                  <span className="text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-md shrink-0"
                    style={{ backgroundColor: URGENCY_CONFIG[t.urgency].bg, color: URGENCY_CONFIG[t.urgency].color }}>
                    {t.urgency}
                  </span>
                </div>
              ))}
            </div>
          )}
          <SectionInsight section="Overdue task aging and risk" />
        </div>
      </div>

      {/* ═══ ASK AI ABOUT YOUR DATA ═══ */}
      <div className="card-gradient rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={14} className="text-brand" />
          <h3 className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest">Ask AI About Your Data</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={aiQuestion}
            onChange={e => setAiQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && askAi()}
            placeholder="e.g. Which portfolio is most at risk? What should I prioritize this week?"
            className="flex-1 h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-border-focus"
          />
          <button onClick={askAi} disabled={aiAnswerLoading || !aiQuestion.trim()}
            className="h-9 px-4 rounded-lg bg-brand text-tx-inverse text-sm font-semibold hover:bg-brand-hover transition-colors disabled:opacity-40">
            {aiAnswerLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        {aiAnswer && (
          <div className="mt-4 p-4 bg-subtle rounded-lg">
            <div className="flex items-start gap-2">
              <Sparkles size={12} className="text-brand shrink-0 mt-1" />
              <p className="text-sm text-tx-primary leading-relaxed whitespace-pre-line">{aiAnswer}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
