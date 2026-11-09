import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { update, useAppState } from '../store';
import type { Priority, Status, Task } from '../types';
import { Check, Field, PriorityIcon, Sheet, StatusIcon, toast } from './ui';
import { fmtDate, PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, today, uid, haptic, daysBetween } from '../utils';

export function TaskSheet({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const s = useAppState();
  const task = s.tasks.find((t) => t.id === taskId);
  const [newItem, setNewItem] = useState('');
  if (!task) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const set = (fn: (t: Task) => void) =>
    update((d) => {
      const t = d.tasks.find((x) => x.id === task.id);
      if (t) fn(t);
    });

  const setStatus = (st: Status) =>
    set((t) => {
      t.status = st;
      t.doneAt = st === 'done' ? Date.now() : undefined;
    });

  const addItem = () => {
    if (!newItem.trim()) return;
    set((t) => t.checklist.push({ id: uid(), text: newItem.trim(), done: false }));
    setNewItem('');
  };

  const doneCount = task.checklist.filter((c) => c.done).length;

  return (
    <Sheet
      open
      onClose={onClose}
      title={s.projects.find((p) => p.id === task.projectId)?.name || 'Tâche'}
      actions={
        <button
          className="icon-btn"
          aria-label="Supprimer"
          onClick={() => {
            if (!confirm('Supprimer cette tâche ?')) return;
            update((d) => {
              d.tasks = d.tasks.filter((t) => t.id !== task.id);
            });
            toast('Tâche supprimée');
            onClose();
          }}
        >
          <Trash2 size={16} />
        </button>
      }
    >
      <textarea
        className="input-bare title-input"
        rows={1}
        style={{ resize: 'none', marginBottom: 14, lineHeight: 1.3 }}
        value={task.title}
        onChange={(e) => set((t) => (t.title = e.target.value))}
      />

      <Field label="Statut">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {STATUSES.map((st) => (
            <button key={st} className={'chip' + (task.status === st ? ' solid' : '')} style={{ height: 30, padding: '0 10px' }} onClick={() => { setStatus(st); haptic(); }}>
              <StatusIcon status={st} size={13} /> {STATUS_LABEL[st]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Priorité">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {PRIORITIES.map((p) => (
            <button key={p} className={'chip' + (task.priority === p ? ' solid' : '')} style={{ height: 30, padding: '0 10px' }} onClick={() => set((t) => (t.priority = p as Priority))}>
              <PriorityIcon p={p} size={12} /> {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
      </Field>

      <div className="field-row">
        <Field label="Échéance">
          <input type="date" className="input" value={task.due || ''} onChange={(e) => set((t) => (t.due = e.target.value || undefined))} />
        </Field>
        <Field label="Projet">
          <select className="input" value={task.projectId} onChange={(e) => set((t) => (t.projectId = e.target.value))}>
            {s.projects.filter((p) => !p.archived).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>

      <Field label={`Checklist${task.checklist.length ? ` · ${doneCount}/${task.checklist.length}` : ''}`}>
        <div className="list">
          {task.checklist.map((c) => (
            <div key={c.id} className="list-item" style={{ minHeight: 42, padding: '8px 12px' }}>
              <Check square on={c.done} onClick={() => set((t) => { const i = t.checklist.find((x) => x.id === c.id); if (i) i.done = !i.done; })} />
              <input className="input-bare grow" style={{ fontSize: 14, textDecoration: c.done ? 'line-through' : undefined, color: c.done ? 'var(--text-3)' : undefined }} value={c.text} onChange={(e) => set((t) => { const i = t.checklist.find((x) => x.id === c.id); if (i) i.text = e.target.value; })} />
              <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => set((t) => (t.checklist = t.checklist.filter((x) => x.id !== c.id)))}><X size={14} /></button>
            </div>
          ))}
          <div className="list-item" style={{ minHeight: 42, padding: '8px 12px' }}>
            <Plus size={16} className="faint" />
            <input className="input-bare grow" style={{ fontSize: 14 }} placeholder="Ajouter une étape…" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} onBlur={addItem} />
          </div>
        </div>
      </Field>

      <Field label="Notes">
        <textarea className="input" placeholder="Détails, liens, idées…" value={task.notes} onChange={(e) => set((t) => (t.notes = e.target.value))} />
      </Field>
    </Sheet>
  );
}

export function DueChip({ due, done }: { due?: string; done?: boolean }) {
  if (!due) return null;
  const late = !done && daysBetween(today(), due) < 0;
  return <span className={'chip' + (late ? ' danger' : '')}>{fmtDate(due)}</span>;
}
