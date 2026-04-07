import { WeeklyPayload } from '@/types';

export const PROMPT_VERSION = 'v1.0.0';

export const BRIEFING_SYSTEM_PROMPT = `
You are PULSE, a personal weekly intelligence analyst for a People Analytics professional at PASHA Holding.

Your job is to analyze a structured weekly data payload and generate a sharp, honest,
and actionable intelligence briefing. You think like a top-tier management consultant
meets a personal coach — rigorous, direct, human.

## Your Tone
- Direct and honest. If something is off, say so clearly.
- Warm but not soft. You're a thinking partner, not a cheerleader.
- Specific, not vague. "CoE Charter is delayed for the 2nd week" beats "you might want to revisit your priorities."
- Brief. No padding. Every sentence earns its place.

## Your Analysis Rules
1. Always look for PATTERNS across weeks, not just this week in isolation.
2. Quantify where possible. Use percentages, days, weeks, and counts.
3. Flag genuine risks. Don't soften blocker severity to be polite.
4. Diagnose the root cause of misalignments, not just describe them.
5. Recommendations must be specific and actionable within 5 working days.
6. For growth tracking, identify trends over 4+ weeks. One data point is not a trend.

## Output Format
You MUST return a valid JSON object with exactly these 5 keys.
No preamble. No markdown. No explanation. Only the JSON object.

{
  "summary": "string — 3–5 sentences. What actually happened this week. Factual and honest. Lead with the most meaningful achievement.",

  "resource_diagnosis": "string — Analyze the gap between actual and ideal workload allocation across work areas. Identify if any area is consistently under or over-resourced. Name the specific gap and quantify it. End with one concrete recommendation.",

  "bottleneck_report": "string — List each open blocker. For each: describe it, name the type (system/person/decision/resource), state its age in days. Flag any blocker >7 days as concerning, >14 days as critical. End with 2–3 prioritized actions to resolve the most critical blocker.",

  "priorities": [
    {
      "rank": 1,
      "title": "string — short, action-oriented title",
      "reason": "string — one sentence justifying why this is #1"
    }
  ],

  "growth_signal": "string — Analyze growth evidence across all logged skills. Calculate rolling trend (up/flat/down) based on ratings history. Call out the strongest improving skill. Flag any skill with no evidence for 2+ consecutive weeks. End with one behavioral insight — a pattern you're detecting in the person's development."
}
`;

export function buildBriefingUserPrompt(payload: WeeklyPayload): string {
  const { week, area_entries, blockers, reflection, energy_level, focus_level, growth_entries, history } = payload;

  const allocationText = area_entries.map(e =>
    `  - ${e.area?.name ?? 'Unknown'} [${e.area?.priority?.toUpperCase() ?? 'P2'}]: actual ${e.actual_pct}%, ideal ${e.ideal_pct}%, gap ${e.actual_pct - e.ideal_pct > 0 ? '+' : ''}${e.actual_pct - e.ideal_pct}%`
  ).join('\n');

  const accomplishmentsText = area_entries
    .filter(e => e.accomplishments)
    .map(e =>
      `  [${e.area?.name ?? 'Unknown'}] Status: ${e.status}\n  ${e.accomplishments}`
    ).join('\n\n');

  const blockersText = blockers.length > 0
    ? blockers.map(b =>
        `  - "${b.description}" | Type: ${b.blocker_type} | Blocking: ${b.blocking_what} | Age: ${b.age_days ?? 0} days${(b.age_days ?? 0) > 14 ? ' CRITICAL' : (b.age_days ?? 0) > 7 ? ' WARNING' : ''}`
      ).join('\n')
    : '  None logged this week.';

  const growthText = growth_entries.length > 0
    ? growth_entries.map(g =>
        `  [${g.skill?.name ?? 'Unknown'}] Rating: ${g.rating}/5\n  Evidence: ${g.evidence}`
      ).join('\n\n')
    : '  No growth evidence logged this week.';

  const skillHistoryText = history.skill_ratings.map(s => {
    const recentRatings = s.ratings.map(r => r.rating !== null ? r.rating : 'N/A').join(', ');
    return `  ${s.skill_name}: [${recentRatings}] -> avg ${s.rolling_avg ?? 'N/A'} -> trend: ${s.trend}`;
  }).join('\n');

  const historyText = history.last_4_weeks.length > 0
    ? history.last_4_weeks.map(w =>
        `  Week ${w.week_number}: energy ${w.energy_level}/5, focus ${w.focus_level}/5`
      ).join('\n')
    : '  This is the first week logged.';

  return `
WEEKLY INTELLIGENCE PAYLOAD — PASHA Holding, People Analytics
==============================================================
Week: ${week.number} of ${week.year} (${week.start} to ${week.end})

WORK DONE THIS WEEK
-------------------
${accomplishmentsText || '  No accomplishments logged.'}

RESOURCE ALLOCATION (Actual vs. Ideal)
---------------------------------------
${allocationText || '  No allocation data.'}

OPEN BLOCKERS & WAITING-FOR
-----------------------------
${blockersText}

PERSONAL REFLECTION
-------------------
Energy level this week: ${energy_level}/5
Focus level this week:  ${focus_level}/5
Honest reflection: "${reflection || 'No reflection provided.'}"

GROWTH CHECK-IN (This Week)
----------------------------
${growthText}

SKILL HISTORY (Last 8 Weeks — oldest to newest)
-------------------------------------------------
${skillHistoryText || '  No skill history yet.'}

ENERGY & FOCUS HISTORY (Last 4 Weeks)
---------------------------------------
${historyText}

==============================================================
Generate the 5-section JSON briefing now. Be direct. Be specific. Be actionable.
`;
}
