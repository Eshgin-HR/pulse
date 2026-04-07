'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Plus, X, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ColorTag, COLOR_TAG_OPTIONS, AreaPriority } from '@/types';

interface AreaDraft {
  name: string;
  priority: AreaPriority;
  color_tag: ColorTag;
}

interface TaskDraft {
  name: string;
  areaIndex: number;
}

interface SkillDraft {
  name: string;
  description: string;
}

const colorLabels: Record<ColorTag, string> = {
  lavender: 'Lavender',
  peach: 'Peach',
  sky: 'Sky',
  mint: 'Mint',
  lemon: 'Lemon',
  rose: 'Rose',
};

const colorBgs: Record<ColorTag, string> = {
  lavender: 'bg-card-lavender',
  peach: 'bg-card-peach',
  sky: 'bg-card-sky',
  mint: 'bg-card-mint',
  lemon: 'bg-card-lemon',
  rose: 'bg-card-rose',
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Areas
  const [areas, setAreas] = useState<AreaDraft[]>([
    { name: '', priority: 'p1', color_tag: 'lavender' },
  ]);

  // Step 2: Tasks per area
  const [tasks, setTasks] = useState<TaskDraft[]>([]);

  // Step 3: Skills
  const [skills, setSkills] = useState<SkillDraft[]>([
    { name: '', description: '' },
  ]);

  function addArea() {
    const usedColors = areas.map((a) => a.color_tag);
    const nextColor = COLOR_TAG_OPTIONS.find((c) => !usedColors.includes(c)) || 'lavender';
    setAreas([...areas, { name: '', priority: 'p2', color_tag: nextColor }]);
  }

  function removeArea(index: number) {
    setAreas(areas.filter((_, i) => i !== index));
    setTasks(tasks.filter((t) => t.areaIndex !== index).map((t) => ({
      ...t,
      areaIndex: t.areaIndex > index ? t.areaIndex - 1 : t.areaIndex,
    })));
  }

  function addTaskToArea(areaIndex: number) {
    setTasks([...tasks, { name: '', areaIndex }]);
  }

  function removeTask(taskIndex: number) {
    setTasks(tasks.filter((_, i) => i !== taskIndex));
  }

  function addSkill() {
    setSkills([...skills, { name: '', description: '' }]);
  }

  function removeSkill(index: number) {
    setSkills(skills.filter((_, i) => i !== index));
  }

  async function handleFinish() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Upsert user record
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email!,
      onboarded: true,
    });

    // Create areas
    const validAreas = areas.filter((a) => a.name.trim());
    const { data: createdAreas } = await supabase
      .from('areas')
      .insert(
        validAreas.map((a, i) => ({
          user_id: user.id,
          name: a.name.trim(),
          priority: a.priority,
          color_tag: a.color_tag,
          sort_order: i,
        }))
      )
      .select();

    // Create tasks
    if (createdAreas) {
      const validTasks = tasks.filter((t) => t.name.trim());
      if (validTasks.length > 0) {
        await supabase.from('tasks').insert(
          validTasks.map((t) => ({
            area_id: createdAreas[t.areaIndex]?.id,
            user_id: user.id,
            name: t.name.trim(),
            status: 'todo' as const,
          }))
        );
      }
    }

    // Create skills
    const validSkills = skills.filter((s) => s.name.trim());
    if (validSkills.length > 0) {
      await supabase.from('skills').insert(
        validSkills.map((s, i) => ({
          user_id: user.id,
          name: s.name.trim(),
          description: s.description.trim() || null,
          sort_order: i,
        }))
      );
    }

    setLoading(false);
    router.push('/dashboard');
  }

  const canProceedStep1 = areas.some((a) => a.name.trim());
  const canProceedStep3 = skills.some((s) => s.name.trim());

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-5 py-10">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all',
                s <= step ? 'bg-primary' : 'bg-bg-muted'
              )}
            />
          ))}
        </div>

        {/* Step 1: Areas */}
        {step === 1 && (
          <div>
            <h2 className="font-display text-2xl text-text-primary mb-1">
              Define your work areas
            </h2>
            <p className="text-sm text-text-secondary font-ui mb-6">
              What are the main areas you work on at PASHA Holding?
            </p>

            <div className="flex flex-col gap-4">
              {areas.map((area, i) => (
                <Card key={i} tint={area.color_tag} className="relative">
                  {areas.length > 1 && (
                    <button
                      onClick={() => removeArea(i)}
                      className="absolute top-3 right-3 text-text-muted hover:text-danger transition"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <div className="flex flex-col gap-3">
                    <Input
                      placeholder="e.g., Retention Model, Leadership DNA, CoE Setup"
                      value={area.name}
                      onChange={(e) => {
                        const next = [...areas];
                        next[i].name = e.target.value;
                        setAreas(next);
                      }}
                    />
                    <div className="flex gap-3">
                      <Select
                        label="Priority"
                        value={area.priority}
                        onChange={(e) => {
                          const next = [...areas];
                          next[i].priority = e.target.value as AreaPriority;
                          setAreas(next);
                        }}
                        options={[
                          { value: 'p1', label: 'P1 — Critical' },
                          { value: 'p2', label: 'P2 — Important' },
                          { value: 'p3', label: 'P3 — Nice to have' },
                        ]}
                      />
                      <Select
                        label="Color"
                        value={area.color_tag}
                        onChange={(e) => {
                          const next = [...areas];
                          next[i].color_tag = e.target.value as ColorTag;
                          setAreas(next);
                        }}
                        options={COLOR_TAG_OPTIONS.map((c) => ({
                          value: c,
                          label: colorLabels[c],
                        }))}
                      />
                    </div>
                  </div>
                </Card>
              ))}

              <button
                onClick={addArea}
                className="flex items-center gap-2 text-sm text-primary font-ui font-semibold hover:text-primary-hover transition py-2"
              >
                <Plus size={16} />
                Add another area
              </button>
            </div>

            <div className="mt-8 flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
                Next <ArrowRight size={16} className="ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Tasks */}
        {step === 2 && (
          <div>
            <h2 className="font-display text-2xl text-text-primary mb-1">
              Add tasks to your areas
            </h2>
            <p className="text-sm text-text-secondary font-ui mb-6">
              What are you currently working on in each area? You can always add more later.
            </p>

            <div className="flex flex-col gap-6">
              {areas.filter((a) => a.name.trim()).map((area, areaIdx) => (
                <div key={areaIdx}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn('w-3 h-3 rounded-full', colorBgs[area.color_tag])} />
                    <h3 className="text-sm font-ui font-semibold text-text-primary">
                      {area.name}
                    </h3>
                  </div>
                  <div className="flex flex-col gap-2 pl-5">
                    {tasks
                      .map((t, idx) => ({ ...t, idx }))
                      .filter((t) => t.areaIndex === areaIdx)
                      .map((task) => (
                        <div key={task.idx} className="flex items-center gap-2">
                          <Input
                            placeholder="Task name"
                            value={task.name}
                            onChange={(e) => {
                              const next = [...tasks];
                              next[task.idx].name = e.target.value;
                              setTasks(next);
                            }}
                            className="flex-1"
                          />
                          <button
                            onClick={() => removeTask(task.idx)}
                            className="text-text-muted hover:text-danger transition"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    <button
                      onClick={() => addTaskToArea(areaIdx)}
                      className="flex items-center gap-1.5 text-xs text-primary font-ui font-semibold hover:text-primary-hover transition py-1"
                    >
                      <Plus size={14} />
                      Add task
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft size={16} className="mr-2" /> Back
              </Button>
              <Button onClick={() => setStep(3)}>
                Next <ArrowRight size={16} className="ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Skills */}
        {step === 3 && (
          <div>
            <h2 className="font-display text-2xl text-text-primary mb-1">
              What are you developing?
            </h2>
            <p className="text-sm text-text-secondary font-ui mb-6">
              Define 3–7 skills or behaviors you want to track and grow.
            </p>

            <div className="flex flex-col gap-4">
              {skills.map((skill, i) => (
                <Card key={i} className="relative">
                  {skills.length > 1 && (
                    <button
                      onClick={() => removeSkill(i)}
                      className="absolute top-3 right-3 text-text-muted hover:text-danger transition"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <div className="flex flex-col gap-3">
                    <Input
                      placeholder="e.g., Executive Communication, Strategic Thinking"
                      value={skill.name}
                      onChange={(e) => {
                        const next = [...skills];
                        next[i].name = e.target.value;
                        setSkills(next);
                      }}
                    />
                    <Input
                      placeholder="What does 'good' look like for this skill?"
                      value={skill.description}
                      onChange={(e) => {
                        const next = [...skills];
                        next[i].description = e.target.value;
                        setSkills(next);
                      }}
                    />
                  </div>
                </Card>
              ))}

              <button
                onClick={addSkill}
                className="flex items-center gap-2 text-sm text-primary font-ui font-semibold hover:text-primary-hover transition py-2"
              >
                <Plus size={16} />
                Add another skill
              </button>
            </div>

            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft size={16} className="mr-2" /> Back
              </Button>
              <Button onClick={handleFinish} disabled={!canProceedStep3 || loading}>
                {loading ? 'Setting up...' : (
                  <>
                    Finish Setup <Check size={16} className="ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
