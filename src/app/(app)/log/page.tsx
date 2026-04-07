'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/stores/app-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextArea } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Rating } from '@/components/ui/rating';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn, getWeekInfo, formatWeekRange } from '@/lib/utils';
import { BlockerType, ColorTag, WeekStatus } from '@/types';
import { ArrowLeft, ArrowRight, Plus, X, Check, Loader2 } from 'lucide-react';

interface StepData {
  areaEntries: Record<string, { accomplishments: string; status: WeekStatus; actual_pct: number; ideal_pct: number }>;
  blockers: { description: string; blocking_what: string; blocker_type: BlockerType; since_date: string }[];
  reflection: string;
  energy: number;
  focus: number;
  growthEntries: Record<string, { evidence: string; rating: number }>;
}

export default function LogPage() {
  const router = useRouter();
  const { areas, setAreas, skills, setSkills } = useAppStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [data, setData] = useState<StepData>({
    areaEntries: {},
    blockers: [],
    reflection: '',
    energy: 3,
    focus: 3,
    growthEntries: {},
  });

  const weekInfo = getWeekInfo();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: areasData } = await supabase
        .from('areas')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('sort_order');
      if (areasData) {
        setAreas(areasData);
        // Initialize area entries
        const entries: StepData['areaEntries'] = {};
        areasData.forEach((a) => {
          entries[a.id] = {
            accomplishments: '',
            status: 'on_track',
            actual_pct: Math.round(100 / areasData.length),
            ideal_pct: Math.round(100 / areasData.length),
          };
        });
        setData((d) => ({ ...d, areaEntries: entries }));
      }

      const { data: skillsData } = await supabase
        .from('skills')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order');
      if (skillsData) setSkills(skillsData);

      // Load unresolved blockers for carry-forward
      const { data: existingBlockers } = await supabase
        .from('blockers')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_resolved', false);
      if (existingBlockers && existingBlockers.length > 0) {
        setData((d) => ({
          ...d,
          blockers: existingBlockers.map((b) => ({
            description: b.description,
            blocking_what: b.blocking_what || '',
            blocker_type: b.blocker_type as BlockerType,
            since_date: b.since_date,
          })),
        }));
      }

      setLoading(false);
    }
    load();
  }, [setAreas, setSkills]);

  function updateAreaEntry(areaId: string, field: string, value: string | number) {
    setData((d) => ({
      ...d,
      areaEntries: {
        ...d.areaEntries,
        [areaId]: { ...d.areaEntries[areaId], [field]: value },
      },
    }));
  }

  function addBlocker() {
    setData((d) => ({
      ...d,
      blockers: [...d.blockers, { description: '', blocking_what: '', blocker_type: 'system' as BlockerType, since_date: new Date().toISOString().split('T')[0] }],
    }));
  }

  function removeBlocker(index: number) {
    setData((d) => ({ ...d, blockers: d.blockers.filter((_, i) => i !== index) }));
  }

  function updateBlocker(index: number, field: string, value: string) {
    setData((d) => ({
      ...d,
      blockers: d.blockers.map((b, i) => (i === index ? { ...b, [field]: value } : b)),
    }));
  }

  function updateGrowth(skillId: string, field: string, value: string | number) {
    setData((d) => ({
      ...d,
      growthEntries: {
        ...d.growthEntries,
        [skillId]: { ...(d.growthEntries[skillId] || { evidence: '', rating: 3 }), [field]: value },
      },
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Create weekly log
    const { data: log, error: logError } = await supabase
      .from('weekly_logs')
      .upsert({
        user_id: user.id,
        week_start: weekInfo.week_start,
        week_number: weekInfo.week_number,
        year: weekInfo.year,
        honest_reflection: data.reflection,
        energy_level: data.energy,
        focus_level: data.focus,
        status: 'complete',
      }, { onConflict: 'user_id,week_start' })
      .select()
      .single();

    if (logError || !log) {
      console.error('Failed to create log:', logError);
      setSubmitting(false);
      return;
    }

    // Delete existing entries for this log (in case of re-submission)
    await supabase.from('area_weekly_entries').delete().eq('log_id', log.id);
    await supabase.from('blockers').delete().eq('log_id', log.id);
    await supabase.from('growth_entries').delete().eq('log_id', log.id);

    // Insert area entries
    const areaEntries = Object.entries(data.areaEntries).map(([area_id, entry]) => ({
      log_id: log.id,
      area_id,
      accomplishments: entry.accomplishments,
      status: entry.status,
      actual_pct: entry.actual_pct,
      ideal_pct: entry.ideal_pct,
    }));
    await supabase.from('area_weekly_entries').insert(areaEntries);

    // Insert blockers
    const validBlockers = data.blockers.filter((b) => b.description.trim());
    if (validBlockers.length > 0) {
      await supabase.from('blockers').insert(
        validBlockers.map((b) => ({
          log_id: log.id,
          user_id: user.id,
          description: b.description,
          blocking_what: b.blocking_what || null,
          blocker_type: b.blocker_type,
          since_date: b.since_date,
        }))
      );
    }

    // Insert growth entries
    const validGrowth = Object.entries(data.growthEntries).filter((entry) => entry[1].evidence.trim());
    if (validGrowth.length > 0) {
      await supabase.from('growth_entries').insert(
        validGrowth.map(([skill_id, g]) => ({
          log_id: log.id,
          skill_id,
          evidence: g.evidence,
          rating: g.rating,
        }))
      );
    }

    // Trigger briefing generation
    try {
      await fetch('/api/briefing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: log.id }),
      });
    } catch (e) {
      console.error('Briefing generation failed:', e);
    }

    router.push(`/briefing/${log.id}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl text-text-primary">Log Your Week</h1>
        <p className="text-sm text-text-secondary font-ui mt-1">
          Week {weekInfo.week_number} &middot; {formatWeekRange(weekInfo.week_start)}
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {['Work Done', 'Allocation', 'Blockers', 'Reflection', 'Growth'].map((label, i) => (
          <div key={i} className="flex-1 text-center">
            <div
              className={cn(
                'h-1.5 rounded-full mb-1.5 transition-all',
                i + 1 <= step ? 'bg-primary' : 'bg-bg-muted'
              )}
            />
            <span className={cn(
              'text-xs font-ui',
              i + 1 === step ? 'text-primary font-semibold' : 'text-text-muted'
            )}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Work Done */}
      {step === 1 && (
        <div>
          <h2 className="text-md font-ui font-semibold text-text-primary mb-4">
            What did you actually do this week?
          </h2>
          <div className="flex flex-col gap-4">
            {areas.map((area) => (
              <Card key={area.id} tint={area.color_tag as ColorTag}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-ui font-semibold text-text-primary">{area.name}</h3>
                  <Badge variant={area.priority}>{area.priority.toUpperCase()}</Badge>
                </div>
                <TextArea
                  placeholder="What did you work on this week?"
                  value={data.areaEntries[area.id]?.accomplishments || ''}
                  onChange={(e) => updateAreaEntry(area.id, 'accomplishments', e.target.value)}
                />
                <div className="mt-3">
                  <p className="text-sm font-ui text-text-secondary mb-2">Status this week:</p>
                  <div className="flex gap-2">
                    {(['on_track', 'slightly_delayed', 'blocked'] as WeekStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateAreaEntry(area.id, 'status', s)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-ui font-medium transition-all',
                          data.areaEntries[area.id]?.status === s
                            ? s === 'on_track' ? 'bg-success text-white' : s === 'slightly_delayed' ? 'bg-warning text-white' : 'bg-danger text-white'
                            : 'bg-bg-subtle text-text-secondary hover:bg-bg-muted'
                        )}
                      >
                        {s === 'on_track' ? 'On Track' : s === 'slightly_delayed' ? 'Delayed' : 'Blocked'}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Allocation */}
      {step === 2 && (
        <div>
          <h2 className="text-md font-ui font-semibold text-text-primary mb-2">
            Where did your time go?
          </h2>
          <p className="text-sm text-text-secondary font-ui mb-6">
            Actual time spent vs. where it should have gone ideally.
          </p>
          <div className="flex flex-col gap-6">
            {areas.map((area) => (
              <Card key={area.id} tint={area.color_tag as ColorTag}>
                <h3 className="text-base font-ui font-semibold text-text-primary mb-4">{area.name}</h3>
                <Slider
                  label="Actual time"
                  value={data.areaEntries[area.id]?.actual_pct || 0}
                  onChange={(v) => updateAreaEntry(area.id, 'actual_pct', v)}
                />
                <div className="mt-3">
                  <Slider
                    label="Ideal time"
                    value={data.areaEntries[area.id]?.ideal_pct || 0}
                    onChange={(v) => updateAreaEntry(area.id, 'ideal_pct', v)}
                  />
                </div>
                {data.areaEntries[area.id] && (
                  <div className="mt-3 text-xs font-mono text-text-secondary">
                    Gap: {data.areaEntries[area.id].actual_pct - data.areaEntries[area.id].ideal_pct > 0 ? '+' : ''}
                    {data.areaEntries[area.id].actual_pct - data.areaEntries[area.id].ideal_pct}%
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Blockers */}
      {step === 3 && (
        <div>
          <h2 className="text-md font-ui font-semibold text-text-primary mb-2">
            What is stuck or waiting?
          </h2>
          <p className="text-sm text-text-secondary font-ui mb-6">
            Log blockers that are slowing you down.
          </p>
          <div className="flex flex-col gap-4">
            {data.blockers.map((blocker, i) => (
              <Card key={i} className="relative border border-border">
                <button
                  onClick={() => removeBlocker(i)}
                  className="absolute top-3 right-3 text-text-muted hover:text-danger"
                >
                  <X size={14} />
                </button>
                <div className="flex flex-col gap-3">
                  <Input
                    label="What's blocked?"
                    value={blocker.description}
                    onChange={(e) => updateBlocker(i, 'description', e.target.value)}
                    placeholder="Describe the blocker"
                  />
                  <Input
                    label="Blocking what?"
                    value={blocker.blocking_what}
                    onChange={(e) => updateBlocker(i, 'blocking_what', e.target.value)}
                    placeholder="Which area or task is affected?"
                  />
                  <div className="flex gap-3">
                    <Select
                      label="Type"
                      value={blocker.blocker_type}
                      onChange={(e) => updateBlocker(i, 'blocker_type', e.target.value)}
                      options={[
                        { value: 'person', label: 'Person' },
                        { value: 'system', label: 'System / Tool' },
                        { value: 'decision', label: 'Decision' },
                        { value: 'resource', label: 'Resource' },
                      ]}
                    />
                    <Input
                      label="Since when?"
                      type="date"
                      value={blocker.since_date}
                      onChange={(e) => updateBlocker(i, 'since_date', e.target.value)}
                    />
                  </div>
                </div>
              </Card>
            ))}
            <button
              onClick={addBlocker}
              className="flex items-center gap-2 text-sm text-primary font-ui font-semibold hover:text-primary-hover transition py-2"
            >
              <Plus size={16} />
              Add a blocker
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Reflection */}
      {step === 4 && (
        <div>
          <h2 className="text-md font-ui font-semibold text-text-primary mb-2">
            One honest thing about this week
          </h2>
          <p className="text-sm text-text-secondary font-ui mb-6">
            Good or bad — what would you tell yourself?
          </p>
          <TextArea
            placeholder="e.g., Too many context switches. Need to protect focused mornings."
            value={data.reflection}
            onChange={(e) => setData((d) => ({ ...d, reflection: e.target.value }))}
            className="mb-6"
          />
          <Rating
            label="Overall energy this week"
            value={data.energy}
            onChange={(v) => setData((d) => ({ ...d, energy: v }))}
            leftLabel="Drained"
            rightLabel="Charged"
          />
          <div className="mt-6">
            <Rating
              label="Overall focus this week"
              value={data.focus}
              onChange={(v) => setData((d) => ({ ...d, focus: v }))}
              leftLabel="Scattered"
              rightLabel="Laser"
            />
          </div>
        </div>
      )}

      {/* Step 5: Growth */}
      {step === 5 && (
        <div>
          <h2 className="text-md font-ui font-semibold text-text-primary mb-2">
            How did you grow this week?
          </h2>
          <p className="text-sm text-text-secondary font-ui mb-6">
            Log evidence for each skill. Skip any with no evidence.
          </p>
          <div className="flex flex-col gap-4">
            {skills.map((skill) => (
              <Card key={skill.id} className="border border-border">
                <h3 className="text-base font-ui font-semibold text-text-primary mb-1">
                  {skill.name}
                </h3>
                {skill.description && (
                  <p className="text-xs text-text-muted font-ui mb-3">{skill.description}</p>
                )}
                <TextArea
                  placeholder="What evidence of this skill did you see this week?"
                  value={data.growthEntries[skill.id]?.evidence || ''}
                  onChange={(e) => updateGrowth(skill.id, 'evidence', e.target.value)}
                />
                {data.growthEntries[skill.id]?.evidence && (
                  <div className="mt-3">
                    <Rating
                      label="Self-rating"
                      value={data.growthEntries[skill.id]?.rating || 3}
                      onChange={(v) => updateGrowth(skill.id, 'rating', v)}
                    />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            <ArrowLeft size={16} className="mr-2" /> Back
          </Button>
        ) : (
          <div />
        )}

        {step < 5 ? (
          <Button onClick={() => setStep(step + 1)}>
            Next <ArrowRight size={16} className="ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" /> Generating Briefing...
              </>
            ) : (
              <>
                Complete & Generate <Check size={16} className="ml-2" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
