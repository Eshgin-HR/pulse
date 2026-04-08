import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { differenceInDays, parseISO, format } from 'date-fns';

export async function POST() {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [{ data: tasks }, { data: portfolios }] = await Promise.all([
      supabase.from('tasks').select('*, portfolio:portfolios(name, color, status)').eq('is_archived', false).order('due_date'),
      supabase.from('portfolios').select('*').eq('is_archived', false),
    ]);

    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');

    // ═══ AUTO-DETECT BOTTLENECKS ═══
    const bottlenecks: { type: string; severity: 'critical' | 'high' | 'medium'; title: string; detail: string; tasks?: string[] }[] = [];

    // 1. STALLED TASKS — in_progress or in_review for >7 days without update
    const stalled = (tasks || []).filter(t => {
      if (t.status !== 'in_progress' && t.status !== 'in_review') return false;
      const daysSinceUpdate = differenceInDays(now, parseISO(t.updated_at));
      return daysSinceUpdate > 7;
    });
    if (stalled.length > 0) {
      bottlenecks.push({
        type: 'stalled',
        severity: stalled.length >= 3 ? 'critical' : 'high',
        title: `${stalled.length} task${stalled.length > 1 ? 's' : ''} stalled for 7+ days`,
        detail: `These tasks haven't been updated in over a week. They're either blocked, forgotten, or need to be re-scoped.`,
        tasks: stalled.map(t => `"${t.title}" (${differenceInDays(now, parseISO(t.updated_at))} days since update)`),
      });
    }

    // 2. WIP OVERLOAD — more than 5 tasks in_progress
    const inProgress = (tasks || []).filter(t => t.status === 'in_progress');
    if (inProgress.length > 5) {
      bottlenecks.push({
        type: 'wip_overload',
        severity: inProgress.length > 8 ? 'critical' : 'high',
        title: `WIP overload: ${inProgress.length} tasks in progress`,
        detail: `Research shows cognitive switching costs compound above 5 parallel tasks. You're likely finishing less despite feeling more active.`,
        tasks: inProgress.map(t => `"${t.title}" (${t.portfolio?.name?.split('—')[0].trim() || 'No portfolio'})`),
      });
    }

    // 3. PORTFOLIO RISK — any portfolio with >40% overdue rate
    (portfolios || []).forEach(p => {
      const pTasks = (tasks || []).filter(t => t.portfolio_id === p.id && t.status !== 'done');
      const pOverdue = pTasks.filter(t => t.due_date && t.due_date < today);
      if (pTasks.length >= 2 && pOverdue.length / pTasks.length > 0.4) {
        bottlenecks.push({
          type: 'portfolio_risk',
          severity: pOverdue.length / pTasks.length > 0.6 ? 'critical' : 'high',
          title: `"${p.name.split('—')[0].trim()}" has ${Math.round((pOverdue.length / pTasks.length) * 100)}% overdue rate`,
          detail: `${pOverdue.length} of ${pTasks.length} active tasks are past due. This portfolio is either under-resourced or has scope creep.`,
          tasks: pOverdue.map(t => `"${t.title}" (${differenceInDays(now, parseISO(t.due_date!))} days overdue)`),
        });
      }
    });

    // 4. URGENCY INFLATION — >50% of active tasks are critical or high
    const active = (tasks || []).filter(t => t.status !== 'done');
    const highUrgency = active.filter(t => t.urgency === 'critical' || t.urgency === 'high');
    if (active.length >= 4 && highUrgency.length / active.length > 0.5) {
      bottlenecks.push({
        type: 'urgency_inflation',
        severity: 'medium',
        title: `${Math.round((highUrgency.length / active.length) * 100)}% of tasks marked high/critical`,
        detail: `When everything is urgent, nothing is. This signals anxiety-driven labeling rather than real triage.`,
      });
    }

    // 5. OVERDUE AGING — any task overdue >14 days
    const deepOverdue = (tasks || []).filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return differenceInDays(now, parseISO(t.due_date)) > 14;
    });
    if (deepOverdue.length > 0) {
      bottlenecks.push({
        type: 'deep_overdue',
        severity: 'critical',
        title: `${deepOverdue.length} task${deepOverdue.length > 1 ? 's' : ''} overdue by 14+ days`,
        detail: `At this point, these aren't late tasks — they're avoidance patterns. Either rescope, delegate, or kill them.`,
        tasks: deepOverdue.map(t => `"${t.title}" (${differenceInDays(now, parseISO(t.due_date!))} days overdue, ${t.urgency})`),
      });
    }

    // 6. NO DUE DATE — tasks without deadlines
    const noDueDate = active.filter(t => !t.due_date);
    if (noDueDate.length > 3) {
      bottlenecks.push({
        type: 'no_deadline',
        severity: 'medium',
        title: `${noDueDate.length} tasks have no due date`,
        detail: `Tasks without deadlines are wishes, not commitments. They'll lose to anything with a date.`,
        tasks: noDueDate.slice(0, 5).map(t => `"${t.title}"`),
      });
    }

    // 7. PORTFOLIO NEGLECT — portfolio with 0 completions while others have many
    const portfolioCompletions = (portfolios || []).map(p => ({
      name: p.name.split('—')[0].trim(),
      done: (tasks || []).filter(t => t.portfolio_id === p.id && t.status === 'done').length,
      total: (tasks || []).filter(t => t.portfolio_id === p.id).length,
    })).filter(p => p.total >= 2);
    const avgDone = portfolioCompletions.reduce((s, p) => s + p.done, 0) / (portfolioCompletions.length || 1);
    portfolioCompletions.forEach(p => {
      if (p.done === 0 && avgDone > 1) {
        bottlenecks.push({
          type: 'portfolio_neglect',
          severity: 'medium',
          title: `"${p.name}" has zero completions`,
          detail: `Other portfolios are progressing but this one shows no completed tasks. It's either underprioritized or quietly becoming your biggest risk.`,
        });
      }
    });

    // Sort by severity
    const sevOrder = { critical: 0, high: 1, medium: 2 };
    bottlenecks.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

    // ═══ AI ANALYSIS ═══
    let aiAnalysis = '';
    if (bottlenecks.length > 0) {
      const bottleneckSummary = bottlenecks.map(b => `[${b.severity.toUpperCase()}] ${b.title}: ${b.detail}`).join('\n');
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: `You are PULSE AI. Analyze these bottlenecks detected in a task management system and give a 3-4 sentence executive diagnosis. Be direct, name the root cause, and give ONE specific action to take today.\n\nBottlenecks:\n${bottleneckSummary}\n\nContext: ${active.length} active tasks, ${inProgress.length} in progress, across ${(portfolios || []).length} portfolios.`,
        }],
        temperature: 0.5,
        max_tokens: 300,
      });
      aiAnalysis = completion.choices[0]?.message?.content || '';
    }

    return NextResponse.json({ bottlenecks, aiAnalysis });
  } catch (error: unknown) {
    console.error('Bottleneck detection error:', error);
    return NextResponse.json({ error: 'Failed to detect bottlenecks' }, { status: 500 });
  }
}
