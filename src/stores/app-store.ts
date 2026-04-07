import { create } from 'zustand';
import { Area, Task, Skill, WeeklyLog, Blocker, Briefing, GrowthEntry, AreaWeeklyEntry } from '@/types';

interface AppState {
  // User
  user: { id: string; email: string; full_name: string | null; onboarded: boolean } | null;
  setUser: (user: AppState['user']) => void;

  // Areas & Tasks
  areas: Area[];
  tasks: Task[];
  setAreas: (areas: Area[]) => void;
  setTasks: (tasks: Task[]) => void;
  addArea: (area: Area) => void;
  updateArea: (id: string, data: Partial<Area>) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, data: Partial<Task>) => void;
  removeTask: (id: string) => void;

  // Skills
  skills: Skill[];
  setSkills: (skills: Skill[]) => void;
  addSkill: (skill: Skill) => void;

  // Weekly log
  currentLog: WeeklyLog | null;
  areaEntries: AreaWeeklyEntry[];
  blockers: Blocker[];
  growthEntries: GrowthEntry[];
  setCurrentLog: (log: WeeklyLog | null) => void;
  setAreaEntries: (entries: AreaWeeklyEntry[]) => void;
  setBlockers: (blockers: Blocker[]) => void;
  setGrowthEntries: (entries: GrowthEntry[]) => void;

  // Briefing
  currentBriefing: Briefing | null;
  setCurrentBriefing: (briefing: Briefing | null) => void;

  // Log step
  logStep: number;
  setLogStep: (step: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  areas: [],
  tasks: [],
  setAreas: (areas) => set({ areas }),
  setTasks: (tasks) => set({ tasks }),
  addArea: (area) => set((s) => ({ areas: [...s.areas, area] })),
  updateArea: (id, data) =>
    set((s) => ({ areas: s.areas.map((a) => (a.id === id ? { ...a, ...data } : a)) })),
  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTask: (id, data) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...data } : t)) })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  skills: [],
  setSkills: (skills) => set({ skills }),
  addSkill: (skill) => set((s) => ({ skills: [...s.skills, skill] })),

  currentLog: null,
  areaEntries: [],
  blockers: [],
  growthEntries: [],
  setCurrentLog: (log) => set({ currentLog: log }),
  setAreaEntries: (entries) => set({ areaEntries: entries }),
  setBlockers: (blockers) => set({ blockers }),
  setGrowthEntries: (entries) => set({ growthEntries: entries }),

  currentBriefing: null,
  setCurrentBriefing: (briefing) => set({ currentBriefing: briefing }),

  logStep: 1,
  setLogStep: (step) => set({ logStep: step }),
}));
