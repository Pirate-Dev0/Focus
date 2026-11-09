import { useState } from 'react';
import { Bell, Clock, ExternalLink, Plus, Repeat, Tag, Trash2, X } from 'lucide-react';
import { update, useAppState } from '../store';
import type { Priority, RecurrenceFreq, Status, Task, TaskRecurrence } from '../types';
import { Check, ChipScroll, Field, PriorityIcon, Sheet, StatusIcon, toast } from './ui';
import { addDays, fmtDate, parseDate, PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, today, uid, haptic, daysBetween, fmtDuration } from '../utils';

const RECURRENCE_OPTS: { f: RecurrenceFreq | 'none'; l: string }[] = [
  { f: 'none', l: 'Aucune' },
  { f: 'daily', l: 'Tous les jours' },
  { f: 'weekdays', l: 'Jours ouvrés (L-V)' },
  { f: 'weekly', l: 'Chaque semaine' },
  { f: 'monthly', l: 'Chaque mois' },
  { f: 'yearly', l: 'Chaque année' },
  { f: 'after_completion', l: 'Après complétion' }
];

const REMINDER_OPTS: { offset: number; label: string }[] = [
  { offset: 0, label: "À l'heure exacte" },
  { offset: 15, label: '15 min avant' },
  { offset: 30, label: '30 min avant' },
  { offset: 60, label: '1 heure avant' },
  { offset: 1440, label: 'La veille' }
];

const ESTIMATES = [15, 30, 45, 60, 90, 120];

export function TaskSheet({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const s = useAppState();
  const task = s.tasks.find((t) => t.id === taskId);
  const [newItem, setNewItem] = useState('');
  const [newTag, setNewTag] = useState('');
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

  const addTag = () => {
    const raw = newTag.trim().replace(/^#/, '');
    if (!raw) return;
    set((t) => {
      t.tags ||= [];
      if (!t.tags.includes(raw)) t.tags.push(raw);
    });
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    set((t) => {
      t.tags = (t.tags || []).filter((x) => x !== tag);
    });
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

  const recFreq = task.recurrence?.freq || 'none';

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

      <Field label="Échéance & Heure">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {dueOpts.map((o) => (
            <button key={o.l} className={'chip chip-lg' + ((task.due || '') === o.v ? ' solid' : '')} onClick={() => { haptic(); set((t) => (t.due = o.v || undefined)); }}>{o.l}</button>
          ))}
          <input type="date" className="input" style={{ width: 140, height: 34 }} value={task.due || ''} onChange={(e) => set((t) => (t.due = e.target.value || undefined))} />
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span className="faint small row" style={{ gap: 4 }}><Clock size={13} /> Heure :</span>
          <input
            type="time"
            className="input"
            style={{ width: 110, height: 32 }}
            value={task.dueTime || ''}
            onChange={(e) => set((t) => (t.dueTime = e.target.value || undefined))}
          />
          {['09:00', '14:00', '18:00', '20:00'].map((time) => (
            <button
              key={time}
              className={'chip' + (task.dueTime === time ? ' solid' : '')}
              onClick={() => set((t) => (t.dueTime = t.dueTime === time ? undefined : time))}
            >
              {time}
            </button>
          ))}
          {task.dueTime && (
            <button className="btn btn-ghost small" onClick={() => set((t) => (t.dueTime = undefined))}>Effacer</button>
          )}
        </div>
      </Field>

      <Field label="Rappel & Alarme">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          <button
            className={'chip chip-lg' + (!task.reminder?.enabled ? ' solid' : '')}
            onClick={() => set((t) => (t.reminder = undefined))}
          >
            Sans rappel
          </button>
          {REMINDER_OPTS.map((opt) => {
            const active = !!task.reminder?.enabled && task.reminder.offsetMinutes === opt.offset;
            return (
              <button
                key={opt.offset}
                className={'chip chip-lg' + (active ? ' solid' : '')}
                onClick={() => {
                  haptic();
                  set((t) => (t.reminder = { enabled: true, offsetMinutes: opt.offset }));
                }}
              >
                <Bell size={12} /> {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Répétition">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {RECURRENCE_OPTS.map((opt) => (
            <button
              key={opt.f}
              className={'chip chip-lg' + (recFreq === opt.f ? ' solid' : '')}
              onClick={() => {
                haptic();
                set((t) => {
                  if (opt.f === 'none') {
                    t.recurrence = undefined;
                  } else {
                    t.recurrence = { freq: opt.f as RecurrenceFreq, interval: 1 };
                  }
                });
              }}
            >
              {opt.f !== 'none' && <Repeat size={12} />} {opt.l}
            </button>
          ))}
        </div>
        {task.recurrence && task.recurrence.freq === 'after_completion' && (
          <div className="row" style={{ marginTop: 8, gap: 8, alignItems: 'center' }}>
            <span className="small faint">Se recrée</span>
            <input
              type="number"
              min={1}
              className="input"
              style={{ width: 65, height: 32 }}
              value={task.recurrence.interval || 1}
              onChange={(e) => set((t) => { if (t.recurrence) t.recurrence.interval = Math.max(1, Number(e.target.value) || 1); })}
            />
            <span className="small faint">jour(s) après complétion</span>
          </div>
        )}
      </Field>

      <Field label="Gestion du temps">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <span className="faint small">Durée :</span>
          <button
            className={'chip' + (!task.estimateMinutes ? ' solid' : '')}
            onClick={() => set((t) => (t.estimateMinutes = undefined))}
          >
            Aucune
          </button>
          {ESTIMATES.map((min) => (
            <button
              key={min}
              className={'chip' + (task.estimateMinutes === min ? ' solid' : '')}
              onClick={() => set((t) => (t.estimateMinutes = t.estimateMinutes === min ? undefined : min))}
            >
              {fmtDuration(min)}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="faint small">Commencer le :</span>
          <input
            type="date"
            className="input"
            style={{ width: 140, height: 32 }}
            value={task.startDate || ''}
            onChange={(e) => set((t) => (t.startDate = e.target.value || undefined))}
          />
          {task.startDate && (
            <button className="btn btn-ghost small" onClick={() => set((t) => (t.startDate = undefined))}>Effacer</button>
          )}
        </div>
      </Field>

      <Field label="Étiquettes (Tags)">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {(task.tags || []).map((tg) => (
            <span key={tg} className="chip solid" style={{ paddingRight: 4 }}>
              <Tag size={10} /> #{tg}
              <button
                type="button"
                className="icon-btn"
                style={{ width: 18, height: 18, marginLeft: 2 }}
                onClick={() => removeTag(tg)}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <input
            className="input"
            style={{ height: 32, maxWidth: 200 }}
            placeholder="Ex : #admin, #urgent"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          />
          <button type="button" className="btn btn-ghost small" onClick={addTag}>+ Ajouter tag</button>
        </div>
      </Field>

      <Field label="Lien externe">
        <div className="row" style={{ gap: 6 }}>
          <input
            type="url"
            className="input grow"
            style={{ height: 34 }}
            placeholder="https://..."
            value={task.url || ''}
            onChange={(e) => set((t) => (t.url = e.target.value.trim() || undefined))}
          />
          {task.url && (
            <a
              href={task.url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ height: 34, gap: 4, display: 'inline-flex', alignItems: 'center', padding: '0 12px' }}
            >
              <ExternalLink size={14} /> Ouvrir
            </a>
          )}
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

export function DueChip({ task, due, done }: { task?: Task; due?: string; done?: boolean }) {
  const d = due || task?.due;
  const isDone = done ?? (task?.status === 'done');
  if (!d && !task?.dueTime) return null;
  const t = today();
  const late = !isDone && d && daysBetween(t, d) < 0;
  const text = [
    d ? fmtDate(d) : null,
    task?.dueTime ? task.dueTime : null
  ].filter(Boolean).join(' · ');

  return (
    <span className={'chip' + (late ? ' danger' : '')}>
      {task?.recurrence && <Repeat size={10} />}
      {task?.reminder?.enabled && <Bell size={10} />}
      {text}
    </span>
  );
}
