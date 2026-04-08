import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { addDays, format } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const { title } = await req.json();
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: portfolios } = await supabase
      .from('portfolios')
      .select('id, name, description')
      .eq('is_archived', false)
      .order('sort_order');

    const portfolioList = (portfolios || [])
      .map(p => `  - id: "${p.id}" | name: "${p.name}"${p.description ? ` | desc: "${p.description}"` : ''}`)
      .join('\n');

    const today = format(new Date(), 'yyyy-MM-dd');
    const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd');

    const prompt = `You are a task categorization AI for a project management tool. Given a task title, suggest the best portfolio, urgency level, status, and due date.

Available portfolios:
${portfolioList}

Today's date: ${today}

Task title: "${title}"

Rules:
- Match the portfolio based on keywords and context. If no clear match, return null for portfolio_id.
- Urgency: "critical" (deadline-driven, blocking others), "high" (important, this week), "medium" (standard work), "low" (nice-to-have, no rush)
- Status: always "todo" for new tasks
- Due date: estimate a reasonable due date based on the task complexity. Simple tasks = 2-3 days, medium = 1 week, complex = 2 weeks. Use format YYYY-MM-DD.
- If the title contains words like "urgent", "ASAP", "today", "immediately" → critical urgency, due today or tomorrow
- If title mentions "review", "feedback", "check" → likely medium urgency, 3-5 days
- If title mentions "plan", "research", "explore", "brainstorm" → low-medium, 1-2 weeks

Return ONLY a valid JSON object, no markdown, no explanation:
{
  "portfolio_id": "uuid-here-or-null",
  "urgency": "low|medium|high|critical",
  "due_date": "YYYY-MM-DD",
  "status": "todo"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 150,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const suggestion = JSON.parse(raw);

    // Validate portfolio_id exists
    if (suggestion.portfolio_id) {
      const valid = (portfolios || []).some(p => p.id === suggestion.portfolio_id);
      if (!valid) suggestion.portfolio_id = null;
    }

    // Validate urgency
    if (!['low', 'medium', 'high', 'critical'].includes(suggestion.urgency)) {
      suggestion.urgency = 'medium';
    }

    // Validate due_date format
    if (suggestion.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(suggestion.due_date)) {
      suggestion.due_date = nextWeek;
    }

    return NextResponse.json({ suggestion });
  } catch (error: unknown) {
    console.error('AI Categorize Error:', error);
    return NextResponse.json({ error: 'Failed to categorize' }, { status: 500 });
  }
}
