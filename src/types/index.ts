export type AreaPriority = 'p1' | 'p2' | 'p3';
export type AreaStatus = 'active' | 'paused' | 'completed';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type WeekStatus = 'on_track' | 'slightly_delayed' | 'blocked';
export type BlockerType = 'person' | 'system' | 'decision' | 'resource';
export type LogStatus = 'draft' | 'complete';
export type ColorTag = 'lavender' | 'peach' | 'sky' | 'mint' | 'lemon' | 'rose';

export interface Area {
  id: string;
  user_id: string;
  name: string;
  priority: AreaPriority;
  color_tag: ColorTag;
  status: AreaStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  area_id: string;
  user_id: string;
  name: string;
  status: TaskStatus;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  area?: Area;
}

export interface Skill {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface WeeklyLog {
  id: string;
  user_id: string;
  week_start: string;
  week_number: number;
  year: number;
  honest_reflection: string | null;
  energy_level: number | null;
  focus_level: number | null;
  status: LogStatus;
  created_at: string;
  updated_at: string;
}

export interface AreaWeeklyEntry {
  id: string;
  log_id: string;
  area_id: string;
  accomplishments: string | null;
  status: WeekStatus;
  actual_pct: number;
  ideal_pct: number;
  created_at: string;
  area?: Area;
}

export interface Blocker {
  id: string;
  log_id: string;
  user_id: string;
  description: string;
  blocking_what: string | null;
  blocker_type: BlockerType;
  blocking_name: string | null;
  since_date: string;
  is_resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  age_days?: number;
}

export interface GrowthEntry {
  id: string;
  log_id: string;
  skill_id: string;
  evidence: string;
  rating: number;
  created_at: string;
  skill?: Skill;
}

export interface Priority {
  rank: number;
  title: string;
  reason: string;
  area_id?: string;
}

export interface Briefing {
  id: string;
  log_id: string;
  user_id: string;
  summary: string;
  resource_diagnosis: string;
  bottleneck_report: string;
  priorities: Priority[];
  growth_signal: string;
  raw_prompt: string | null;
  model_used: string;
  tokens_used: number;
  generated_at: string;
  is_current: boolean;
}

export interface WeeklyPayload {
  week: {
    number: number;
    year: number;
    start: string;
    end: string;
  };
  area_entries: AreaWeeklyEntry[];
  blockers: Blocker[];
  reflection: string;
  energy_level: number;
  focus_level: number;
  growth_entries: GrowthEntry[];
  history: {
    last_4_weeks: WeeklyLog[];
    skill_ratings: SkillRatingHistory[];
  };
}

export interface SkillRatingHistory {
  skill_id: string;
  skill_name: string;
  ratings: { week: string; rating: number | null }[];
  rolling_avg: number | null;
  trend: 'up' | 'flat' | 'down' | 'no_data';
}

export const AREA_COLORS: Record<ColorTag, string> = {
  lavender: 'bg-card-lavender',
  peach: 'bg-card-peach',
  sky: 'bg-card-sky',
  mint: 'bg-card-mint',
  lemon: 'bg-card-lemon',
  rose: 'bg-card-rose',
};

export const COLOR_TAG_OPTIONS: ColorTag[] = ['lavender', 'peach', 'sky', 'mint', 'lemon', 'rose'];
