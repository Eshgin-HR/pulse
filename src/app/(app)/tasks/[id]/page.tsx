'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Task,
  Subtask,
  TaskStatus,
  Urgency,
  STATUS_CONFIG,
  URGENCY_CONFIG,
} from '@/types';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  X,
  Trash2,
  Check,
  ChevronDown,
  Loader2,
} from 'lucide-react';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);

  // Editing states
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showUrgencyDropdown, setShowUrgencyDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  // Load task data
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: taskData }, { data: subtasksData }] =
        await Promise.all([
          supabase
            .from('tasks')
            .select('*, portfolio:portfolios(*)')
            .eq('id', taskId)
            .single(),
          supabase
            .from('subtasks')
            .select('*')
            .eq('task_id', taskId)
            .order('sort_order'),
        ]);

      if (taskData) {
        setTask(taskData);
        setTitleDraft(taskData.title);
        setDescription(taskData.description || '');
        setNotes(taskData.notes || '');
      }
      if (subtasksData) setSubtasks(subtasksData);
      setLoading(false);
    }
    load();
  }, [taskId]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setShowUrgencyDropdown(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const updateTask = useCallback(
    async (fields: Partial<Task>) => {
      if (!task) return;
      const supabase = createClient();
      const { data } = await supabase
        .from('tasks')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .select('*, portfolio:portfolios(*)')
        .single();
      if (data) setTask(data);
    },
    [task, taskId]
  );

  // Title save
  function handleTitleBlur() {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft !== task?.title) {
      updateTask({ title: titleDraft.trim() });
    } else {
      setTitleDraft(task?.title || '');
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === 'Escape') {
      setTitleDraft(task?.title || '');
      setEditingTitle(false);
    }
  }

  // Description & Notes auto-save on blur
  function handleDescriptionBlur() {
    if (description !== (task?.description || '')) {
      updateTask({ description: description || null });
    }
  }

  function handleNotesBlur() {
    if (notes !== (task?.notes || '')) {
      updateTask({ notes: notes || null });
    }
  }

  // Status
  function handleStatusChange(status: TaskStatus) {
    updateTask({ status });
  }

  // Urgency
  function handleUrgencyChange(urgency: Urgency) {
    updateTask({ urgency });
    setShowUrgencyDropdown(false);
  }

  // Dates
  function handleDueDateChange(val: string) {
    updateTask({ due_date: val || null });
  }

  function handleStartDateChange(val: string) {
    updateTask({ start_date: val || null });
  }

  // Subtask toggle
  async function toggleSubtask(subtask: Subtask) {
    const supabase = createClient();
    const { data } = await supabase
      .from('subtasks')
      .update({ is_done: !subtask.is_done })
      .eq('id', subtask.id)
      .select()
      .single();
    if (data) {
      setSubtasks((prev) => prev.map((s) => (s.id === data.id ? data : s)));
    }
  }

  // Add subtask
  async function addSubtask() {
    if (!newSubtaskTitle.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('subtasks')
      .insert({
        task_id: taskId,
        title: newSubtaskTitle.trim(),
        is_done: false,
        sort_order: subtasks.length,
      })
      .select()
      .single();
    if (data) {
      setSubtasks((prev) => [...prev, data]);
      setNewSubtaskTitle('');
    }
  }

  // Delete subtask
  async function deleteSubtask(id: string) {
    const supabase = createClient();
    await supabase.from('subtasks').delete().eq('id', id);
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  }

  // Delete task
  async function handleDeleteTask() {
    const supabase = createClient();
    await supabase.from('subtasks').delete().eq('task_id', taskId);
    await supabase.from('tasks').delete().eq('id', taskId);
    router.push('/tasks');
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '60vh',
        }}
      >
        <Loader2
          size={24}
          style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 16px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 16 }}>
          Task not found.
        </p>
        <Link
          href="/tasks"
          style={{ color: 'var(--brand)', fontSize: 14, textDecoration: 'none' }}
        >
          Back to Tasks
        </Link>
      </div>
    );
  }

  const doneCount = subtasks.filter((s) => s.is_done).length;
  const totalSubtasks = subtasks.length;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 64px' }}>
      {/* Back link */}
      <Link
        href="/tasks"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--text-secondary)',
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'none',
          marginBottom: 24,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        <ArrowLeft size={14} />
        Tasks
      </Link>

      {/* Title */}
      {editingTitle ? (
        <input
          ref={titleRef}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          autoFocus
          style={{
            width: '100%',
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text-primary)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            marginBottom: 8,
            lineHeight: 1.3,
          }}
        />
      ) : (
        <h1
          onClick={() => {
            setEditingTitle(true);
            setTimeout(() => titleRef.current?.focus(), 0);
          }}
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 8,
            cursor: 'text',
            lineHeight: 1.3,
          }}
        >
          {task.title}
        </h1>
      )}

      {/* Portfolio link */}
      {task.portfolio && (
        <Link
          href={`/portfolios`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            marginBottom: 24,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--brand)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: task.portfolio.color,
              flexShrink: 0,
            }}
          />
          {task.portfolio.name}
        </Link>
      )}

      {/* Fields row */}
      <div
        className="card-gradient"
        style={{
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 20,
        }}
      >
        {/* Due Date */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 6,
            }}
          >
            Due Date
          </label>
          <input
            type="date"
            value={task.due_date || ''}
            onChange={(e) => handleDueDateChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        {/* Start Date */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 6,
            }}
          >
            Start Date
          </label>
          <input
            type="date"
            value={task.start_date || ''}
            onChange={(e) => handleStartDateChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        {/* Urgency */}
        <div style={{ position: 'relative' }} data-dropdown>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 6,
            }}
          >
            Urgency
          </label>
          <button
            onClick={() => setShowUrgencyDropdown(!showUrgencyDropdown)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: URGENCY_CONFIG[task.urgency].color,
                }}
              />
              {URGENCY_CONFIG[task.urgency].label}
            </span>
            <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
          </button>
          {showUrgencyDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                padding: 4,
                zIndex: 50,
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {(Object.keys(URGENCY_CONFIG) as Urgency[]).map((u) => (
                <button
                  key={u}
                  onClick={() => handleUrgencyChange(u)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: task.urgency === u ? 'var(--bg-subtle)' : 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: URGENCY_CONFIG[u].color,
                    }}
                  />
                  {URGENCY_CONFIG[u].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 6,
            }}
          >
            Status
          </label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => {
              const cfg = STATUS_CONFIG[s];
              const active = task.status === s;
              return (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: active ? 'none' : '1px solid var(--border)',
                    background: active ? cfg.bg : 'transparent',
                    color: active ? cfg.color : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Description */}
      <div
        className="card-gradient"
        style={{ borderRadius: 12, padding: 20, marginBottom: 20 }}
      >
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 10,
          }}
        >
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          placeholder="Add a description..."
          rows={4}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            color: 'var(--text-primary)',
            fontSize: 14,
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        />
      </div>

      {/* Subtasks */}
      <div
        className="card-gradient"
        style={{ borderRadius: 12, padding: 20, marginBottom: 20 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Subtasks
          </label>
          {totalSubtasks > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {doneCount}/{totalSubtasks}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {totalSubtasks > 0 && (
          <div
            style={{
              height: 3,
              borderRadius: 2,
              background: 'var(--bg-muted)',
              marginBottom: 14,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(doneCount / totalSubtasks) * 100}%`,
                background: 'var(--s-done)',
                borderRadius: 2,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        )}

        {/* Subtask list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {subtasks.map((sub) => (
            <div
              key={sub.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 4px',
                borderRadius: 6,
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--bg-subtle)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              <button
                onClick={() => toggleSubtask(sub)}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  border: sub.is_done
                    ? 'none'
                    : '2px solid var(--text-muted)',
                  background: sub.is_done ? 'var(--s-done)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                {sub.is_done && <Check size={11} style={{ color: '#fff' }} />}
              </button>
              <span
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: sub.is_done
                    ? 'var(--text-muted)'
                    : 'var(--text-primary)',
                  textDecoration: sub.is_done ? 'line-through' : 'none',
                }}
              >
                {sub.title}
              </span>
              <button
                onClick={() => deleteSubtask(sub.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.5,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Add subtask */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: subtasks.length > 0 ? 8 : 0,
          }}
        >
          <Plus
            size={14}
            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
          />
          <input
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addSubtask();
            }}
            placeholder="Add subtask..."
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
            }}
          />
          {newSubtaskTitle.trim() && (
            <button
              onClick={addSubtask}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--brand)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          )}
        </div>
      </div>

      {/* Notes */}
      <div
        className="card-gradient"
        style={{ borderRadius: 12, padding: 20, marginBottom: 20 }}
      >
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 10,
          }}
        >
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Add notes..."
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            color: 'var(--text-primary)',
            fontSize: 14,
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        />
      </div>

      {/* Delete Task */}
      <div
        className="card-gradient"
        style={{
          borderRadius: 12,
          padding: 20,
          borderColor: 'rgba(239, 68, 68, 0.2)',
        }}
      >
        {!showDeleteConfirm ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                }}
              >
                Delete Task
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  marginTop: 2,
                }}
              >
                Permanently remove this task and its subtasks
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--p-critical)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: 'var(--text-primary)',
                fontWeight: 500,
                marginBottom: 4,
              }}
            >
              Are you sure?
            </p>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginBottom: 16,
              }}
            >
              This will permanently delete this task and all subtasks. This
              action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleDeleteTask}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--p-critical)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Yes, delete task
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
