'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Task, Portfolio, TaskStatus, URGENCY_CONFIG } from '@/types';
import { cn, formatDate, dueDateColor } from '@/lib/utils';
import Link from 'next/link';
import {
  DndContext, closestCenter, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Clock, MoreHorizontal, Pencil, Archive, Trash2,
  Activity, CheckCircle2, AlertTriangle,
  RotateCcw,
} from 'lucide-react';

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: 'var(--s-todo)' },
  { id: 'in_progress', label: 'In Progress', color: 'var(--s-inprogress)' },
  { id: 'in_review', label: 'In Review', color: 'var(--s-review)' },
  { id: 'done', label: 'Done', color: 'var(--s-done)' },
];

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn('min-h-[200px] flex flex-col gap-2 p-1 rounded-lg transition-colors', isOver && 'bg-brand-subtle')}>
      {children}
    </div>
  );
}

function TaskCard({ task, portfolios, onMenu }: { task: Task; portfolios: Portfolio[]; onMenu: (id: string) => void }) {
  const portfolio = portfolios.find(p => p.id === task.portfolio_id);
  const urgCfg = URGENCY_CONFIG[task.urgency];
  const isOverdue = task.due_date && task.due_date < new Date().toISOString().split('T')[0] && task.status !== 'done';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      className={cn(
        'card-gradient rounded-lg p-3 cursor-grab active:cursor-grabbing group',
        isDragging && 'opacity-40',
        isOverdue && 'border-l-2',
      )}
      style={{ ...style, borderLeftColor: isOverdue ? 'var(--p-critical)' : undefined }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <Link href={`/tasks/${task.id}`} className="text-sm font-medium text-tx-primary hover:text-brand transition-colors line-clamp-2 flex-1"
          onClick={e => e.stopPropagation()}>
          {task.title}
        </Link>
        <button onClick={e => { e.stopPropagation(); onMenu(task.id); }}
          className="p-0.5 rounded hover:bg-subtle text-tx-muted hover:text-tx-primary opacity-0 group-hover:opacity-100 transition-all shrink-0">
          <MoreHorizontal size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {portfolio && (
          <span className="text-2xs font-medium text-tx-secondary bg-subtle rounded px-1.5 py-0.5">
            {portfolio.name.split('—')[0].trim()}
          </span>
        )}
        <span className="text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-md"
          style={{ backgroundColor: urgCfg.bg, color: urgCfg.color }}>
          {urgCfg.label}
        </span>
      </div>

      {task.due_date && (
        <div className="flex items-center gap-1 mt-2">
          <Clock size={10} style={{ color: dueDateColor(task.due_date) }} />
          <span className="text-2xs font-mono" style={{ color: dueDateColor(task.due_date), fontWeight: isOverdue ? 600 : 400 }}>
            {formatDate(task.due_date)}
            {isOverdue && <span className="ml-1 text-[9px] uppercase tracking-wider">overdue</span>}
          </span>
        </div>
      )}
    </div>
  );
}

export default function BoardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [filterPortfolio, setFilterPortfolio] = useState<string>('all');
  const [filterUrgency, setFilterUrgency] = useState<string>('all');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from('tasks').select('*, portfolio:portfolios(*)').eq('is_archived', false).order('sort_order'),
        supabase.from('portfolios').select('*').eq('is_archived', false).order('sort_order'),
      ]);
      if (t) setTasks(t);
      if (p) setPortfolios(p);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('[data-menu]')) setMenuTaskId(null);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (filterPortfolio !== 'all') result = result.filter(t => t.portfolio_id === filterPortfolio);
    if (filterUrgency !== 'all') result = result.filter(t => t.urgency === filterUrgency);
    return result;
  }, [tasks, filterPortfolio, filterUrgency]);

  // Stats
  const stats = useMemo(() => ({
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    overdue: tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length,
  }), [tasks, today]);

  function handleDragStart(e: DragStartEvent) {
    setActiveTask(tasks.find(t => t.id === e.active.id) || null);
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;

    const taskId = active.id as string;
    let targetStatus: TaskStatus | null = null;

    // Dropped on a column
    if (COLUMNS.some(c => c.id === over.id)) {
      targetStatus = over.id as TaskStatus;
    } else {
      // Dropped on another task — use that task's status
      const overTask = tasks.find(t => t.id === over.id);
      if (overTask) targetStatus = overTask.status;
    }

    if (!targetStatus) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: targetStatus! } : t));

    const supabase = createClient();
    await supabase.from('tasks').update({ status: targetStatus, updated_at: new Date().toISOString() }).eq('id', taskId);
  }

  async function updateStatus(taskId: string, status: TaskStatus) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    setMenuTaskId(null);
    const supabase = createClient();
    await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', taskId);
  }

  async function archiveTask(taskId: string) {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setMenuTaskId(null);
    const supabase = createClient();
    await supabase.from('tasks').update({ is_archived: true }).eq('id', taskId);
  }

  async function deleteTask(taskId: string) {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setMenuTaskId(null);
    const supabase = createClient();
    await supabase.from('tasks').delete().eq('id', taskId);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total', value: stats.total, icon: Activity, useTP: true },
          { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'var(--s-inprogress)' },
          { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: stats.overdue > 0 ? 'var(--p-critical)' : undefined, useTP: stats.overdue === 0 },
          { label: 'Done', value: stats.done, icon: CheckCircle2, color: 'var(--s-done)' },
        ].map(s => (
          <div key={s.label} className="card-gradient rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xs font-medium text-tx-muted uppercase tracking-widest">{s.label}</span>
              <s.icon size={13} className="text-tx-muted/60" />
            </div>
            <p className={cn("text-xl font-semibold font-mono", s.useTP && "text-tx-primary")} style={s.color ? { color: s.color } : undefined}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Header + Filters */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-tx-primary tracking-tight">Board</h1>
        <div className="flex items-center gap-2">
          <select value={filterPortfolio} onChange={e => setFilterPortfolio(e.target.value)}
            className={cn('h-8 px-3 rounded-lg border text-sm font-medium appearance-none cursor-pointer bg-surface transition-colors',
              filterPortfolio !== 'all' ? 'border-brand text-brand' : 'border-border text-tx-secondary')}>
            <option value="all">All portfolios</option>
            {portfolios.map(p => <option key={p.id} value={p.id}>{p.name.split('—')[0].trim()}</option>)}
          </select>
          <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)}
            className={cn('h-8 px-3 rounded-lg border text-sm font-medium appearance-none cursor-pointer bg-surface transition-colors',
              filterUrgency !== 'all' ? 'border-brand text-brand' : 'border-border text-tx-secondary')}>
            <option value="all">All urgency</option>
            {Object.entries(URGENCY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-4 gap-3">
          {COLUMNS.map(col => {
            const colTasks = filteredTasks.filter(t => t.status === col.id);
            return (
              <div key={col.id} className="card-gradient rounded-xl overflow-hidden">
                {/* Column Header */}
                <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-sm font-semibold text-tx-primary">{col.label}</span>
                  </div>
                  <span className="text-2xs font-mono text-tx-muted bg-subtle rounded px-1.5 py-0.5">{colTasks.length}</span>
                </div>

                {/* Cards */}
                <div className="p-2 min-h-[300px]">
                  <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <DroppableColumn id={col.id}>
                      {colTasks.map(task => (
                        <div key={task.id} className="relative" data-menu>
                          <TaskCard task={task} portfolios={portfolios} onMenu={setMenuTaskId} />
                          {menuTaskId === task.id && (
                            <div className="absolute right-2 top-10 z-50 w-40 bg-surface border border-border rounded-lg shadow-lg py-1">
                              {task.status === 'done' && (
                                <button onClick={() => updateStatus(task.id, 'todo')}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-tx-secondary hover:bg-subtle hover:text-tx-primary transition-colors">
                                  <RotateCcw size={13} /> Reopen
                                </button>
                              )}
                              <Link href={`/tasks/${task.id}`}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-tx-secondary hover:bg-subtle hover:text-tx-primary transition-colors">
                                <Pencil size={13} /> Edit
                              </Link>
                              <button onClick={() => archiveTask(task.id)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-tx-secondary hover:bg-subtle hover:text-tx-primary transition-colors">
                                <Archive size={13} /> Archive
                              </button>
                              <button onClick={() => deleteTask(task.id)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-subtle transition-colors">
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </DroppableColumn>
                  </SortableContext>
                </div>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="card-gradient rounded-lg p-3 shadow-lg w-[250px] rotate-2">
              <p className="text-sm font-medium text-tx-primary">{activeTask.title}</p>
              {activeTask.portfolio && (
                <span className="text-2xs text-tx-muted">{(activeTask.portfolio as Portfolio).name?.split('—')[0].trim()}</span>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
