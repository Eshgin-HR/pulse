'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Area, Skill, AreaPriority } from '@/types';
import { Plus, X, Save, LogOut, Download } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [logDay, setLogDay] = useState('sunday');
  const [areas, setAreas] = useState<Area[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [newAreaName, setNewAreaName] = useState('');
  const [newSkillName, setNewSkillName] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserEmail(user.email || '');

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userData) {
        setUserName(userData.full_name || '');
        setLogDay(userData.log_day || 'sunday');
      }

      const { data: areasData } = await supabase
        .from('areas')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order');
      if (areasData) setAreas(areasData);

      const { data: skillsData } = await supabase
        .from('skills')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order');
      if (skillsData) setSkills(skillsData);

      setLoading(false);
    }
    load();
  }, []);

  async function saveProfile() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('users').update({
      full_name: userName,
      log_day: logDay,
    }).eq('id', user.id);

    setSaving(false);
  }

  async function addArea() {
    if (!newAreaName.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('areas')
      .insert({
        user_id: user.id,
        name: newAreaName.trim(),
        sort_order: areas.length,
      })
      .select()
      .single();

    if (data) {
      setAreas([...areas, data]);
      setNewAreaName('');
    }
  }

  async function updateAreaPriority(areaId: string, priority: AreaPriority) {
    const supabase = createClient();
    await supabase.from('areas').update({ priority }).eq('id', areaId);
    setAreas(areas.map((a) => a.id === areaId ? { ...a, priority } : a));
  }

  async function archiveArea(areaId: string) {
    const supabase = createClient();
    await supabase.from('areas').update({ status: 'completed' }).eq('id', areaId);
    setAreas(areas.filter((a) => a.id !== areaId));
  }

  async function addSkill() {
    if (!newSkillName.trim()) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('skills')
      .insert({
        user_id: user.id,
        name: newSkillName.trim(),
        sort_order: skills.length,
      })
      .select()
      .single();

    if (data) {
      setSkills([...skills, data]);
      setNewSkillName('');
    }
  }

  async function archiveSkill(skillId: string) {
    const supabase = createClient();
    await supabase.from('skills').update({ is_active: false }).eq('id', skillId);
    setSkills(skills.filter((s) => s.id !== skillId));
  }

  async function exportData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [areasRes, tasksRes, logsRes, , blockersRes, , briefingsRes, skillsRes] = await Promise.all([
      supabase.from('areas').select('*').eq('user_id', user.id),
      supabase.from('tasks').select('*').eq('user_id', user.id),
      supabase.from('weekly_logs').select('*').eq('user_id', user.id),
      supabase.from('area_weekly_entries').select('*').in('log_id', []),
      supabase.from('blockers').select('*').eq('user_id', user.id),
      supabase.from('growth_entries').select('*'),
      supabase.from('briefings').select('*').eq('user_id', user.id),
      supabase.from('skills').select('*').eq('user_id', user.id),
    ]);

    const exportObj = {
      exported_at: new Date().toISOString(),
      areas: areasRes.data,
      tasks: tasksRes.data,
      skills: skillsRes.data,
      weekly_logs: logsRes.data,
      blockers: blockersRes.data,
      briefings: briefingsRes.data,
    };

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
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
      <h1 className="font-display text-2xl text-text-primary mb-6">Settings</h1>

      {/* Profile */}
      <Card className="border border-border mb-6">
        <h2 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide mb-4">Profile</h2>
        <div className="flex flex-col gap-4">
          <Input
            label="Full Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Your name"
          />
          <Input label="Email" value={userEmail} disabled />
          <Select
            label="Weekly Log Day"
            value={logDay}
            onChange={(e) => setLogDay(e.target.value)}
            options={[
              { value: 'sunday', label: 'Sunday' },
              { value: 'monday', label: 'Monday' },
              { value: 'friday', label: 'Friday' },
              { value: 'saturday', label: 'Saturday' },
            ]}
          />
          <Button size="sm" onClick={saveProfile} disabled={saving}>
            <Save size={14} className="mr-2" /> {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </Card>

      {/* Areas */}
      <Card className="border border-border mb-6">
        <h2 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide mb-4">Work Areas</h2>
        <div className="flex flex-col gap-3">
          {areas.map((area) => (
            <div key={area.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-ui font-medium text-text-primary">{area.name}</span>
                <Badge variant={area.priority}>{area.priority.toUpperCase()}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={area.priority}
                  onChange={(e) => updateAreaPriority(area.id, e.target.value as AreaPriority)}
                  className="text-xs bg-bg-subtle border border-border rounded px-2 py-1"
                >
                  <option value="p1">P1</option>
                  <option value="p2">P2</option>
                  <option value="p3">P3</option>
                </select>
                <button onClick={() => archiveArea(area.id)} className="text-text-muted hover:text-danger transition">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="New area name"
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addArea()}
              className="flex-1"
            />
            <Button size="sm" variant="secondary" onClick={addArea}>
              <Plus size={14} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Skills */}
      <Card className="border border-border mb-6">
        <h2 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide mb-4">Growth Skills</h2>
        <div className="flex flex-col gap-3">
          {skills.map((skill) => (
            <div key={skill.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm font-ui font-medium text-text-primary">{skill.name}</span>
              <button onClick={() => archiveSkill(skill.id)} className="text-text-muted hover:text-danger transition">
                <X size={14} />
              </button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="New skill name"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSkill()}
              className="flex-1"
            />
            <Button size="sm" variant="secondary" onClick={addSkill}>
              <Plus size={14} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Account */}
      <Card className="border border-border">
        <h2 className="text-xs font-ui font-bold text-text-secondary uppercase tracking-wide mb-4">Account</h2>
        <div className="flex flex-col gap-3">
          <Button size="sm" variant="secondary" onClick={exportData}>
            <Download size={14} className="mr-2" /> Export My Data (JSON)
          </Button>
          <Button size="sm" variant="ghost" onClick={handleLogout}>
            <LogOut size={14} className="mr-2" /> Sign Out
          </Button>
        </div>
      </Card>
    </div>
  );
}
