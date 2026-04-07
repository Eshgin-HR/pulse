'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/stores/app-store';
import { cn } from '@/lib/utils';
import { Task, TaskStatus, Area, ColorTag } from '@/types';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';

const columns: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo', label: 'To Do', color: 'text-text-secondary' },
  { id: 'in_progress', label: 'In Progress', color: 'text-primary' },
  { id: 'done', label: 'Done', color: 'text-success' },
];

const colorBgs: Record<ColorTag, string> = {
  lavender: 'border-l-[#C4B5FD]',
  peach: 'border-l-[#FCA5A1]',
  sky: 'border-l-[#93C5FD]',
  mint: 'border-l-[#6EE7B7]',
  lemon: 'border-l-[#FDE68A]',
  rose: 'border-l-[#FDA4AF]',
};

function TaskCard({ task, areas }: { task: Task; areas: Area[] }) {
  const area = areas.find((a) => a.id === task.area_id);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-bg-surface rounded-md p-3 shadow-xs border border-border cursor-grab active:cursor-grabbing',
        'border-l-[3px]',
        area ? colorBgs[area.color_tag as ColorTag] || 'border-l-border' : 'border-l-border',
        isDragging && 'opacity-50'
      )}
      {...attributes}
      {...listeners}
    >
      <p className="text-sm font-ui font-medium text-text-primary">{task.name}</p>
      {area && (
        <p className="text-xs text-text-muted font-ui mt-1">{area.name}</p>
      )}
    </div>
  );
}

export default function KanbanPage() {
  const { areas, setAreas, tasks, setTasks, updateTask } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [filterArea, setFilterArea] = useState<string>('all');
  const [newTaskName, setNewTaskName] = useState<Record<string, string>>({
    todo: '',
    in_progress: '',
    done: '',
  });
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: areasData } = await supabase
        .from('areas')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order');
      if (areasData) setAreas(areasData);

      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order');
      if (tasksData) setTasks(tasksData);

      setLoading(false);
    }
    load();
  }, [setAreas, setTasks]);

  const filteredTasks = filterArea === 'all'
    ? tasks
    : tasks.filter((t) => t.area_id === filterArea);

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;

    // Determine target column
    let targetStatus: TaskStatus | null = null;

    // If dropped on a column droppable
    if (columns.some((c) => c.id === over.id)) {
      targetStatus = over.id as TaskStatus;
    }
    // If dropped on another task, use that task's status
    else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) targetStatus = overTask.status;
    }

    if (!targetStatus) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    // Optimistic update
    updateTask(taskId, { status: targetStatus });

    // Persist
    const supabase = createClient();
    await supabase.from('tasks').update({ status: targetStatus }).eq('id', taskId);
  }

  async function addQuickTask(status: TaskStatus) {
    const name = newTaskName[status]?.trim();
    if (!name) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const areaId = filterArea !== 'all' ? filterArea : areas[0]?.id;
    if (!areaId) return;

    const { data: task } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        area_id: areaId,
        name,
        status,
      })
      .select()
      .single();

    if (task) {
      setTasks([...tasks, task]);
      setNewTaskName((prev) => ({ ...prev, [status]: '' }));
    }
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-text-primary">Kanban Board</h1>
      </div>

      {/* Area Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterArea('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-ui font-medium transition shrink-0',
            filterArea === 'all' ? 'bg-primary text-text-inverse' : 'bg-bg-subtle text-text-secondary hover:bg-bg-muted'
          )}
        >
          All Areas
        </button>
        {areas.map((area) => (
          <button
            key={area.id}
            onClick={() => setFilterArea(area.id)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-ui font-medium transition shrink-0',
              filterArea === area.id ? 'bg-primary text-text-inverse' : 'bg-bg-subtle text-text-secondary hover:bg-bg-muted'
            )}
          >
            {area.name}
          </button>
        ))}
      </div>

      {/* Kanban Columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="bg-bg-subtle rounded-lg p-4 min-h-[200px]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className={cn('text-sm font-ui font-bold', col.color)}>
                    {col.label}
                  </h3>
                  <span className="text-xs font-mono text-text-muted">{colTasks.length}</span>
                </div>

                <SortableContext items={colTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2 min-h-[60px]" id={col.id}>
                    {colTasks.map((task) => (
                      <TaskCard key={task.id} task={task} areas={areas} />
                    ))}
                  </div>
                </SortableContext>

                {/* Quick Add */}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Add task..."
                    value={newTaskName[col.id]}
                    onChange={(e) =>
                      setNewTaskName((prev) => ({ ...prev, [col.id]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === 'Enter' && addQuickTask(col.id)}
                    className="flex-1 px-3 py-2 bg-bg-surface rounded-md border border-border text-sm font-ui placeholder:text-text-muted focus:outline-none focus:border-border-focus"
                  />
                  <button
                    onClick={() => addQuickTask(col.id)}
                    className="p-2 rounded-md bg-bg-surface border border-border hover:bg-primary-light text-text-muted hover:text-primary transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="bg-bg-surface rounded-md p-3 shadow-card border border-border border-l-[3px] border-l-primary">
              <p className="text-sm font-ui font-medium text-text-primary">{activeTask.name}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
