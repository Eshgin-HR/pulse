'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { formatWeekRange } from '@/lib/utils';
import { WeeklyLog, Briefing } from '@/types';
import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';

interface WeekEntry {
  log: WeeklyLog;
  briefing: Briefing | null;
}

export default function HistoryPage() {
  const [weeks, setWeeks] = useState<WeekEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: logs } = await supabase
        .from('weekly_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'complete')
        .order('week_start', { ascending: false });

      if (!logs) { setLoading(false); return; }

      const { data: briefings } = await supabase
        .from('briefings')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_current', true);

      const entries: WeekEntry[] = logs.map((log) => ({
        log,
        briefing: (briefings || []).find((b) => b.log_id === log.id) || null,
      }));

      setWeeks(entries);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-text-primary mb-6">History</h1>

      {weeks.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={32} className="text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary font-ui">
            No weekly logs yet. Start by logging your first week.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {weeks.map((entry) => (
            <Link key={entry.log.id} href={`/briefing/${entry.log.id}`}>
              <Card className="border border-border hover:shadow-sm transition cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-ui font-semibold text-text-primary">
                      Week {entry.log.week_number}
                    </h3>
                    <p className="text-xs text-text-secondary font-ui mt-0.5">
                      {formatWeekRange(entry.log.week_start)}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs font-ui text-text-muted">
                        Energy: {entry.log.energy_level}/5
                      </span>
                      <span className="text-xs font-ui text-text-muted">
                        Focus: {entry.log.focus_level}/5
                      </span>
                    </div>
                    {entry.briefing && (
                      <p className="text-sm text-text-body font-ui mt-2 line-clamp-2">
                        {entry.briefing.summary}
                      </p>
                    )}
                  </div>
                  <ArrowRight size={16} className="text-text-muted shrink-0 ml-4" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
