import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { update, useAppState } from '../store';
import type { Priority, Status, Task } from '../types';
import { Check, ChipScroll, Field, PriorityIcon, Sheet, StatusIcon, toast } from './ui';
import { addDays, fmtDate, parseDate, PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, today, uid, haptic, daysBetween } from '../utils';

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
  const t0 = today();
  const nextMonday = addDays(t0, ((8 - parseDate(t0).getDay()) % 7) || 7);
  const dueOpts = [
    { v: t0, l: "Aujourd'hui" },
    { v: addDays(t0, 1), l: 'Demain' },
    { v: nextMonday, l: 'Lundi pro' },
    { v: '', l: 'Sans date' }
  ];

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
            <button key={st} className={'chip chip-lg' + (task.status === st ? ' solid' : '')} onClick={() => { setStatus(st); haptic(); }}>
              <StatusIcon status={st} size={13} /> {STATUS_LABEL[st]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Priorité">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {PRIORITIES.map((p) => (
            <button key={p} className={'chip chip-lg' + (task.priority === p ? ' solid' : '')} onClick={() => set((t) => (t.priority = p as Priority))}>
              <PriorityIcon p={p} size={12} /> {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Échéance">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {dueOpts.map((o) => (
            <button key={o.l} className={'chip chip-lg' + ((task.due || '') === o.v ? ' solid' : '')} onClick={() => { haptic(); set((t) => (t.due = o.v || undefined)); }}>{o.l}</button>
          ))}
          <input type="date" className="input" style={{ width: 150, height: 34 }} value={task.due || ''} onChange={(e) => set((t) => (t.due = e.target.value || undefined))} />
        </div>
      </Field>
      <Field label="Projet">
        <ChipScroll>
          {s.projects.filter((p) => !p.archived).map((p) => (
            <button key={p.id} className={'chip chip-lg' + (task.projectId === p.id ? ' solid' : '')} onClick={() => set((t) => (t.projectId = p.id))}>{p.name}</button>
          ))}
        </ChipScroll>
      </Field>

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
