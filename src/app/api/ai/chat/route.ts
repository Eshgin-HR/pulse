import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai/client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Fetch all portfolios and tasks
    const [{ data: portfolios }, { data: tasks }] = await Promise.all([
      supabase
        .from('portfolios')
        .select('*')
        .eq('is_archived', false)
        .order('sort_order'),
      supabase
        .from('tasks')
        .select('*, portfolio:portfolios(name, status)')
        .eq('is_archived', false)
        .order('due_date', { ascending: true }),
    ]);

    const today = new Date().toISOString().split('T')[0];

    // Build context
    const portfolioContext = (portfolios || [])
      .map((p) => `- "${p.name}" [${p.status}]${p.description ? `: ${p.description}` : ''}`)
      .join('\n');

    const taskContext = (tasks || [])
      .map((t) => {
        const overdue = t.due_date && t.due_date < today && t.status !== 'done' ? ' **OVERDUE**' : '';
        const dueToday = t.due_date === today && t.status !== 'done' ? ' **DUE TODAY**' : '';
        const portfolio = t.portfolio ? ` | Portfolio: "${t.portfolio.name}"` : '';
        const notes = t.notes ? ` | Notes: ${t.notes.slice(0, 100)}` : '';
        return `- "${t.title}" [${t.status}, ${t.urgency}] Due: ${t.due_date || 'none'}${portfolio}${notes}${overdue}${dueToday}`;
      })
      .join('\n');

    const totalTasks = (tasks || []).length;
    const doneTasks = (tasks || []).filter((t) => t.status === 'done').length;
    const overdueTasks = (tasks || []).filter((t) => t.due_date && t.due_date < today && t.status !== 'done').length;
    const inProgressTasks = (tasks || []).filter((t) => t.status === 'in_progress').length;

    const systemPrompt = `You are PULSE AI, a productivity assistant for a professional managing multiple projects at PASHA Holding. You have access to all their tasks and portfolios. Be direct, specific, and actionable. Reference actual task names and dates.

Today's date: ${today}

SUMMARY:
- Total active tasks: ${totalTasks} (${doneTasks} done, ${inProgressTasks} in progress, ${overdueTasks} overdue)
- Portfolios: ${(portfolios || []).length}

PORTFOLIOS:
${portfolioContext || 'No portfolios found.'}

TASKS:
${taskContext || 'No tasks found.'}

Guidelines:
- Be concise but thorough
- When listing tasks, use their exact titles
- Highlight overdue items and critical urgency items
- Give specific, actionable recommendations
- Use markdown formatting for readability (bold, lists, etc.)
- When asked about priorities, consider urgency level, due date, and overdue status`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    return NextResponse.json({ response });
  } catch (error: unknown) {
    console.error('AI Chat Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
