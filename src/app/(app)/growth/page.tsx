'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Skill, GrowthEntry } from '@/types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

interface SkillData {
  skill: Skill;
  entries: (GrowthEntry & { weekNumber: number })[];
  avg: number | null;
  trend: 'up' | 'flat' | 'down' | 'no_data';
  latestRating: number | null;
  gapWeeks: number;
}

export default function GrowthPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillData, setSkillData] = useState<SkillData[]>([]);
  const [trendData, setTrendData] = useState<Record<string, number | string | null>[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [skillsRes, logsRes] = await Promise.all([
        supabase.from('skills').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
        supabase.from('weekly_logs').select('*').eq('user_id', user.id).eq('status', 'complete').order('week_start', { ascending: true }),
      ]);

      const allSkills = skillsRes.data || [];
      const allLogs = logsRes.data || [];
      setSkills(allSkills);

      if (allLogs.length === 0) { setLoading(false); return; }

      const logIds = allLogs.map((l) => l.id);
      const { data: growthEntries } = await supabase
        .from('growth_entries')
        .select('*')
        .in('log_id', logIds);

      const logMap = new Map(allLogs.map((l) => [l.id, l]));

      // Build skill data
      const sd: SkillData[] = allSkills.map((skill) => {
        const entries = (growthEntries || [])
          .filter((g) => g.skill_id === skill.id)
          .map((g) => ({
            ...g,
            weekNumber: logMap.get(g.log_id)?.week_number || 0,
          }))
          .sort((a, b) => a.weekNumber - b.weekNumber);

        const ratings = entries.map((e) => e.rating);
        const avg = ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : null;

        let trend: 'up' | 'flat' | 'down' | 'no_data' = 'no_data';
        if (ratings.length >= 3) {
          const recent = ratings.slice(-2);
          const older = ratings.slice(0, 2);
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
          if (recentAvg > olderAvg + 0.3) trend = 'up';
          else if (recentAvg < olderAvg - 0.3) trend = 'down';
          else trend = 'flat';
        }

        const latestRating = ratings.length > 0 ? ratings[ratings.length - 1] : null;

        // Gap weeks: how many recent weeks have no entry
        const recentLogs = allLogs.slice(-4);
        const recentLogIds = new Set(recentLogs.map((l) => l.id));
        const recentEntries = entries.filter((e) => recentLogIds.has(e.log_id));
        const gapWeeks = recentLogs.length - recentEntries.length;

        return { skill, entries, avg, trend, latestRating, gapWeeks };
      });

      setSkillData(sd);

      // Build trend line data
      const td = allLogs.slice(-8).map((log) => {
        const row: Record<string, number | string | null> = { week: `W${log.week_number}` };
        allSkills.forEach((skill) => {
          const entry = (growthEntries || []).find(
            (g) => g.skill_id === skill.id && g.log_id === log.id
          );
          row[skill.name] = entry ? entry.rating : null;
        });
        return row;
      });
      setTrendData(td);

      setLoading(false);
    }
    load();
  }, []);

  const radarData = skillData.map((sd) => ({
    skill: sd.skill.name,
    rating: sd.avg || 0,
    fullMark: 5,
  }));

  const colors = ['#5956E9', '#FF3B30', '#34C759', '#FF9500', '#007AFF', '#AF52DE', '#FF2D55'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-text-primary mb-6">Growth Tracker</h1>

      {/* Skill Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {skillData.map((sd) => {
          const TrendIcon = sd.trend === 'up' ? TrendingUp : sd.trend === 'down' ? TrendingDown : Minus;
          return (
            <Card key={sd.skill.id} className="border border-border">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-base font-ui font-semibold text-text-primary">{sd.skill.name}</h3>
                {sd.trend !== 'no_data' && (
                  <TrendIcon
                    size={16}
                    className={cn(
                      sd.trend === 'up' ? 'text-success' :
                      sd.trend === 'down' ? 'text-danger' : 'text-text-muted'
                    )}
                  />
                )}
              </div>
              <div className="flex items-center gap-4">
                {sd.avg !== null ? (
                  <p className="font-mono text-2xl text-text-primary">{sd.avg}</p>
                ) : (
                  <p className="text-sm text-text-muted font-ui">No data</p>
                )}
                {sd.latestRating !== null && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'w-4 h-1.5 rounded-full',
                          i < sd.latestRating! ? 'bg-primary' : 'bg-bg-muted'
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
              {sd.gapWeeks >= 2 && (
                <div className="flex items-center gap-1 mt-2">
                  <AlertCircle size={12} className="text-warning" />
                  <span className="text-xs text-warning font-ui">No evidence for {sd.gapWeeks} weeks</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Radar Chart */}
      {radarData.some((d) => d.rating > 0) && (
        <Card className="border border-border mb-8">
          <h3 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide mb-4">
            Skills Radar
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fontFamily: 'var(--font-ui)' }} />
              <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} />
              <Radar dataKey="rating" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Trend Lines */}
      {trendData.length > 0 && (
        <Card className="border border-border">
          <h3 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide mb-4">
            Skill Ratings Over Time
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fontFamily: 'var(--font-ui)' }} />
              <YAxis domain={[1, 5]} tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} />
              <Tooltip />
              {skills.map((skill, i) => (
                <Line
                  key={skill.id}
                  type="monotone"
                  dataKey={skill.name}
                  stroke={colors[i % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
