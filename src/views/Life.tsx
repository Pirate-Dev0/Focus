import { useState } from 'react';
import { Flame, Plus, Trash2 } from 'lucide-react';
import { update, useAppState } from '../store';
import { go } from '../router';
import { Field, Segmented, Sheet, Empty } from '../components/ui';
import type { Habit } from '../types';
import { addDays, DAYS_SHORT, habitDueOn, habitStreak, haptic, parseDate, today, uid } from '../utils';
import Gym from './Gym';

export default function Life({ tab }: { tab?: string }) {
  const current = tab === 'salle' ? 'salle' : 'habitudes';
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Life</h1>
          <div className="page-sub">Tes habitudes et ta progression à la salle.</div>
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <Segmented
          value={current}
          onChange={(v) => go('life/' + v)}
          options={[{ value: 'habitudes', label: 'Habitudes' }, { value: 'salle', label: 'Salle' }]}
        />
      </div>
      {current === 'habitudes' ? <Habits /> : <Gym />}
    </>
  );
}

function Habits() {
  const s = useAppState();
  const [weekOffset, setWeekOffset] = useState(0);
  const [edit, setEdit] = useState<Habit | 'new' | null>(null);
  const t = today();
  // semaine du lundi au dimanche
  const base = addDays(t, weekOffset * 7);
  const dow = (parseDate(base).getDay() + 6) % 7;
  const monday = addDays(base, -dow);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const habits = s.habits.filter((h) => !h.archived);

  const toggle = (id: string, date: string) => {
    haptic();
    update((d) => {
      const h = d.habits.find((x) => x.id === id)!;
      h.done = h.done.includes(date) ? h.done.filter((x) => x !== date) : [...h.done, date];
    });
  };

  // taux de la semaine
  let due = 0, done = 0;
  habits.forEach((h) => days.forEach((d) => { if (d <= t && habitDueOn(h, d)) { due++; if (h.done.includes(d)) done++; } }));

  return (
    <>
      <div className="row-between" style={{ marginBottom: 10 }}>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn btn-ghost" onClick={() => setWeekOffset(weekOffset - 1)}>‹</button>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {weekOffset === 0 ? 'Cette semaine' : `${parseDate(days[0]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${parseDate(days[6]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
          </span>
          <button className="btn btn-ghost" disabled={weekOffset >= 0} style={{ opacity: weekOffset >= 0 ? 0.3 : 1 }} onClick={() => setWeekOffset(weekOffset + 1)}>›</button>
        </div>
        <span className="faint small mono">{due ? Math.round((done / due) * 100) : 0} % réussi</span>
      </div>

      <div className="card" style={{ padding: '12px 10px 6px 14px' }}>
        {habits.length === 0 ? (
          <Empty title="Aucune habitude">Ajoute ce que tu veux tenir tous les jours.</Empty>
        ) : (
          <div className="week-grid">
            <div />
            {days.map((d) => (
              <div key={d} className={'day-h' + (d === t ? ' today' : '')}>
                {DAYS_SHORT[parseDate(d).getDay()]}
                <div style={{ fontSize: 10, opacity: 0.8 }}>{parseDate(d).getDate()}</div>
              </div>
            ))}
            {habits.map((h) => (
              <HabitRow key={h.id} h={h} days={days} t={t} onToggle={toggle} onEdit={() => setEdit(h)} />
            ))}
          </div>
        )}
      </div>
      <button className="btn btn-block" style={{ marginTop: 12 }} onClick={() => setEdit('new')}><Plus size={15} /> Nouvelle habitude</button>
      <HabitSheet habit={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function HabitRow({ h, days, t, onToggle, onEdit }: { h: Habit; days: string[]; t: string; onToggle: (id: string, d: string) => void; onEdit: () => void }) {
  const streak = habitStreak(h);
  return (
    <>
      <button onClick={onEdit} style={{ textAlign: 'left', minWidth: 0, padding: '6px 0' }}>
        <div className="ellipsis" style={{ fontWeight: 500, fontSize: 13.5 }}>{h.name}</div>
        {streak > 0 && <div className="faint small row" style={{ gap: 3 }}><Flame size={11} /> {streak} j</div>}
      </button>
      {days.map((d) => {
        const dueDay = habitDueOn(h, d);
        const on = h.done.includes(d);
        const future = d > t;
        return (
          <button
            key={d}
            className={'wcell' + (on ? ' on' : '') + (!dueDay ? ' off' : '') + (future ? ' future' : '')}
            disabled={future}
            onClick={() => onToggle(h.id, d)}
            aria-label={`${h.name} ${d}`}
          >
            {on && <svg width="12" height="12" viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </button>
        );
      })}
    </>
  );
}

function HabitSheet({ habit, onClose }: { habit: Habit | 'new' | null; onClose: () => void }) {
  const isNew = habit === 'new';
  const [name, setName] = useState('');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [key, setKey] = useState<string | null>(null);
  const k = habit === null ? null : isNew ? 'new' : habit.id;
  if (k !== key) {
    setKey(k);
    if (habit && habit !== 'new') { setName(habit.name); setDays(habit.days); }
    else { setName(''); setDays([0, 1, 2, 3, 4, 5, 6]); }
  }
  if (!habit) return null;

  const save = () => {
    if (!name.trim() || !days.length) return;
    update((d) => {
      if (isNew) d.habits.push({ id: uid(), name: name.trim(), days, done: [], archived: false });
      else {
        const h = d.habits.find((x) => x.id === (habit as Habit).id)!;
        h.name = name.trim();
        h.days = days;
      }
    });
    onClose();
  };
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'Nouvelle habitude' : 'Modifier'}
      actions={!isNew && (
        <button className="icon-btn" aria-label="Supprimer" onClick={() => { if (confirm('Supprimer cette habitude et son historique ?')) { update((d) => { d.habits = d.habits.filter((x) => x.id !== (habit as Habit).id); }); onClose(); } }}><Trash2 size={16} /></button>
      )}
    >
      <Field label="Habitude">
        <input className="input" autoFocus placeholder="Ex : Méditer 10 min" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Field>
      <Field label="Quels jours ?">
        <div className="row" style={{ gap: 6 }}>
          {order.map((d) => (
            <button key={d} className={'chip' + (days.includes(d) ? ' solid' : '')} style={{ width: 38, height: 34, justifyContent: 'center' }} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}>
              {DAYS_SHORT[d]}
            </button>
          ))}
        </div>
      </Field>
      <div className="row" style={{ gap: 6, marginBottom: 16 }}>
        <button className="btn btn-ghost small" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>Tous les jours</button>
        <button className="btn btn-ghost small" onClick={() => setDays([1, 2, 3, 4, 5])}>Semaine</button>
        <button className="btn btn-ghost small" onClick={() => setDays([0, 6])}>Week-end</button>
      </div>
      <button className="btn btn-primary btn-lg btn-block" onClick={save}>{isNew ? 'Ajouter' : 'Enregistrer'}</button>
    </Sheet>
  );
}
