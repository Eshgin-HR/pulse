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
  todo: { label: 'To Do', color: '#71717A', bg: 'rgba(113, 113, 122, 0.12)' },
  in_progress: { label: 'In Progress', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
  in_review: { label: 'In Review', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  done: { label: 'Done', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.12)' },
};

export const URGENCY_CONFIG: Record<Urgency, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' },
  high: { label: 'High', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  medium: { label: 'Medium', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
  low: { label: 'Low', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.12)' },
};

export const PORTFOLIO_STATUS_CONFIG: Record<PortfolioStatus, { label: string; color: string; bg: string }> = {
  planning: { label: 'Planning', color: '#71717A', bg: 'rgba(113, 113, 122, 0.12)' },
  in_progress: { label: 'In Progress', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
  on_hold: { label: 'On Hold', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  completed: { label: 'Completed', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.12)' },
};
