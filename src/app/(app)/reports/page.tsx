'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Area, Task, WeeklyLog, Blocker, GrowthEntry, Skill } from '@/types';
import { subWeeks, parseISO } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { Filter } from 'lucide-react';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<WeeklyLog[]>([]);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [growthEntries, setGrowthEntries] = useState<(GrowthEntry & { skill?: Skill })[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  // Filters
  const [dateRange, setDateRange] = useState<'4w' | '8w' | '12w' | 'all'>('4w');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [areasRes, tasksRes, logsRes, skillsRes] = await Promise.all([
        supabase.from('areas').select('*').eq('user_id', user.id).order('sort_order'),
        supabase.from('tasks').select('*').eq('user_id', user.id),
        supabase.from('weekly_logs').select('*').eq('user_id', user.id).eq('status', 'complete').order('week_start', { ascending: true }),
        supabase.from('skills').select('*').eq('user_id', user.id).eq('is_active', true),
      ]);

      if (areasRes.data) setAreas(areasRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
      if (logsRes.data) setLogs(logsRes.data);
      if (skillsRes.data) setSkills(skillsRes.data);

      const logIds = (logsRes.data || []).map((l) => l.id);
      if (logIds.length > 0) {
        const [, blockersRes, growthRes] = await Promise.all([
          supabase.from('area_weekly_entries').select('*, area:areas(*)').in('log_id', logIds),
          supabase.from('blockers').select('*').eq('user_id', user.id),
          supabase.from('growth_entries').select('*, skill:skills(*)').in('log_id', logIds),
        ]);
        if (blockersRes.data) setBlockers(blockersRes.data);
        if (growthRes.data) setGrowthEntries(growthRes.data);
      }

      setLoading(false);
    }
    load();
  }, []);

  // Filter logs by date range
  const filteredLogs = useMemo(() => {
    if (dateRange === 'all') return logs;
    const weeks = dateRange === '4w' ? 4 : dateRange === '8w' ? 8 : 12;
    const cutoff = subWeeks(new Date(), weeks);
    return logs.filter((l) => parseISO(l.week_start) >= cutoff);
  }, [logs, dateRange]);

  const filteredLogIds = useMemo(() => new Set(filteredLogs.map((l) => l.id)), [filteredLogs]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let t = tasks;
    if (selectedAreas.length > 0) {
      t = t.filter((task) => selectedAreas.includes(task.area_id));
    }
    if (selectedStatus !== 'all') {
      t = t.filter((task) => task.status === selectedStatus);
    }
    return t;
  }, [tasks, selectedAreas, selectedStatus]);

  // Task completion data per area
  const taskCompletionData = useMemo(() => {
    return areas
      .filter((a) => selectedAreas.length === 0 || selectedAreas.includes(a.id))
      .map((area) => {
        const areaTasks = tasks.filter((t) => t.area_id === area.id);
        const done = areaTasks.filter((t) => t.status === 'done').length;
        const inProgress = areaTasks.filter((t) => t.status === 'in_progress').length;
        const todo = areaTasks.filter((t) => t.status === 'todo').length;
        return { name: area.name, Done: done, 'In Progress': inProgress, 'To Do': todo };
      });
  }, [areas, tasks, selectedAreas]);

  // Energy & Focus trend
  const energyFocusData = useMemo(() => {
    return filteredLogs.map((log) => ({
      week: `W${log.week_number}`,
      Energy: log.energy_level,
      Focus: log.focus_level,
    }));
  }, [filteredLogs]);

  // Growth radar data
  const growthRadarData = useMemo(() => {
    return skills.map((skill) => {
      const entries = growthEntries.filter(
        (g) => g.skill_id === skill.id && filteredLogIds.has(g.log_id)
      );
      const avg = entries.length > 0
        ? Math.round((entries.reduce((a, b) => a + b.rating, 0) / entries.length) * 10) / 10
        : 0;
      return { skill: skill.name, rating: avg, fullMark: 5 };
    });
  }, [skills, growthEntries, filteredLogIds]);

  // Open blockers
  const openBlockers = blockers.filter((b) => !b.is_resolved).sort(
    (a, b) => new Date(a.since_date).getTime() - new Date(b.since_date).getTime()
  );

  function toggleArea(areaId: string) {
    setSelectedAreas((prev) =>
      prev.includes(areaId) ? prev.filter((a) => a !== areaId) : [...prev, areaId]
    );
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
      <h1 className="font-display text-2xl text-text-primary mb-6">Reports</h1>

      {/* Filters */}
      <Card className="mb-6 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-text-secondary" />
          <span className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide">Filters</span>
        </div>

        <div className="flex flex-wrap gap-4">
          {/* Date Range */}
          <div>
            <p className="text-xs text-text-muted font-ui mb-1.5">Date Range</p>
            <div className="flex gap-1.5">
              {(['4w', '8w', '12w', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-ui font-medium transition',
                    dateRange === range ? 'bg-primary text-text-inverse' : 'bg-bg-subtle text-text-secondary hover:bg-bg-muted'
                  )}
                >
                  {range === 'all' ? 'All' : range.replace('w', ' weeks')}
                </button>
              ))}
            </div>
          </div>

          {/* Area Filter */}
          <div>
            <p className="text-xs text-text-muted font-ui mb-1.5">Areas</p>
            <div className="flex gap-1.5 flex-wrap">
              {areas.map((area) => (
                <button
                  key={area.id}
                  onClick={() => toggleArea(area.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-ui font-medium transition',
                    selectedAreas.includes(area.id) ? 'bg-primary text-text-inverse' : 'bg-bg-subtle text-text-secondary hover:bg-bg-muted'
                  )}
                >
                  {area.name}
                </button>
              ))}
            </div>
          </div>

          {/* Task Status Filter */}
          <div>
            <p className="text-xs text-text-muted font-ui mb-1.5">Task Status</p>
            <div className="flex gap-1.5">
              {[
                { value: 'all', label: 'All' },
                { value: 'todo', label: 'To Do' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'done', label: 'Done' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedStatus(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-ui font-medium transition',
                    selectedStatus === opt.value ? 'bg-primary text-text-inverse' : 'bg-bg-subtle text-text-secondary hover:bg-bg-muted'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Completion per Area */}
        <Card className="border border-border">
          <h3 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide mb-4">
            Tasks by Area
          </h3>
          {taskCompletionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={taskCompletionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'var(--font-ui)' }} />
                <YAxis tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                <Tooltip />
                <Bar dataKey="Done" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="In Progress" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="To Do" fill="var(--color-bg-muted)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-muted font-ui py-10 text-center">No data yet</p>
          )}
        </Card>

        {/* Energy & Focus Trend */}
        <Card className="border border-border">
          <h3 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide mb-4">
            Energy & Focus Trend
          </h3>
          {energyFocusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={energyFocusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fontFamily: 'var(--font-ui)' }} />
                <YAxis domain={[1, 5]} tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Energy" stroke="var(--color-warning)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Focus" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-muted font-ui py-10 text-center">No data yet</p>
          )}
        </Card>

        {/* Growth Radar */}
        <Card className="border border-border">
          <h3 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide mb-4">
            Growth Skills Radar
          </h3>
          {growthRadarData.some((d) => d.rating > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={growthRadarData}>
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10, fontFamily: 'var(--font-ui)' }} />
                <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} />
                <Radar name="Avg Rating" dataKey="rating" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-muted font-ui py-10 text-center">No growth data yet</p>
          )}
        </Card>

        {/* Open Blockers */}
        <Card className="border border-border">
          <h3 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide mb-4">
            Open Blockers ({openBlockers.length})
          </h3>
          {openBlockers.length > 0 ? (
            <div className="flex flex-col gap-3 max-h-[250px] overflow-y-auto">
              {openBlockers.map((b) => {
                const ageDays = Math.floor((Date.now() - new Date(b.since_date).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={b.id} className="flex items-start gap-2 text-sm">
                    <span className={cn(
                      'shrink-0 w-2 h-2 rounded-full mt-1.5',
                      ageDays > 14 ? 'bg-danger' : ageDays > 7 ? 'bg-warning' : 'bg-info'
                    )} />
                    <div>
                      <p className="font-ui text-text-primary">{b.description}</p>
                      <p className="text-xs text-text-muted font-ui">
                        {b.blocker_type} &middot; {ageDays} days old
                        {b.blocking_what && ` &middot; Blocking: ${b.blocking_what}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-muted font-ui py-10 text-center">No open blockers</p>
          )}
        </Card>
      </div>

      {/* Task Summary Table */}
      <Card className="border border-border mt-6">
        <h3 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide mb-4">
          Task Summary ({filteredTasks.length} tasks)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-ui">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-xs text-text-muted font-medium">Task</th>
                <th className="text-left py-2 text-xs text-text-muted font-medium">Area</th>
                <th className="text-left py-2 text-xs text-text-muted font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.slice(0, 20).map((task) => {
                const area = areas.find((a) => a.id === task.area_id);
                return (
                  <tr key={task.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 text-text-primary">{task.name}</td>
                    <td className="py-2.5 text-text-secondary">{area?.name || '—'}</td>
                    <td className="py-2.5">
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        task.status === 'done' ? 'bg-success-light text-success' :
                        task.status === 'in_progress' ? 'bg-primary-light text-primary' :
                        'bg-bg-subtle text-text-secondary'
                      )}>
                        {task.status === 'in_progress' ? 'In Progress' : task.status === 'done' ? 'Done' : 'To Do'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
