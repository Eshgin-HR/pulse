import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { format, differenceInDays, parseISO } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const { type } = await req.json(); // 'summary' | 'section' | 'question'
    const message = (await req.json().catch(() => ({}))).message || '';

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [{ data: portfolios }, { data: tasks }] = await Promise.all([
      supabase.from('portfolios').select('*').eq('is_archived', false).order('sort_order'),
      supabase.from('tasks').select('*, portfolio:portfolios(name, status, color)').eq('is_archived', false).order('due_date', { ascending: true }),
    ]);

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const totalTasks = (tasks || []).length;
    const doneTasks = (tasks || []).filter(t => t.status === 'done').length;
    const inProgressTasks = (tasks || []).filter(t => t.status === 'in_progress').length;
    const overdueTasks = (tasks || []).filter(t => t.due_date && t.due_date < today && t.status !== 'done').length;
    const todoTasks = (tasks || []).filter(t => t.status === 'todo').length;
    const inReviewTasks = (tasks || []).filter(t => t.status === 'in_review').length;
    const noDueDateTasks = (tasks || []).filter(t => !t.due_date && t.status !== 'done').length;
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const overdueRate = totalTasks > 0 ? Math.round((overdueTasks / (totalTasks - doneTasks || 1)) * 100) : 0;

    const portfolioBreakdown = (portfolios || []).map(p => {
      const pTasks = (tasks || []).filter(t => t.portfolio_id === p.id);
      const pDone = pTasks.filter(t => t.status === 'done').length;
      const pOverdue = pTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length;
      return `  • "${p.name}": ${pTasks.length} tasks, ${pDone} done, ${pOverdue} overdue, ${pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0}% complete`;
    }).join('\n');

    const urgencyBreakdown = ['critical', 'high', 'medium', 'low'].map(u => {
      const count = (tasks || []).filter(t => t.urgency === u && t.status !== 'done').length;
      return `  • ${u}: ${count} active`;
    }).join('\n');

    const overdueList = (tasks || [])
      .filter(t => t.due_date && t.due_date < today && t.status !== 'done')
      .map(t => {
        const days = differenceInDays(now, parseISO(t.due_date!));
        return `  • "${t.title}" — ${days} days overdue [${t.urgency}] ${t.portfolio ? `(${t.portfolio.name})` : ''}`;
      }).join('\n');

    const dataContext = `WORKSPACE REPORT DATA — ${format(now, 'EEEE, MMMM d, yyyy')}

OVERVIEW:
  Total tasks: ${totalTasks}
  Completed: ${doneTasks} (${completionRate}%)
  In Progress: ${inProgressTasks}
  In Review: ${inReviewTasks}
  To Do: ${todoTasks}
  Overdue: ${overdueTasks} (${overdueRate}% of active tasks)
  No due date: ${noDueDateTasks}

PORTFOLIO BREAKDOWN:
${portfolioBreakdown}

URGENCY DISTRIBUTION (active only):
${urgencyBreakdown}

OVERDUE ITEMS:
${overdueList || '  None'}`;

    const prompt = `You are PULSE AI's analytics engine. Analyze the workspace data and provide insights.

${dataContext}

${type === 'summary' ? `Generate a 3-4 sentence executive summary of the workspace health. Be direct, name specific portfolios and tasks. Highlight the biggest risk and the biggest win. End with one actionable recommendation.` : ''}
${type === 'section' ? `For the section "${message}", provide a 1-2 sentence insight based on the data. Be specific — name tasks, portfolios, numbers. No generic observations.` : ''}
${type === 'question' ? `The user asks: "${message}"\n\nAnswer based strictly on the workspace data above. Be specific and reference actual task names and numbers.` : ''}

Use markdown formatting. Be concise.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 500,
    });

    return NextResponse.json({ response: completion.choices[0]?.message?.content || '' });
  } catch (error: unknown) {
    console.error('AI Report Error:', error);
    return NextResponse.json({ error: 'Failed to generate insight' }, { status: 500 });
  }
}
