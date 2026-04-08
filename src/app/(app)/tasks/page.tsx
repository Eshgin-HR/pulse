'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Task, Portfolio, TaskStatus, Urgency, STATUS_CONFIG, URGENCY_CONFIG } from '@/types';
import { cn, formatDate, dueDateColor } from '@/lib/utils';
import Link from 'next/link';
import { Plus, Search, X, ChevronDown, Clock, MoreHorizontal, Trash2, Archive, Calendar, Pencil, RotateCcw, FileDown, FileSpreadsheet } from 'lucide-react';

type SortField = 'due_date' | 'urgency' | 'status' | 'title' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters — multi-select
  const [filterStatuses, setFilterStatuses] = useState<TaskStatus[]>([]);
  const [filterUrgencies, setFilterUrgencies] = useState<Urgency[]>([]);
  const [filterPortfolios, setFilterPortfolios] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Dropdowns open state
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  // New task modal
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPortfolioId, setNewPortfolioId] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatus>('todo');
  const [newUrgency, setNewUrgency] = useState<Urgency>('medium');
  const [newDescription, setNewDescription] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Context menu
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*, portfolio:portfolios(*)')
        .eq('is_archived', false)
        .order('sort_order');
      const { data: portfoliosData } = await supabase
        .from('portfolios')
        .select('*')
        .eq('is_archived', false)
        .order('sort_order');

      if (tasksData) setTasks(tasksData);
      if (portfoliosData) {
        setPortfolios(portfoliosData);
        if (portfoliosData.length > 0) setNewPortfolioId(portfoliosData[0].id);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setOpenFilter(null);
      }
      if (!target.closest('[data-menu]')) {
        setMenuTaskId(null);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q) || t.portfolio?.name.toLowerCase().includes(q));
    }

    // Date range
    if (dateFrom) result = result.filter((t) => t.due_date && t.due_date >= dateFrom);
    if (dateTo) result = result.filter((t) => t.due_date && t.due_date <= dateTo);

    // Multi-select filters
    if (filterStatuses.length > 0) result = result.filter((t) => filterStatuses.includes(t.status));
    if (filterUrgencies.length > 0) result = result.filter((t) => filterUrgencies.includes(t.urgency));
    if (filterPortfolios.length > 0) result = result.filter((t) => t.portfolio_id && filterPortfolios.includes(t.portfolio_id));

    // Sort
    const urgOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const statOrder = { todo: 1, in_progress: 2, in_review: 3, done: 4 };
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'due_date') { const aD = a.due_date || '9999'; const bD = b.due_date || '9999'; cmp = aD < bD ? -1 : aD > bD ? 1 : 0; }
      else if (sortField === 'urgency') cmp = urgOrder[b.urgency] - urgOrder[a.urgency];
      else if (sortField === 'status') cmp = statOrder[a.status] - statOrder[b.status];
      else if (sortField === 'title') cmp = a.title.localeCompare(b.title);
      else cmp = a.created_at < b.created_at ? -1 : 1;
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [tasks, search, dateFrom, dateTo, filterStatuses, filterUrgencies, filterPortfolios, sortField, sortDir]);

  const hasFilters = filterStatuses.length > 0 || filterUrgencies.length > 0 || filterPortfolios.length > 0 || dateFrom || dateTo || search;

  async function toggleDone(task: Task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
    const supabase = createClient();
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', task.id);
  }

  async function updateStatus(taskId: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
    const supabase = createClient();
    await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', taskId);
  }

  async function updateUrgency(taskId: string, urgency: Urgency) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, urgency } : t));
    const supabase = createClient();
    await supabase.from('tasks').update({ urgency }).eq('id', taskId);
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
      setTasks((prev) => [data, ...prev]);
      setNewTitle(''); setNewDueDate(''); setNewStartDate('');
      setNewStatus('todo'); setNewUrgency('medium');
      setNewDescription(''); setNewNotes('');
      setShowModal(false);
      setEditingTaskId(null);
    }
  }

  function openEditModal(task: Task) {
    setEditingTaskId(task.id);
    setNewTitle(task.title);
    setNewPortfolioId(task.portfolio_id || '');
    setNewDueDate(task.due_date || '');
    setNewStartDate(task.start_date || '');
    setNewStatus(task.status);
    setNewUrgency(task.urgency);
    setNewDescription(task.description || '');
    setNewNotes(task.notes || '');
    setShowModal(true);
    setMenuTaskId(null);
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
      setTasks((prev) => prev.map((t) => t.id === editingTaskId ? data : t));
      setNewTitle(''); setNewDueDate(''); setNewStartDate('');
      setNewStatus('todo'); setNewUrgency('medium');
      setNewDescription(''); setNewNotes('');
      setShowModal(false);
      setEditingTaskId(null);
    }
  }

  async function archiveTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setMenuTaskId(null);
    const supabase = createClient();
    await supabase.from('tasks').update({ is_archived: true }).eq('id', taskId);
  }

  function closeModal() {
    setShowModal(false);
    setEditingTaskId(null);
    setNewTitle(''); setNewDueDate(''); setNewStartDate('');
    setNewStatus('todo'); setNewUrgency('medium');
    setNewDescription(''); setNewNotes('');
    if (portfolios.length > 0) setNewPortfolioId(portfolios[0].id);
  }

  async function deleteTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setMenuTaskId(null);
    const supabase = createClient();
    await supabase.from('tasks').delete().eq('id', taskId);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  function toggleMulti<T>(arr: T[], val: T, setter: (v: T[]) => void) {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  }

  function clearFilters() {
    setFilterStatuses([]); setFilterUrgencies([]); setFilterPortfolios([]);
    setDateFrom(''); setDateTo(''); setSearch('');
  }

  function exportToExcel() {
    const data = filteredTasks.map(t => ({
      'Task': t.title,
      'Portfolio': t.portfolio?.name?.split('—')[0].trim() || '—',
      'Status': STATUS_CONFIG[t.status].label,
      'Urgency': URGENCY_CONFIG[t.urgency].label,
      'Start Date': t.start_date || '—',
      'Due Date': t.due_date || '—',
      'Description': t.description || '',
      'Notes': t.notes || '',
    }));
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 30 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
      XLSX.writeFile(wb, `pulse-tasks-${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  }

  function exportToPdf() {
    import('jspdf').then(({ jsPDF }) => {
      import('jspdf-autotable').then(() => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text('PULSE — Tasks Export', 14, 15);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Generated ${new Date().toLocaleDateString()} · ${filteredTasks.length} tasks`, 14, 22);

        const rows = filteredTasks.map(t => [
          t.title,
          t.portfolio?.name?.split('—')[0].trim() || '—',
          STATUS_CONFIG[t.status].label,
          URGENCY_CONFIG[t.urgency].label,
          t.start_date || '—',
          t.due_date || '—',
          (t.notes || '').slice(0, 50),
        ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (doc as any).autoTable({
          startY: 28,
          head: [['Task', 'Portfolio', 'Status', 'Urgency', 'Start', 'Due', 'Notes']],
          body: rows,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: { 0: { cellWidth: 60 }, 6: { cellWidth: 40 } },
        });

        doc.save(`pulse-tasks-${new Date().toISOString().split('T')[0]}.pdf`);
      });
    });
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
          <h1 className="text-xl font-semibold text-tx-primary tracking-tight">Tasks</h1>
          <p className="text-sm text-tx-muted mt-0.5">{tasks.length} total &middot; {tasks.filter(t => t.status !== 'done').length} active</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToExcel} title="Export to Excel"
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-sm font-medium text-tx-secondary bg-surface hover:bg-subtle transition-colors">
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button onClick={exportToPdf} title="Export to PDF"
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-sm font-medium text-tx-secondary bg-surface hover:bg-subtle transition-colors">
            <FileDown size={14} /> PDF
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-brand text-tx-inverse text-sm font-semibold hover:bg-brand-hover transition-colors"
          >
            <Plus size={15} />
            New Task
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tx-muted" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 pr-3 rounded-lg bg-surface border border-border text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-border-focus w-[180px] transition-colors"
          />
        </div>

        {/* Date Range */}
        <div className="relative" data-dropdown onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setOpenFilter(openFilter === 'date' ? null : 'date')}
            className={cn(
              'h-8 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5',
              (dateFrom || dateTo) ? 'border-brand text-brand bg-brand-subtle' : 'border-border text-tx-secondary bg-surface hover:bg-subtle'
            )}
          >
            <Calendar size={13} />
            {dateFrom || dateTo ? `${dateFrom || '...'} → ${dateTo || '...'}` : 'Date range'}
            <ChevronDown size={12} />
          </button>
          {openFilter === 'date' && (
            <div className="absolute top-10 left-0 z-50 bg-surface border border-border rounded-xl shadow-dropdown p-4 w-[280px]">
              <p className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-3">Due date range</p>
              <div className="flex flex-col gap-2">
                <div>
                  <label className="text-2xs text-tx-muted mb-1 block">From</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full h-8 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary" />
                </div>
                <div>
                  <label className="text-2xs text-tx-muted mb-1 block">To</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                    className="w-full h-8 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary" />
                </div>
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="text-xs text-tx-muted hover:text-brand mt-1">Clear dates</button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status — multi-select */}
        <div className="relative" data-dropdown onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setOpenFilter(openFilter === 'status' ? null : 'status')}
            className={cn(
              'h-8 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5',
              filterStatuses.length > 0 ? 'border-brand text-brand bg-brand-subtle' : 'border-border text-tx-secondary bg-surface hover:bg-subtle'
            )}
          >
            Status {filterStatuses.length > 0 && `(${filterStatuses.length})`}
            <ChevronDown size={12} />
          </button>
          {openFilter === 'status' && (
            <div className="absolute top-10 left-0 z-50 bg-surface border border-border rounded-xl shadow-dropdown py-2 w-[180px]">
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <button key={k}
                  onClick={() => toggleMulti(filterStatuses, k as TaskStatus, setFilterStatuses)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-subtle transition-colors"
                >
                  <div className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                    filterStatuses.includes(k as TaskStatus) ? 'border-brand bg-brand' : 'border-border'
                  )}>
                    {filterStatuses.includes(k as TaskStatus) && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    )}
                  </div>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                  <span className="text-tx-primary">{v.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Urgency — multi-select */}
        <div className="relative" data-dropdown onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setOpenFilter(openFilter === 'urgency' ? null : 'urgency')}
            className={cn(
              'h-8 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5',
              filterUrgencies.length > 0 ? 'border-brand text-brand bg-brand-subtle' : 'border-border text-tx-secondary bg-surface hover:bg-subtle'
            )}
          >
            Urgency {filterUrgencies.length > 0 && `(${filterUrgencies.length})`}
            <ChevronDown size={12} />
          </button>
          {openFilter === 'urgency' && (
            <div className="absolute top-10 left-0 z-50 bg-surface border border-border rounded-xl shadow-dropdown py-2 w-[180px]">
              {Object.entries(URGENCY_CONFIG).map(([k, v]) => (
                <button key={k}
                  onClick={() => toggleMulti(filterUrgencies, k as Urgency, setFilterUrgencies)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-subtle transition-colors"
                >
                  <div className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                    filterUrgencies.includes(k as Urgency) ? 'border-brand bg-brand' : 'border-border'
                  )}>
                    {filterUrgencies.includes(k as Urgency) && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    )}
                  </div>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                  <span className="text-tx-primary">{v.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Portfolio — multi-select */}
        <div className="relative" data-dropdown onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setOpenFilter(openFilter === 'portfolio' ? null : 'portfolio')}
            className={cn(
              'h-8 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1.5',
              filterPortfolios.length > 0 ? 'border-brand text-brand bg-brand-subtle' : 'border-border text-tx-secondary bg-surface hover:bg-subtle'
            )}
          >
            Portfolio {filterPortfolios.length > 0 && `(${filterPortfolios.length})`}
            <ChevronDown size={12} />
          </button>
          {openFilter === 'portfolio' && (
            <div className="absolute top-10 left-0 z-50 bg-surface border border-border rounded-xl shadow-dropdown py-2 w-[220px]">
              {portfolios.map((p) => (
                <button key={p.id}
                  onClick={() => toggleMulti(filterPortfolios, p.id, setFilterPortfolios)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-subtle transition-colors"
                >
                  <div className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                    filterPortfolios.includes(p.id) ? 'border-brand bg-brand' : 'border-border'
                  )}>
                    {filterPortfolios.includes(p.id) && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    )}
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-tx-primary truncate">{p.name.split('—')[0].trim()}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {hasFilters && (
          <button onClick={clearFilters}
            className="h-8 px-3 rounded-lg text-sm font-medium text-tx-muted hover:text-tx-primary hover:bg-subtle transition-colors flex items-center gap-1">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Task Table */}
      <div className="card-gradient rounded-xl overflow-hidden">
        <div className="grid grid-cols-[32px_1fr_140px_90px_100px_85px_minmax(120px,1fr)_36px] items-center h-9 px-4 border-b border-border text-2xs font-semibold text-tx-secondary uppercase tracking-widest">
          <div />
          <button onClick={() => toggleSort('title')} className="text-left hover:text-tx-primary transition-colors flex items-center gap-1">
            Task {sortField === 'title' && <ChevronDown size={10} className={sortDir === 'desc' ? 'rotate-180' : ''} />}
          </button>
          <div className="text-left">Portfolio</div>
          <button onClick={() => toggleSort('due_date')} className="text-left hover:text-tx-primary transition-colors flex items-center gap-1">
            Due {sortField === 'due_date' && <ChevronDown size={10} className={sortDir === 'desc' ? 'rotate-180' : ''} />}
          </button>
          <button onClick={() => toggleSort('status')} className="text-left hover:text-tx-primary transition-colors flex items-center gap-1">
            Status {sortField === 'status' && <ChevronDown size={10} className={sortDir === 'desc' ? 'rotate-180' : ''} />}
          </button>
          <button onClick={() => toggleSort('urgency')} className="text-left hover:text-tx-primary transition-colors flex items-center gap-1">
            Urgency {sortField === 'urgency' && <ChevronDown size={10} className={sortDir === 'desc' ? 'rotate-180' : ''} />}
          </button>
          <div className="text-left">Notes</div>
          <div />
        </div>

        {filteredTasks.length === 0 ? (
          <div className="py-16 text-center text-sm text-tx-muted">
            {hasFilters ? 'No tasks match your filters.' : 'No tasks yet. Create your first task.'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredTasks.map((task) => {
              const statusCfg = STATUS_CONFIG[task.status];
              const urgCfg = URGENCY_CONFIG[task.urgency];
              const isOverdue = task.due_date && task.due_date < today && task.status !== 'done';
              const isDone = task.status === 'done';
              return (
                <div key={task.id}
                  className="grid grid-cols-[32px_1fr_140px_90px_100px_85px_minmax(120px,1fr)_36px] items-center h-11 px-4 group hover:bg-subtle/50 transition-colors"
                >
                  <button onClick={() => toggleDone(task)} className="flex items-center justify-center">
                    <div className={cn(
                      'w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all',
                      isDone ? 'border-[#22C55E] bg-[#22C55E]' : 'hover:border-brand',
                    )} style={!isDone ? { borderColor: statusCfg.color } : undefined}>
                      {isDone && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </button>

                  <Link href={`/tasks/${task.id}`}
                    className={cn('text-sm font-medium truncate pr-3 transition-colors', isDone ? 'text-tx-muted line-through' : 'text-tx-primary hover:text-brand')}>
                    {task.title}
                  </Link>

                  <div className="text-left">
                    {task.portfolio ? (
                      <span className="text-2xs font-medium text-tx-secondary bg-subtle rounded px-1.5 py-0.5 truncate inline-block max-w-[130px]">
                        {task.portfolio.name.split('—')[0].trim()}
                      </span>
                    ) : <span className="text-2xs text-tx-muted">—</span>}
                  </div>

                  <div className="flex items-center gap-1">
                    <Clock size={11} style={{ color: dueDateColor(task.due_date) }} />
                    <span className="text-xs font-mono tabular-nums"
                      style={{ color: dueDateColor(task.due_date), fontWeight: isOverdue ? 600 : 400 }}>
                      {task.due_date ? formatDate(task.due_date) : '—'}
                    </span>
                  </div>

                  <div>
                    <select value={task.status} onChange={(e) => updateStatus(task.id, e.target.value as TaskStatus)}
                      className="text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-md border-0 cursor-pointer appearance-none"
                      style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <select value={task.urgency} onChange={(e) => updateUrgency(task.id, e.target.value as Urgency)}
                      className="text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-md border-0 cursor-pointer appearance-none"
                      style={{ backgroundColor: urgCfg.bg, color: urgCfg.color }}>
                      {Object.entries(URGENCY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <input type="text" value={task.notes || ''} placeholder="Add note..."
                      onChange={(e) => { const val = e.target.value; setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, notes: val } : t)); }}
                      onBlur={async (e) => { const supabase = createClient(); await supabase.from('tasks').update({ notes: e.target.value || null }).eq('id', task.id); }}
                      className="w-full text-xs text-tx-primary bg-transparent border-0 outline-none placeholder:text-tx-secondary truncate h-6 px-0" />
                  </div>

                  <div className="relative" data-menu>
                    <button onClick={() => setMenuTaskId(menuTaskId === task.id ? null : task.id)}
                      className="p-1 rounded hover:bg-subtle text-tx-muted hover:text-tx-primary transition-all">
                      <MoreHorizontal size={14} />
                    </button>
                    {menuTaskId === task.id && (
                      <div className="absolute right-0 top-8 z-50 w-40 bg-surface border border-border rounded-lg shadow-dropdown py-1">
                        {isDone && (
                          <button onClick={() => { updateStatus(task.id, 'todo'); setMenuTaskId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-tx-secondary hover:bg-subtle hover:text-tx-primary transition-colors">
                            <RotateCcw size={13} /> Reopen
                          </button>
                        )}
                        <button onClick={() => openEditModal(task)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-tx-secondary hover:bg-subtle hover:text-tx-primary transition-colors">
                          <Pencil size={13} /> Edit
                        </button>
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 px-1">
        <p className="text-2xs text-tx-muted">Showing {filteredTasks.length} of {tasks.length} tasks</p>
      </div>

      {/* ═══ NEW TASK MODAL ═══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-surface border border-border rounded-2xl shadow-lg w-full max-w-[520px] mx-4" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-md font-semibold text-tx-primary">{editingTaskId ? 'Edit Task' : 'New Task'}</h2>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-subtle text-tx-muted hover:text-tx-primary transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Title */}
              <div>
                <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">Task name *</label>
                <input autoFocus type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-border-focus" />
              </div>

              {/* Portfolio + Due Date row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">Portfolio</label>
                  <select value={newPortfolioId} onChange={(e) => setNewPortfolioId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary appearance-none cursor-pointer">
                    <option value="">No portfolio</option>
                    {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name.split('—')[0].trim()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">Due date</label>
                  <input type="date" value={newDueDate} min={today}
                    onChange={(e) => {
                      setNewDueDate(e.target.value);
                      if (newStartDate && e.target.value && newStartDate > e.target.value) setNewStartDate(e.target.value);
                    }}
                    className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary" />
                </div>
              </div>

              {/* Start Date row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">Start date</label>
                  <input type="date" value={newStartDate} max={newDueDate || undefined}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary" />
                </div>
                <div />
              </div>

              {/* Status + Urgency row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">Status</label>
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                    className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary appearance-none cursor-pointer">
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">Urgency</label>
                  <select value={newUrgency} onChange={(e) => setNewUrgency(e.target.value as Urgency)}
                    className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary appearance-none cursor-pointer">
                    {Object.entries(URGENCY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">Description</label>
                <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Add details..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-subtle border border-border text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-border-focus resize-none" />
              </div>

              {/* Notes */}
              <div>
                <label className="text-2xs font-semibold text-tx-secondary uppercase tracking-widest mb-1.5 block">Notes</label>
                <input type="text" value={newNotes} onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Quick notes..."
                  className="w-full h-9 px-3 rounded-lg bg-subtle border border-border text-sm text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-border-focus" />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={closeModal}
                className="h-9 px-4 rounded-lg text-sm font-medium text-tx-secondary hover:bg-subtle transition-colors">
                Cancel
              </button>
              <button onClick={editingTaskId ? saveEditTask : addTask} disabled={!newTitle.trim()}
                className="h-9 px-5 rounded-lg bg-brand text-tx-inverse text-sm font-semibold hover:bg-brand-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {editingTaskId ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
