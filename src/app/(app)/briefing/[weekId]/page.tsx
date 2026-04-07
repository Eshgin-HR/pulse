'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Briefing, Priority } from '@/types';
import { formatWeekRange } from '@/lib/utils';
import {
  ClipboardList,
  Scale,
  AlertTriangle,
  Target,
  TrendingUp,
  Loader2,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';

export default function BriefingPage() {
  const params = useParams();
  const weekId = params.weekId as string;
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [weekStart, setWeekStart] = useState('');
  const [weekNumber, setWeekNumber] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Fetch log info
      const { data: log } = await supabase
        .from('weekly_logs')
        .select('*')
        .eq('id', weekId)
        .single();

      if (log) {
        setWeekStart(log.week_start);
        setWeekNumber(log.week_number);
      }

      // Fetch briefing
      const { data: briefingData } = await supabase
        .from('briefings')
        .select('*')
        .eq('log_id', weekId)
        .eq('is_current', true)
        .single();

      if (briefingData) {
        setBriefing(briefingData);
      } else {
        // Still generating
        setGenerating(true);
        // Poll for briefing
        const interval = setInterval(async () => {
          const { data } = await supabase
            .from('briefings')
            .select('*')
            .eq('log_id', weekId)
            .eq('is_current', true)
            .single();
          if (data) {
            setBriefing(data);
            setGenerating(false);
            clearInterval(interval);
          }
        }, 3000);

        // Stop polling after 60s
        setTimeout(() => {
          clearInterval(interval);
          setGenerating(false);
        }, 60000);
      }

      setLoading(false);
    }
    load();
  }, [weekId]);

  async function handleFeedback(section: string, rating: 'up' | 'down') {
    if (!briefing) return;
    const supabase = createClient();
    await supabase.from('briefing_feedback').insert({
      briefing_id: briefing.id,
      section,
      rating,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (generating || !briefing) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Loader2 size={32} className="text-primary animate-spin mb-4" />
        <p className="text-base font-ui text-text-primary font-medium">
          PULSE is analyzing your week
        </p>
        <p className="text-sm text-text-secondary font-ui mt-2">
          Building your intelligence briefing...
        </p>
      </div>
    );
  }

  const priorities: Priority[] = Array.isArray(briefing.priorities) ? briefing.priorities : [];

  const sections = [
    {
      key: 'summary',
      title: 'Weekly Summary',
      icon: ClipboardList,
      content: briefing.summary,
    },
    {
      key: 'resource_diagnosis',
      title: 'Resource Diagnosis',
      icon: Scale,
      content: briefing.resource_diagnosis,
    },
    {
      key: 'bottleneck_report',
      title: 'Bottleneck Report',
      icon: AlertTriangle,
      content: briefing.bottleneck_report,
    },
    {
      key: 'growth_signal',
      title: 'Growth Signal',
      icon: TrendingUp,
      content: briefing.growth_signal,
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl text-text-primary">
          Week {weekNumber} Briefing
        </h1>
        {weekStart && (
          <p className="text-sm text-text-secondary font-ui mt-1">
            {formatWeekRange(weekStart)}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.key}>
            <div className="flex items-center gap-2 mb-3">
              <section.icon size={16} className="text-primary" />
              <h2 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide">
                {section.title}
              </h2>
            </div>
            <div className="bg-[#F8F8FF] border-l-[3px] border-primary rounded-r-md p-5">
              <p className="text-base font-ui text-text-body leading-relaxed whitespace-pre-line">
                {section.content}
              </p>
            </div>
            <div className="flex gap-2 mt-2 justify-end">
              <button
                onClick={() => handleFeedback(section.key, 'up')}
                className="p-1.5 rounded hover:bg-success-light text-text-muted hover:text-success transition"
              >
                <ThumbsUp size={14} />
              </button>
              <button
                onClick={() => handleFeedback(section.key, 'down')}
                className="p-1.5 rounded hover:bg-danger-light text-text-muted hover:text-danger transition"
              >
                <ThumbsDown size={14} />
              </button>
            </div>
          </div>
        ))}

        {/* Priorities */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-primary" />
            <h2 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide">
              Next Week Priorities
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {priorities.map((p) => (
              <Card key={p.rank} className="border border-border">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="text-xs font-mono font-bold text-text-inverse">{p.rank}</span>
                  </div>
                  <div>
                    <p className="text-base font-ui font-semibold text-text-primary">{p.title}</p>
                    <p className="text-sm text-text-secondary font-ui mt-0.5">{p.reason}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
