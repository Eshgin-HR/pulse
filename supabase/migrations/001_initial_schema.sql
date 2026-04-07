-- PULSE: Weekly Intelligence System for PASHA Holding
-- Initial schema

-- Users table
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT,
  log_day     TEXT DEFAULT 'sunday',
  onboarded   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Areas (work areas within PASHA Holding)
CREATE TABLE areas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  priority    TEXT CHECK (priority IN ('p1', 'p2', 'p3')) DEFAULT 'p2',
  color_tag   TEXT DEFAULT 'lavender',
  status      TEXT CHECK (status IN ('active', 'paused', 'completed')) DEFAULT 'active',
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (belong to areas)
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id     UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  status      TEXT CHECK (status IN ('todo', 'in_progress', 'done')) DEFAULT 'todo',
  notes       TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Skills (growth tracking)
CREATE TABLE skills (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  sort_order    INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly logs
CREATE TABLE weekly_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,
  week_number     INTEGER NOT NULL,
  year            INTEGER NOT NULL,
  honest_reflection TEXT,
  energy_level    INTEGER CHECK (energy_level BETWEEN 1 AND 5),
  focus_level     INTEGER CHECK (focus_level BETWEEN 1 AND 5),
  status          TEXT CHECK (status IN ('draft', 'complete')) DEFAULT 'draft',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

-- Area weekly entries (one per area per week)
CREATE TABLE area_weekly_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id          UUID NOT NULL REFERENCES weekly_logs(id) ON DELETE CASCADE,
  area_id         UUID NOT NULL REFERENCES areas(id),
  accomplishments TEXT,
  status          TEXT CHECK (status IN ('on_track', 'slightly_delayed', 'blocked')),
  actual_pct      INTEGER CHECK (actual_pct BETWEEN 0 AND 100),
  ideal_pct       INTEGER CHECK (ideal_pct BETWEEN 0 AND 100),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Blockers
CREATE TABLE blockers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id          UUID NOT NULL REFERENCES weekly_logs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  description     TEXT NOT NULL,
  blocking_what   TEXT,
  blocker_type    TEXT CHECK (blocker_type IN ('person', 'system', 'decision', 'resource')),
  blocking_name   TEXT,
  since_date      DATE NOT NULL,
  is_resolved     BOOLEAN DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Growth entries (one per skill per week, if evidence exists)
CREATE TABLE growth_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id      UUID NOT NULL REFERENCES weekly_logs(id) ON DELETE CASCADE,
  skill_id    UUID NOT NULL REFERENCES skills(id),
  evidence    TEXT NOT NULL,
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- AI Briefings
CREATE TABLE briefings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id              UUID NOT NULL REFERENCES weekly_logs(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id),
  summary             TEXT,
  resource_diagnosis  TEXT,
  bottleneck_report   TEXT,
  priorities          JSONB,
  growth_signal       TEXT,
  raw_prompt          TEXT,
  model_used          TEXT DEFAULT 'gpt-4o',
  tokens_used         INTEGER,
  generated_at        TIMESTAMPTZ DEFAULT NOW(),
  is_current          BOOLEAN DEFAULT true
);

-- Briefing feedback
CREATE TABLE briefing_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id UUID NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  section     TEXT NOT NULL,
  rating      TEXT CHECK (rating IN ('up', 'down')),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ ROW LEVEL SECURITY ═══

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own data" ON users FOR ALL USING (id = auth.uid());

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own areas" ON areas FOR ALL USING (user_id = auth.uid());

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own tasks" ON tasks FOR ALL USING (user_id = auth.uid());

ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own skills" ON skills FOR ALL USING (user_id = auth.uid());

ALTER TABLE weekly_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own logs" ON weekly_logs FOR ALL USING (user_id = auth.uid());

ALTER TABLE area_weekly_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own area entries" ON area_weekly_entries FOR ALL
  USING (log_id IN (SELECT id FROM weekly_logs WHERE user_id = auth.uid()));

ALTER TABLE blockers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own blockers" ON blockers FOR ALL USING (user_id = auth.uid());

ALTER TABLE growth_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own growth entries" ON growth_entries FOR ALL
  USING (log_id IN (SELECT id FROM weekly_logs WHERE user_id = auth.uid()));

ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own briefings" ON briefings FOR ALL USING (user_id = auth.uid());

ALTER TABLE briefing_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own feedback" ON briefing_feedback FOR ALL
  USING (briefing_id IN (SELECT id FROM briefings WHERE user_id = auth.uid()));

-- ═══ INDEXES ═══

CREATE INDEX idx_areas_user ON areas(user_id);
CREATE INDEX idx_tasks_area ON tasks(area_id);
CREATE INDEX idx_tasks_user ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_weekly_logs_user_week ON weekly_logs(user_id, week_start);
CREATE INDEX idx_area_weekly_entries_log ON area_weekly_entries(log_id);
CREATE INDEX idx_blockers_user ON blockers(user_id);
CREATE INDEX idx_blockers_resolved ON blockers(is_resolved);
CREATE INDEX idx_growth_entries_log ON growth_entries(log_id);
CREATE INDEX idx_briefings_log ON briefings(log_id);
CREATE INDEX idx_briefings_user ON briefings(user_id);
