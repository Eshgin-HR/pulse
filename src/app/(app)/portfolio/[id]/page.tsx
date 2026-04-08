'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Task,
  Portfolio,
  TaskStatus,
  Urgency,
  STATUS_CONFIG,
  URGENCY_CONFIG,
  PORTFOLIO_STATUS_CONFIG,
  PORTFOLIO_COLORS,
  PortfolioStatus,
} from '@/types';
import { cn, formatDate, dueDateColor } from '@/lib/utils';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Search,
  X,
  ChevronDown,
  Clock,
  MoreHorizontal,
  Trash2,
  Archive,
  Calendar,
  Pencil,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

type SortField = 'due_date' | 'urgency' | 'status' | 'title' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function PortfolioDetailPage() {
  const params = useParams();
  const portfolioId = params.id as string;

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [allPortfolios, setAllPortfolios] = useState<Portfolio[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatuses, setFilterStatuses] = useState<TaskStatus[]>([]);
  const [filterUrgencies, setFilterUrgencies] = useState<Urgency[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  // Task modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newPortfolioId, setNewPortfolioId] = useState(portfolioId);
  const [newDueDate, setNewDueDate] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatus>('todo');
  const [newUrgency, setNewUrgency] = useState<Urgency>('medium');
  const [newDescription, setNewDescription] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Edit portfolio modal
  const [showEditPortfolio, setShowEditPortfolio] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<PortfolioStatus>('planning');
  const [formColor, setFormColor] = useState(PORTFOLIO_COLORS[0].value);

  // Context menu
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: portfolioData } = await supabase
        .from('portfolios')
        .select('*')
        .eq('id', portfolioId)
        .single();

      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*, portfolio:portfolios(*)')
        .eq('portfolio_id', portfolioId)
        .eq('is_archived', false)
        .order('sort_order');

      const { data: allPortfoliosData } = await supabase
        .from('portfolios')
        .select('*')
        .eq('is_archived', false)
        .order('sort_order');

      if (portfolioData) setPortfolio(portfolioData);
      if (tasksData) setTasks(tasksData);
      if (allPortfoliosData) setAllPortfolios(allPortfoliosData);
      setLoading(false);
    }
    load();
  }, [portfolioId]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) setOpenFilter(null);
      if (!target.closest('[data-menu]')) setMenuTaskId(null);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const today = new Date().toISOString().split('T')[0];

  // Computed portfolio stats
  const taskCount = tasks.length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const overdueCount = tasks.filter(
    (t) => t.due_date && t.due_date < today && t.status !== 'done'
  ).length;

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (dateFrom)
      result = result.filter((t) => t.due_date && t.due_date >= dateFrom);
    if (dateTo)
      result = result.filter((t) => t.due_date && t.due_date <= dateTo);
    if (filterStatuses.length > 0)
      result = result.filter((t) => filterStatuses.includes(t.status));
    if (filterUrgencies.length > 0)
      result = result.filter((t) => filterUrgencies.includes(t.urgency));

    const urgOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const statOrder = { todo: 1, in_progress: 2, in_review: 3, done: 4 };
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'due_date') {
        const aD = a.due_date || '9999';
        const bD = b.due_date || '9999';
        cmp = aD < bD ? -1 : aD > bD ? 1 : 0;
      } else if (sortField === 'urgency')
        cmp = urgOrder[b.urgency] - urgOrder[a.urgency];
      else if (sortField === 'status')
        cmp = statOrder[a.status] - statOrder[b.status];
      else if (sortField === 'title') cmp = a.title.localeCompare(b.title);
      else cmp = a.created_at < b.created_at ? -1 : 1;
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [
    tasks,
    search,
    dateFrom,
    dateTo,
    filterStatuses,
    filterUrgencies,
    sortField,
    sortDir,
  ]);

  const hasFilters =
    filterStatuses.length > 0 ||
    filterUrgencies.length > 0 ||
    dateFrom ||
    dateTo ||
    search;

  // ── Task CRUD ──

  async function toggleDone(task: Task) {
    const ns = task.status === 'done' ? 'todo' : 'done';
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: ns } : t))
    );
    const supabase = createClient();
    await supabase
      .from('tasks')
      .update({ status: ns, updated_at: new Date().toISOString() })
      .eq('id', task.id);
  }

  async function updateStatus(taskId: string, status: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
    const supabase = createClient();
    await supabase
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', taskId);
  }

  async function updateUrgency(taskId: string, urgency: Urgency) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, urgency } : t))
    );
    const supabase = createClient();
    await supabase.from('tasks').update({ urgency }).eq('id', taskId);
  }

  function openNewTaskModal() {
    setEditingTaskId(null);
    setNewTitle('');
    setNewPortfolioId(portfolioId);
    setNewDueDate('');
    setNewStartDate('');
    setNewStatus('todo');
    setNewUrgency('medium');
    setNewDescription('');
    setNewNotes('');
    setShowTaskModal(true);
  }

  function openEditTaskModal(task: Task) {
    setEditingTaskId(task.id);
    setNewTitle(task.title);
    setNewPortfolioId(task.portfolio_id || portfolioId);
    setNewDueDate(task.due_date || '');
    setNewStartDate(task.start_date || '');
    setNewStatus(task.status);
    setNewUrgency(task.urgency);
    setNewDescription(task.description || '');
    setNewNotes(task.notes || '');
    setShowTaskModal(true);
    setMenuTaskId(null);
  }

  function closeTaskModal() {
    setShowTaskModal(false);
    setEditingTaskId(null);
    setNewTitle('');
    setNewDueDate('');
    setNewStartDate('');
    setNewStatus('todo');
    setNewUrgency('medium');
    setNewDescription('');
    setNewNotes('');
    setNewPortfolioId(portfolioId);
  }

  async function addTask() {
    if (!newTitle.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('tasks')
      .insert({
        title: newTitle.trim(),
        portfolio_id: newPortfolioId || null,
        due_date: newDueDate || null,
        start_date: newStartDate || null,
        status: newStatus,
        urgency: newUrgency,
        description: newDescription || null,
        notes: newNotes || null,
      })
      .select('*, portfolio:portfolios(*)')
      .single();
    if (data) {
      // Only add to local list if it belongs to this portfolio
      if (data.portfolio_id === portfolioId) {
        setTasks((prev) => [data, ...prev]);
      }
      closeTaskModal();
    }
  }

  async function saveEditTask() {
    if (!newTitle.trim() || !editingTaskId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('tasks')
      .update({
        title: newTitle.trim(),
        portfolio_id: newPortfolioId || null,
        due_date: newDueDate || null,
        start_date: newStartDate || null,
        status: newStatus,
        urgency: newUrgency,
        description: newDescription || null,
        notes: newNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingTaskId)
      .select('*, portfolio:portfolios(*)')
      .single();
    if (data) {
      if (data.portfolio_id === portfolioId) {
        setTasks((prev) =>
          prev.map((t) => (t.id === editingTaskId ? data : t))
        );
      } else {
        // Task moved to different portfolio, remove from local list
        setTasks((prev) => prev.filter((t) => t.id !== editingTaskId));
      }
      closeTaskModal();
    }
  }

  async function archiveTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setMenuTaskId(null);
    const supabase = createClient();
    await supabase
      .from('tasks')
      .update({ is_archived: true })
      .eq('id', taskId);
  }

  async function deleteTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setMenuTaskId(null);
    const supabase = createClient();
    await supabase.from('tasks').delete().eq('id', taskId);
  }

  // ── Portfolio Edit ──

  function openPortfolioEdit() {
    if (!portfolio) return;
    setFormName(portfolio.name);
    setFormDescription(portfolio.description || '');
    setFormStatus(portfolio.status);
    setFormColor(portfolio.color);
    setShowEditPortfolio(true);
  }

  async function savePortfolioEdit() {
    if (!formName.trim() || !portfolio) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('portfolios')
      .update({
        name: formName.trim(),
        description: formDescription || null,
        status: formStatus,
        color: formColor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', portfolio.id)
      .select('*')
      .single();
    if (data) setPortfolio(data);
    setShowEditPortfolio(false);
  }

  // ── Helpers ──

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function toggleMulti<T>(arr: T[], val: T, setter: (v: T[]) => void) {
    setter(
      arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
    );
  }

  function clearFilters() {
    setFilterStatuses([]);
    setFilterUrgencies([]);
    setDateFrom('');
    setDateTo('');
    setSearch('');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-tx-muted">Portfolio not found.</p>
        <Link
          href="/portfolio"
          className="text-sm text-brand hover:underline mt-2 inline-block"
        >
          Back to portfolios
        </Link>
      </div>
    );
  }

  const pStatus = PORTFOLIO_STATUS_CONFIG[portfolio.status];

  return (
    <div>
      {/* Back link */}
      <Link
        href="/portfolio"
        className="inline-flex items-center gap-1 text-sm text-tx-muted hover:text-brand transition-colors mb-4"
      >
        <ArrowLeft size={14} />
        Portfolio
      </Link>

      {/* Header card */}
      <div className="card-gradient rounded-xl overflow-hidden mb-6">
        <div
          className="h-[3px] opacity-70"
          style={{
            background: `linear-gradient(90deg, ${portfolio.color}, transparent)`,
          }}
        />
        <div className="p-5 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-tx-primary tracking-tight mb-1">
              {portfolio.name}
            </h1>
            {portfolio.description && (
              <p className="text-sm text-tx-muted mb-3">
                {portfolio.description}
              </p>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: pStatus.bg, color: pStatus.color }}
              >
                {pStatus.label}
              </span>

              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold font-mono text-tx-primary">
                  {taskCount}
                </span>
                <span className="text-2xs text-tx-muted">tasks</span>
              </div>

              <div className="flex items-center gap-1">
                <CheckCircle2 size={12} style={{ color: '#22C55E' }} />
                <span
                  className="text-sm font-semibold font-mono"
                  style={{ color: '#22C55E' }}
                >
                  {doneCount}
                </span>
                <span className="text-2xs text-tx-muted">done</span>
              </div>

              {overdueCount > 0 && (
                <div className="flex items-center gap-1">
                  <AlertTriangle size={12} style={{ color: '#EF4444' }} />
                  <span
                    className="text-sm font-semibold font-mono"
                    style={{ color: '#EF4444' }}
                  >
                    {overdueCount}
                  </span>
                  <span className="text-2xs text-tx-muted">overdue</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={openPortfolioEdit}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-sm font-medium text-tx-secondary hover:bg-subtle hover:text-tx-primary transition-colors shrink-0"
          >
            <Pencil size={13} />
            Edit
          </button>
        </div>
      </div>

      {/* Filter Bar + New Task */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tx-muted"
            />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 rounded-lg bg-surface border border-border text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-border-focus w-[180px] transition-colors"
            />
          </div>

          {/* Date Range */}
          <div
            className="relative"
            data-dropdown
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() =>
                setOpenFilter(openFilter === 'date' ? null : 'date')
              }
              className={cn(
                'h-8 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5',
                dateFrom || dateTo
                  ? 'border-brand text-brand bg-brand-subtle'
                  : 'border-border text-tx-secondary bg-surface hover:bg-subtle'
              )}
            >
              <Calendar size={13} />
              {dateFrom || dateTo
                ? `${dateFrom || '...'} \u2192 ${dateTo || '...'}`
                : 'Date range'}
              <ChevronDown size={12} />
            </button>
            {openFilter === 'date' && (
              <div className="absolute top-10 left-0 z-50 bg-surface border border-border rounded-xl shadow-md p-4 w-[280px]">
                <p className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-3">
                  Due date range
                </p>
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="text-2xs text-tx-muted mb-1 block">
                      From
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full h-8 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary"
                    />
                  </div>
                  <div>
                    <label className="text-2xs text-tx-muted mb-1 block">
                      To
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full h-8 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary"
                    />
                  </div>
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => {
                        setDateFrom('');
                        setDateTo('');
                      }}
                      className="text-xs text-tx-muted hover:text-brand mt-1"
                    >
                      Clear dates
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div
            className="relative"
            data-dropdown
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() =>
                setOpenFilter(openFilter === 'status' ? null : 'status')
              }
              className={cn(
                'h-8 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5',
                filterStatuses.length > 0
                  ? 'border-brand text-brand bg-brand-subtle'
                  : 'border-border text-tx-secondary bg-surface hover:bg-subtle'
              )}
            >
              Status{' '}
              {filterStatuses.length > 0 && `(${filterStatuses.length})`}
              <ChevronDown size={12} />
            </button>
            {openFilter === 'status' && (
              <div className="absolute top-10 left-0 z-50 bg-surface border border-border rounded-xl shadow-md py-2 w-[180px]">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() =>
                      toggleMulti(
                        filterStatuses,
                        k as TaskStatus,
                        setFilterStatuses
                      )
                    }
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-subtle transition-colors"
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                        filterStatuses.includes(k as TaskStatus)
                          ? 'border-brand bg-brand'
                          : 'border-border'
                      )}
                    >
                      {filterStatuses.includes(k as TaskStatus) && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                        >
                          <path
                            d="M2 5L4.5 7.5L8 2.5"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: v.color }}
                    />
                    <span className="text-tx-primary">{v.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Urgency */}
          <div
            className="relative"
            data-dropdown
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() =>
                setOpenFilter(openFilter === 'urgency' ? null : 'urgency')
              }
              className={cn(
                'h-8 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5',
                filterUrgencies.length > 0
                  ? 'border-brand text-brand bg-brand-subtle'
                  : 'border-border text-tx-secondary bg-surface hover:bg-subtle'
              )}
            >
              Urgency{' '}
              {filterUrgencies.length > 0 && `(${filterUrgencies.length})`}
              <ChevronDown size={12} />
            </button>
            {openFilter === 'urgency' && (
              <div className="absolute top-10 left-0 z-50 bg-surface border border-border rounded-xl shadow-md py-2 w-[180px]">
                {Object.entries(URGENCY_CONFIG).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() =>
                      toggleMulti(
                        filterUrgencies,
                        k as Urgency,
                        setFilterUrgencies
                      )
                    }
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-subtle transition-colors"
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                        filterUrgencies.includes(k as Urgency)
                          ? 'border-brand bg-brand'
                          : 'border-border'
                      )}
                    >
                      {filterUrgencies.includes(k as Urgency) && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                        >
                          <path
                            d="M2 5L4.5 7.5L8 2.5"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: v.color }}
                    />
                    <span className="text-tx-primary">{v.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="h-8 px-3 rounded-lg text-sm font-medium text-tx-muted hover:text-tx-primary hover:bg-subtle transition-colors flex items-center gap-1"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>

        <button
          onClick={openNewTaskModal}
          className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-brand text-tx-inverse text-sm font-semibold hover:bg-brand-hover transition-colors shrink-0"
        >
          <Plus size={15} />
          New Task
        </button>
      </div>

      {/* Task Table */}
      <div className="card-gradient rounded-xl overflow-hidden">
        <div className="grid grid-cols-[32px_1fr_90px_100px_85px_minmax(120px,1fr)_36px] items-center h-9 px-4 border-b border-border text-2xs font-semibold text-tx-secondary uppercase tracking-widest">
          <div />
          <button
            onClick={() => toggleSort('title')}
            className="text-left hover:text-tx-primary transition-colors flex items-center gap-1"
          >
            Task{' '}
            {sortField === 'title' && (
              <ChevronDown
                size={10}
                className={sortDir === 'desc' ? 'rotate-180' : ''}
              />
            )}
          </button>
          <button
            onClick={() => toggleSort('due_date')}
            className="text-left hover:text-tx-primary transition-colors flex items-center gap-1"
          >
            Due{' '}
            {sortField === 'due_date' && (
              <ChevronDown
                size={10}
                className={sortDir === 'desc' ? 'rotate-180' : ''}
              />
            )}
          </button>
          <button
            onClick={() => toggleSort('status')}
            className="text-left hover:text-tx-primary transition-colors flex items-center gap-1"
          >
            Status{' '}
            {sortField === 'status' && (
              <ChevronDown
                size={10}
                className={sortDir === 'desc' ? 'rotate-180' : ''}
              />
            )}
          </button>
          <button
            onClick={() => toggleSort('urgency')}
            className="text-left hover:text-tx-primary transition-colors flex items-center gap-1"
          >
            Urgency{' '}
            {sortField === 'urgency' && (
              <ChevronDown
                size={10}
                className={sortDir === 'desc' ? 'rotate-180' : ''}
              />
            )}
          </button>
          <div className="text-left">Notes</div>
          <div />
        </div>

        {filteredTasks.length === 0 ? (
          <div className="py-16 text-center text-sm text-tx-muted">
            {hasFilters
              ? 'No tasks match your filters.'
              : 'No tasks in this portfolio yet.'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredTasks.map((task) => {
              const statusCfg = STATUS_CONFIG[task.status];
              const urgCfg = URGENCY_CONFIG[task.urgency];
              const isOverdue =
                task.due_date &&
                task.due_date < today &&
                task.status !== 'done';
              const isDone = task.status === 'done';
              return (
                <div
                  key={task.id}
                  className={cn(
                    'grid grid-cols-[32px_1fr_90px_100px_85px_minmax(120px,1fr)_36px] items-center h-11 px-4 group hover:bg-subtle/50 transition-colors',
                    isDone && 'opacity-50'
                  )}
                >
                  <button
                    onClick={() => toggleDone(task)}
                    className="flex items-center justify-center"
                  >
                    <div
                      className={cn(
                        'w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all',
                        isDone
                          ? 'border-[#22C55E] bg-[#22C55E]'
                          : 'hover:border-brand'
                      )}
                      style={
                        !isDone ? { borderColor: statusCfg.color } : undefined
                      }
                    >
                      {isDone && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                        >
                          <path
                            d="M2 5L4.5 7.5L8 2.5"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </button>

                  <Link
                    href={`/tasks/${task.id}`}
                    className={cn(
                      'text-sm font-medium truncate pr-3 transition-colors',
                      isDone
                        ? 'text-tx-muted line-through'
                        : 'text-tx-primary hover:text-brand'
                    )}
                  >
                    {task.title}
                  </Link>

                  <div className="flex items-center gap-1">
                    <Clock
                      size={11}
                      style={{ color: dueDateColor(task.due_date) }}
                    />
                    <span
                      className="text-xs font-mono tabular-nums"
                      style={{
                        color: dueDateColor(task.due_date),
                        fontWeight: isOverdue ? 600 : 400,
                      }}
                    >
                      {task.due_date ? formatDate(task.due_date) : '\u2014'}
                    </span>
                  </div>

                  <div>
                    <select
                      value={task.status}
                      onChange={(e) =>
                        updateStatus(task.id, e.target.value as TaskStatus)
                      }
                      className="text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-md border-0 cursor-pointer appearance-none"
                      style={{
                        backgroundColor: statusCfg.bg,
                        color: statusCfg.color,
                      }}
                    >
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={task.urgency}
                      onChange={(e) =>
                        updateUrgency(task.id, e.target.value as Urgency)
                      }
                      className="text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-md border-0 cursor-pointer appearance-none"
                      style={{
                        backgroundColor: urgCfg.bg,
                        color: urgCfg.color,
                      }}
                    >
                      {Object.entries(URGENCY_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={task.notes || ''}
                      placeholder="Add note..."
                      onChange={(e) => {
                        const val = e.target.value;
                        setTasks((prev) =>
                          prev.map((t) =>
                            t.id === task.id ? { ...t, notes: val } : t
                          )
                        );
                      }}
                      onBlur={async (e) => {
                        const supabase = createClient();
                        await supabase
                          .from('tasks')
                          .update({ notes: e.target.value || null })
                          .eq('id', task.id);
                      }}
                      className="w-full text-xs text-tx-primary bg-transparent border-0 outline-none placeholder:text-tx-secondary truncate h-6 px-0"
                    />
                  </div>

                  <div className="relative" data-menu>
                    <button
                      onClick={() =>
                        setMenuTaskId(
                          menuTaskId === task.id ? null : task.id
                        )
                      }
                      className="p-1 rounded hover:bg-subtle text-tx-muted hover:text-tx-primary transition-all"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {menuTaskId === task.id && (
                      <div className="absolute right-0 top-8 z-50 w-36 bg-surface border border-border rounded-lg shadow-md py-1">
                        <button
                          onClick={() => openEditTaskModal(task)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-tx-secondary hover:bg-subtle hover:text-tx-primary transition-colors"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          onClick={() => archiveTask(task.id)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-tx-secondary hover:bg-subtle hover:text-tx-primary transition-colors"
                        >
                          <Archive size={13} /> Archive
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-subtle transition-colors"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 px-1">
        <p className="text-2xs text-tx-muted">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </p>
      </div>

      {/* ═══ NEW / EDIT TASK MODAL ═══ */}
      {showTaskModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={closeTaskModal}
        >
          <div
            className="bg-surface border border-border rounded-2xl shadow-lg w-full max-w-[520px] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-md font-semibold text-tx-primary">
                {editingTaskId ? 'Edit Task' : 'New Task'}
              </h2>
              <button
                onClick={closeTaskModal}
                className="p-1 rounded-lg hover:bg-subtle text-tx-muted hover:text-tx-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">
                  Task name *
                </label>
                <input
                  autoFocus
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-border-focus"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">
                    Portfolio
                  </label>
                  <select
                    value={newPortfolioId}
                    onChange={(e) => setNewPortfolioId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary appearance-none cursor-pointer"
                  >
                    <option value="">No portfolio</option>
                    {allPortfolios.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name.split('\u2014')[0].trim()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    min={today}
                    onChange={(e) => {
                      setNewDueDate(e.target.value);
                      if (
                        newStartDate &&
                        e.target.value &&
                        newStartDate > e.target.value
                      )
                        setNewStartDate(e.target.value);
                    }}
                    className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={newStartDate}
                    max={newDueDate || undefined}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary"
                  />
                </div>
                <div />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">
                    Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) =>
                      setNewStatus(e.target.value as TaskStatus)
                    }
                    className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary appearance-none cursor-pointer"
                  >
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">
                    Urgency
                  </label>
                  <select
                    value={newUrgency}
                    onChange={(e) =>
                      setNewUrgency(e.target.value as Urgency)
                    }
                    className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary appearance-none cursor-pointer"
                  >
                    {Object.entries(URGENCY_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">
                  Description
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Add details..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-subtle border border-border text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-border-focus resize-none"
                />
              </div>

              <div>
                <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">
                  Notes
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Quick notes..."
                  className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-border-focus"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button
                onClick={closeTaskModal}
                className="h-9 px-4 rounded-lg text-sm font-medium text-tx-secondary hover:bg-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingTaskId ? saveEditTask : addTask}
                disabled={!newTitle.trim()}
                className="h-9 px-5 rounded-lg bg-brand text-tx-inverse text-sm font-semibold hover:bg-brand-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editingTaskId ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT PORTFOLIO MODAL ═══ */}
      {showEditPortfolio && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowEditPortfolio(false)}
        >
          <div
            className="bg-surface border border-border rounded-2xl shadow-lg w-full max-w-[480px] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-md font-semibold text-tx-primary">
                Edit Portfolio
              </h2>
              <button
                onClick={() => setShowEditPortfolio(false)}
                className="p-1 rounded-lg hover:bg-subtle text-tx-muted hover:text-tx-primary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">
                  Portfolio name *
                </label>
                <input
                  autoFocus
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-border-focus"
                />
              </div>

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

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button
                onClick={() => setShowEditPortfolio(false)}
                className="h-9 px-4 rounded-lg text-sm font-medium text-tx-secondary hover:bg-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={savePortfolioEdit}
                disabled={!formName.trim()}
                className="h-9 px-5 rounded-lg bg-brand text-tx-inverse text-sm font-semibold hover:bg-brand-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
