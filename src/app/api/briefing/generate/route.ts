import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import openai, { BRIEFING_MODEL, BRIEFING_TOKENS, BRIEFING_TEMP } from '@/lib/openai/client';
import { BRIEFING_SYSTEM_PROMPT, buildBriefingUserPrompt } from '@/lib/openai/prompts';
import { blockerAgeDays } from '@/lib/utils';
import { WeeklyPayload } from '@/types';
import { endOfWeek, format, parseISO } from 'date-fns';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { log_id } = await req.json();

  try {
    // Fetch the weekly log
    const { data: log } = await supabase
      .from('weekly_logs')
      .select('*')
      .eq('id', log_id)
      .single();

    if (!log) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 });
    }

    // Fetch area entries with area data
    const { data: areaEntries } = await supabase
      .from('area_weekly_entries')
      .select('*, area:areas(*)')
      .eq('log_id', log_id);

    // Fetch blockers
    const { data: blockers } = await supabase
      .from('blockers')
      .select('*')
      .eq('log_id', log_id);

    // Fetch growth entries with skill data
    const { data: growthEntries } = await supabase
      .from('growth_entries')
      .select('*, skill:skills(*)')
      .eq('log_id', log_id);

    // Fetch last 4 weeks of logs
    const { data: historyLogs } = await supabase
      .from('weekly_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'complete')
      .order('week_start', { ascending: false })
      .limit(5);

    // Fetch skill ratings history (last 8 weeks)
    const { data: allSkills } = await supabase
      .from('skills')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const { data: allGrowth } = await supabase
      .from('growth_entries')
      .select('*, skill:skills(*)')
      .in('log_id', (historyLogs || []).map((l) => l.id));

    // Build skill rating histories
    const skillRatings = (allSkills || []).map((skill) => {
      const entries = (allGrowth || []).filter((g) => g.skill_id === skill.id);
      const ratings = (historyLogs || []).slice(0, 8).map((l) => {
        const entry = entries.find((e) => e.log_id === l.id);
        return { week: l.week_start, rating: entry ? entry.rating : null };
      });
      const validRatings = ratings.filter((r) => r.rating !== null).map((r) => r.rating!);
      const avg = validRatings.length > 0 ? Math.round((validRatings.reduce((a, b) => a + b, 0) / validRatings.length) * 10) / 10 : null;

      let trend: 'up' | 'flat' | 'down' | 'no_data' = 'no_data';
      if (validRatings.length >= 3) {
        const recent = validRatings.slice(0, 2);
        const older = validRatings.slice(-2);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        if (recentAvg > olderAvg + 0.3) trend = 'up';
        else if (recentAvg < olderAvg - 0.3) trend = 'down';
        else trend = 'flat';
      }

      return {
        skill_id: skill.id,
        skill_name: skill.name,
        ratings,
        rolling_avg: avg,
        trend,
      };
    });

    const weekEnd = format(endOfWeek(parseISO(log.week_start), { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const payload: WeeklyPayload = {
      week: {
        number: log.week_number,
        year: log.year,
        start: log.week_start,
        end: weekEnd,
      },
      area_entries: (areaEntries || []).map((e) => ({ ...e, area: e.area })),
      blockers: (blockers || []).map((b) => ({ ...b, age_days: blockerAgeDays(b.since_date) })),
      reflection: log.honest_reflection || '',
      energy_level: log.energy_level || 3,
      focus_level: log.focus_level || 3,
      growth_entries: (growthEntries || []).map((g) => ({ ...g, skill: g.skill })),
      history: {
        last_4_weeks: (historyLogs || []).slice(1, 5),
        skill_ratings: skillRatings,
      },
    };

    const userPrompt = buildBriefingUserPrompt(payload);

    const completion = await openai.chat.completions.create({
      model: BRIEFING_MODEL,
      max_tokens: BRIEFING_TOKENS,
      temperature: BRIEFING_TEMP,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: BRIEFING_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const rawContent = completion.choices[0].message.content;
    if (!rawContent) throw new Error('Empty response from OpenAI');

    const briefingData = JSON.parse(rawContent);

    // Mark previous briefings as not current
    await supabase
      .from('briefings')
      .update({ is_current: false })
      .eq('log_id', log_id);

    // Store briefing
    const { data: briefing, error } = await supabase
      .from('briefings')
      .insert({
        log_id,
        user_id: user.id,
        summary: briefingData.summary,
        resource_diagnosis: briefingData.resource_diagnosis,
        bottleneck_report: briefingData.bottleneck_report,
        priorities: briefingData.priorities,
        growth_signal: briefingData.growth_signal,
        raw_prompt: userPrompt,
        model_used: BRIEFING_MODEL,
        tokens_used: completion.usage?.total_tokens ?? 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ briefing_id: briefing.id, briefing });
  } catch (error) {
    console.error('Briefing generation failed:', error);
    return NextResponse.json(
      { error: 'Briefing generation failed. Try regenerating.' },
      { status: 500 }
    );
  }
}
