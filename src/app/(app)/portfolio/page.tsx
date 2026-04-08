'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Portfolio,
  PortfolioStatus,
  PORTFOLIO_COLORS,
  PORTFOLIO_STATUS_CONFIG,
} from '@/types';
import { cn, formatDate, dueDateColor } from '@/lib/utils';
import Link from 'next/link';
import {
  Plus,
  X,
  MoreHorizontal,
  Trash2,
  Archive,
  Pencil,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [allTasks, setAllTasks] = useState<{ id: string; portfolio_id: string | null; status: string; due_date: string | null; is_archived: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<PortfolioStatus>('planning');
  const [formColor, setFormColor] = useState(PORTFOLIO_COLORS[0].value);

  // Context menu
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: portfoliosData } = await supabase
        .from('portfolios')
        .select('*')
        .eq('is_archived', false)
        .order('sort_order');

      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, portfolio_id, status, due_date, is_archived')
        .eq('is_archived', false);

      if (tasksData) setAllTasks(tasksData);
      if (portfoliosData) setPortfolios(portfoliosData);
      setLoading(false);
    }
    load();
  }, []);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu]')) setMenuId(null);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const today = new Date().toISOString().split('T')[0];

  function enrichPortfolio(p: Portfolio) {
    const pTasks = allTasks.filter((t) => t.portfolio_id === p.id);
    return {
      ...p,
      task_count: pTasks.length,
      done_count: pTasks.filter((t) => t.status === 'done').length,
      overdue_count: pTasks.filter(
        (t) => t.due_date && t.due_date < today && t.status !== 'done'
      ).length,
      nearest_due:
        pTasks
          .filter((t) => t.due_date && t.status !== 'done')
          .sort((a, b) => (a.due_date! > b.due_date! ? 1 : -1))[0]
          ?.due_date || null,
    };
  }

  function openNewModal() {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormStatus('planning');
    setFormColor(PORTFOLIO_COLORS[0].value);
    setShowModal(true);
  }

  function openEditModal(p: Portfolio) {
    setEditingId(p.id);
    setFormName(p.name);
    setFormDescription(p.description || '');
    setFormStatus(p.status);
    setFormColor(p.color);
    setShowModal(true);
    setMenuId(null);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormStatus('planning');
    setFormColor(PORTFOLIO_COLORS[0].value);
  }

  async function savePortfolio() {
    if (!formName.trim()) return;
    const supabase = createClient();

    if (editingId) {
      const { data } = await supabase
        .from('portfolios')
        .update({
          name: formName.trim(),
          description: formDescription || null,
          status: formStatus,
          color: formColor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId)
        .select('*')
        .single();
      if (data) {
        setPortfolios((prev) =>
          prev.map((p) => (p.id === editingId ? data : p))
        );
      }
    } else {
      const { data } = await supabase
        .from('portfolios')
        .insert({
          name: formName.trim(),
          description: formDescription || null,
          status: formStatus,
          color: formColor,
        })
        .select('*')
        .single();
      if (data) {
        setPortfolios((prev) => [...prev, data]);
      }
    }
    closeModal();
  }

  async function archivePortfolio(id: string) {
    setPortfolios((prev) => prev.filter((p) => p.id !== id));
    setMenuId(null);
    const supabase = createClient();
    await supabase
      .from('portfolios')
      .update({ is_archived: true })
      .eq('id', id);
  }

  async function deletePortfolio(id: string) {
    setPortfolios((prev) => prev.filter((p) => p.id !== id));
    setMenuId(null);
    const supabase = createClient();
    await supabase.from('portfolios').delete().eq('id', id);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-tx-primary tracking-tight">
            Portfolio
          </h1>
          <p className="text-sm text-tx-muted mt-0.5">
            {portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-brand text-tx-inverse text-sm font-semibold hover:bg-brand-hover transition-colors"
        >
          <Plus size={15} />
          New Portfolio
        </button>
      </div>

      {/* Portfolio Cards Grid */}
      {portfolios.length === 0 ? (
        <div className="card-gradient rounded-xl py-16 text-center">
          <p className="text-sm text-tx-muted">
            No portfolios yet. Create your first portfolio to organise tasks.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {portfolios.map((raw) => {
            const p = enrichPortfolio(raw);
            const pStatus = PORTFOLIO_STATUS_CONFIG[p.status];
            const pct =
              p.task_count
                ? Math.round(((p.done_count || 0) / p.task_count) * 100)
                : 0;
            return (
              <div key={p.id} className="card-gradient rounded-xl overflow-hidden group relative">
                {/* Color accent bar */}
                <div
                  className="h-[3px] opacity-70"
                  style={{
                    background: `linear-gradient(90deg, ${p.color}, transparent)`,
                  }}
                />

                <div className="p-5">
                  {/* Top row: name + 3-dot menu */}
                  <div className="flex items-start justify-between mb-1">
                    <Link
                      href={`/portfolio/${p.id}`}
                      className="min-w-0 flex-1"
                    >
                      <h3 className="text-[15px] font-semibold text-tx-primary truncate group-hover:text-brand transition-colors">
                        {p.name}
                      </h3>
                    </Link>

                    <div className="relative shrink-0 ml-2" data-menu>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuId(menuId === p.id ? null : p.id);
                        }}
                        className="p-1 rounded hover:bg-subtle text-tx-muted hover:text-tx-primary transition-all opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                      {menuId === p.id && (
                        <div className="absolute right-0 top-8 z-50 w-36 bg-surface border border-border rounded-lg shadow-md py-1">
                          <button
                            onClick={() => openEditModal(raw)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-tx-secondary hover:bg-subtle hover:text-tx-primary transition-colors"
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            onClick={() => archivePortfolio(p.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-tx-secondary hover:bg-subtle hover:text-tx-primary transition-colors"
                          >
                            <Archive size={13} /> Archive
                          </button>
                          <button
                            onClick={() => deletePortfolio(p.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-subtle transition-colors"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {p.description && (
                    <p className="text-2xs text-tx-muted mb-3 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                  {!p.description && <div className="mb-3" />}

                  {/* Status pill */}
                  <div className="mb-3">
                    <span
                      className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md"
                      style={{
                        backgroundColor: pStatus.bg,
                        color: pStatus.color,
                      }}
                    >
                      {pStatus.label}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1 bg-subtle rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: p.color }}
                    />
                  </div>

                  {/* Metrics row */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold font-mono text-tx-primary">
                          {p.task_count || 0}
                        </span>
                        <span className="text-2xs text-tx-muted">tasks</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle2
                          size={11}
                          style={{ color: '#22C55E' }}
                        />
                        <span
                          className="text-sm font-semibold font-mono"
                          style={{ color: '#22C55E' }}
                        >
                          {p.done_count || 0}
                        </span>
                        <span className="text-2xs text-tx-muted">done</span>
                      </div>
                      {(p.overdue_count || 0) > 0 && (
                        <div className="flex items-center gap-1">
                          <AlertTriangle
                            size={11}
                            style={{ color: '#EF4444' }}
                          />
                          <span
                            className="text-sm font-semibold font-mono"
                            style={{ color: '#EF4444' }}
                          >
                            {p.overdue_count}
                          </span>
                          <span className="text-2xs text-tx-muted">
                            overdue
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nearest deadline */}
                  {p.nearest_due && (
                    <div className="flex items-center gap-1 mt-2.5">
                      <Clock
                        size={11}
                        style={{ color: dueDateColor(p.nearest_due) }}
                      />
                      <span
                        className="text-2xs font-mono"
                        style={{ color: dueDateColor(p.nearest_due) }}
                      >
                        Next due {formatDate(p.nearest_due)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ NEW / EDIT PORTFOLIO MODAL ═══ */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-surface border border-border rounded-2xl shadow-lg w-full max-w-[480px] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-md font-semibold text-tx-primary">
                {editingId ? 'Edit Portfolio' : 'New Portfolio'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg hover:bg-subtle text-tx-muted hover:text-tx-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Name */}
              <div>
                <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">
                  Portfolio name *
                </label>
                <input
                  autoFocus
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Q2 Strategy"
                  className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-border-focus"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-subtle border border-border text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-border-focus resize-none"
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">
                  Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) =>
                    setFormStatus(e.target.value as PortfolioStatus)
                  }
                  className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary appearance-none cursor-pointer"
                >
                  {Object.entries(PORTFOLIO_STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color picker */}
              <div>
                <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-2 block">
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PORTFOLIO_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => setFormColor(c.value)}
                      className={cn(
                        'w-8 h-8 rounded-lg transition-all',
                        formColor === c.value
                          ? 'ring-2 ring-brand ring-offset-2 ring-offset-surface scale-110'
                          : 'hover:scale-105'
                      )}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button
                onClick={closeModal}
                className="h-9 px-4 rounded-lg text-sm font-medium text-tx-secondary hover:bg-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={savePortfolio}
                disabled={!formName.trim()}
                className="h-9 px-5 rounded-lg bg-brand text-tx-inverse text-sm font-semibold hover:bg-brand-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editingId ? 'Save Changes' : 'Create Portfolio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
