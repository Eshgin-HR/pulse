export type PortfolioStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type Urgency = 'low' | 'medium' | 'high' | 'critical';

export interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  status: PortfolioStatus;
  color: string;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Computed
  task_count?: number;
  done_count?: number;
  overdue_count?: number;
  nearest_due?: string | null;
}

export interface Task {
  id: string;
  title: string;
  portfolio_id: string | null;
  description: string | null;
  notes: string | null;
  start_date: string | null;
  due_date: string | null;
  status: TaskStatus;
  urgency: Urgency;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined
  portfolio?: Portfolio;
  subtasks?: Subtask[];
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  created_at: string;
}

export const PORTFOLIO_COLORS = [
  { value: '#1B3A2D', label: 'Forest' },
  { value: '#1E3A5F', label: 'Navy' },
  { value: '#4A1D5E', label: 'Plum' },
  { value: '#7C2D12', label: 'Rust' },
  { value: '#334155', label: 'Slate' },
  { value: '#134E4A', label: 'Teal' },
  { value: '#44403C', label: 'Stone' },
  { value: '#312E81', label: 'Indigo' },
];

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  todo: { label: 'To Do', color: 'var(--s-todo)', bg: 'var(--p-low-bg)' },
  in_progress: { label: 'In Progress', color: 'var(--s-inprogress)', bg: 'var(--p-medium-bg)' },
  in_review: { label: 'In Review', color: 'var(--s-review)', bg: 'var(--brand-pink-light)' },
  done: { label: 'Done', color: 'var(--s-done)', bg: 'rgba(107, 191, 138, 0.12)' },
};

export const URGENCY_CONFIG: Record<Urgency, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'var(--p-critical)', bg: 'var(--p-critical-bg)' },
  high: { label: 'High', color: 'var(--p-high)', bg: 'var(--p-high-bg)' },
  medium: { label: 'Medium', color: 'var(--p-medium)', bg: 'var(--p-medium-bg)' },
  low: { label: 'Low', color: 'var(--p-low)', bg: 'var(--p-low-bg)' },
};

export const PORTFOLIO_STATUS_CONFIG: Record<PortfolioStatus, { label: string; color: string; bg: string }> = {
  planning: { label: 'Planning', color: 'var(--s-todo)', bg: 'var(--p-low-bg)' },
  in_progress: { label: 'In Progress', color: 'var(--s-inprogress)', bg: 'var(--p-medium-bg)' },
  on_hold: { label: 'On Hold', color: 'var(--p-high)', bg: 'var(--p-high-bg)' },
  completed: { label: 'Completed', color: 'var(--s-done)', bg: 'rgba(107, 191, 138, 0.12)' },
};
