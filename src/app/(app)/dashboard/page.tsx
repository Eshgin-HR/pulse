'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/stores/app-store';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatWeekRange, getWeekInfo } from '@/lib/utils';
import { Blocker, Briefing, ColorTag } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PenLine,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { areas, setAreas, tasks, setTasks } = useAppStore();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check onboarding
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!userData?.onboarded) {
        router.push('/onboarding');
        return;
      }

      setUserName(userData.full_name || user.email?.split('@')[0] || '');

      // Load areas
      const { data: areasData } = await supabase
        .from('areas')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('sort_order');
      if (areasData) setAreas(areasData);

      // Load tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*, area:areas(*)')
        .eq('user_id', user.id)
        .order('sort_order');
      if (tasksData) setTasks(tasksData);

      // Load latest briefing
      const { data: briefingData } = await supabase
        .from('briefings')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_current', true)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();
      if (briefingData) setBriefing(briefingData);

      // Load unresolved blockers
      const { data: blockersData } = await supabase
        .from('blockers')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_resolved', false)
        .order('since_date');
      if (blockersData) setBlockers(blockersData);

      setLoading(false);
    }
    load();
  }, [router, setAreas, setTasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const weekInfo = getWeekInfo();
  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  return (
    <div>
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="font-display text-2xl">
          <span className="text-text-muted">Hello,</span>{' '}
          <span className="text-text-primary">{userName}</span>
        </h1>
        <p className="text-sm text-text-secondary font-ui mt-1">
          Week {weekInfo.week_number} &middot; {formatWeekRange(weekInfo.week_start)}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="text-center">
          <p className="font-mono text-3xl text-text-primary">{todoCount}</p>
          <p className="text-xs text-text-secondary font-ui mt-1">To Do</p>
        </Card>
        <Card className="text-center">
          <p className="font-mono text-3xl text-primary">{inProgressCount}</p>
          <p className="text-xs text-text-secondary font-ui mt-1">In Progress</p>
        </Card>
        <Card className="text-center">
          <p className="font-mono text-3xl text-success">{doneCount}</p>
          <p className="text-xs text-text-secondary font-ui mt-1">Done</p>
        </Card>
        <Card className="text-center">
          <p className="font-mono text-3xl text-danger">{blockers.length}</p>
          <p className="text-xs text-text-secondary font-ui mt-1">Blockers</p>
        </Card>
      </div>

      {/* Log This Week CTA */}
      <Link href="/log">
        <Card tint="sky" className="mb-8 flex items-center justify-between cursor-pointer hover:shadow-sm transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <PenLine size={18} className="text-text-inverse" />
            </div>
            <div>
              <p className="text-base font-ui font-semibold text-text-primary">Log This Week</p>
              <p className="text-xs text-text-secondary font-ui">~5 minutes to complete</p>
            </div>
          </div>
          <ArrowRight size={18} className="text-text-muted" />
        </Card>
      </Link>

      {/* Areas Overview */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide">
          Work Areas
        </h2>
        <Link href="/kanban" className="text-sm font-ui font-semibold text-accent hover:text-accent-hover">
          See all
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {areas.map((area) => {
          const areaTasks = tasks.filter((t) => t.area_id === area.id);
          const done = areaTasks.filter((t) => t.status === 'done').length;
          const total = areaTasks.length;
          return (
            <Card key={area.id} tint={area.color_tag as ColorTag}>
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-md font-ui font-semibold text-text-primary">{area.name}</h3>
                <Badge variant={area.priority}>{area.priority.toUpperCase()}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary font-ui">
                <CheckCircle2 size={14} className="text-success" />
                <span>{done}/{total} tasks done</span>
              </div>
              {total > 0 && (
                <div className="mt-3 h-1.5 bg-white/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full transition-all"
                    style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Blockers */}
      {blockers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide mb-4">
            Open Blockers
          </h2>
          <div className="flex flex-col gap-3">
            {blockers.map((b) => (
              <Card key={b.id} className="border border-danger-light">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className="text-danger mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-ui font-medium text-text-primary">{b.description}</p>
                    {b.blocking_what && (
                      <p className="text-xs text-text-secondary font-ui mt-0.5">
                        Blocking: {b.blocking_what}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={b.blocker_type === 'person' ? 'warning' : 'info'}>
                        {b.blocker_type}
                      </Badge>
                      <span className="text-xs text-text-muted font-ui">Since {b.since_date}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Latest Briefing Preview */}
      {briefing && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide">
              Latest Briefing
            </h2>
            <Link
              href={`/briefing/${briefing.log_id}`}
              className="text-sm font-ui font-semibold text-accent hover:text-accent-hover"
            >
              Read full briefing
            </Link>
          </div>
          <div className="bg-[#F8F8FF] border-l-[3px] border-primary rounded-r-md p-5">
            <p className="text-base font-ui text-text-body leading-relaxed">
              {briefing.summary}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
