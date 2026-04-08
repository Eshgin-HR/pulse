'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useThemeStore } from '@/stores/theme-store';
import { Sun, Moon, Download, Trash2, User, Palette, Database, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const { theme, toggle } = useThemeStore();
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const supabase = createClient();
      const [{ data: portfolios }, { data: tasks }, { data: subtasks }] = await Promise.all([
        supabase.from('portfolios').select('*').order('sort_order'),
        supabase.from('tasks').select('*').order('sort_order'),
        supabase.from('subtasks').select('*').order('sort_order'),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        portfolios: portfolios || [],
        tasks: tasks || [],
        subtasks: subtasks || [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulse-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAllTasks() {
    setDeleting(true);
    try {
      const supabase = createClient();
      // Delete all subtasks first, then all tasks
      await supabase.from('subtasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      setShowDeleteConfirm(false);
      setDeleteSuccess(true);
      setTimeout(() => setDeleteSuccess(false), 3000);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 32,
        }}
      >
        Settings
      </h1>

      {/* Profile Section */}
      <section
        className="card-gradient"
        style={{ borderRadius: 12, padding: 24, marginBottom: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <User size={16} style={{ color: 'var(--text-muted)' }} />
          <h2
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Profile
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 6,
              }}
            >
              Name
            </label>
            <input
              type="text"
              value="Eshgeen Jafarov"
              readOnly
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-subtle)',
                color: 'var(--text-primary)',
                fontSize: 14,
                cursor: 'default',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              type="email"
              value="eshgin.jafarov@pashaholding.az"
              readOnly
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-subtle)',
                color: 'var(--text-primary)',
                fontSize: 14,
                cursor: 'default',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </section>

      {/* Theme Section */}
      <section
        className="card-gradient"
        style={{ borderRadius: 12, padding: 24, marginBottom: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Palette size={16} style={{ color: 'var(--text-muted)' }} />
          <h2
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Theme
          </h2>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
              Appearance
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {theme === 'dark' ? 'Dark mode is active' : 'Light mode is active'}
            </p>
          </div>

          <button
            onClick={toggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </section>

      {/* Data Section */}
      <section
        className="card-gradient"
        style={{ borderRadius: 12, padding: 24, marginBottom: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Database size={16} style={{ color: 'var(--text-muted)' }} />
          <h2
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Data
          </h2>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
              Export Data
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Download all portfolios, tasks, and subtasks as JSON
            </p>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: exporting ? 'wait' : 'pointer',
              opacity: exporting ? 0.6 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            <Download size={14} />
            {exporting ? 'Exporting...' : 'Export JSON'}
          </button>
        </div>
      </section>

      {/* Danger Zone */}
      <section
        className="card-gradient"
        style={{
          borderRadius: 12,
          padding: 24,
          borderColor: 'rgba(239, 68, 68, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <AlertTriangle size={16} style={{ color: 'var(--p-critical)' }} />
          <h2
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--p-critical)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Danger Zone
          </h2>
        </div>

        {!showDeleteConfirm ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                Delete All Tasks
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Permanently remove all tasks and subtasks
              </p>
            </div>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--p-critical)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Trash2 size={14} />
              Delete All
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
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              This will permanently delete all tasks and subtasks. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleDeleteAllTasks}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--p-critical)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: deleting ? 'wait' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'Deleting...' : 'Yes, delete everything'}
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

        {deleteSuccess && (
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: 'var(--s-done)',
              fontWeight: 500,
            }}
          >
            All tasks deleted successfully.
          </p>
        )}
      </section>
    </div>
  );
}
