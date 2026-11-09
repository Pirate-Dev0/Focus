import { useState } from 'react';
import { Bell, Clock, Flame, Moon, Plus, Snowflake, Sparkles, Sun, Sunset, Trash2 } from 'lucide-react';
import { update, useAppState } from '../store';
import { go } from '../router';
import { Field, Segmented, Sheet, Empty, toast } from '../components/ui';
import type { Habit, HabitFrequencyType, HabitKind, TimeOfDay } from '../types';
import { addDays, DAYS_SHORT, habitDueOn, habitStreak, haptic, isHabitDone, parseDate, today, uid } from '../utils';
import { setHabitProgress, toggleHabitFreeze } from '../actions';
import Gym from './Gym';

const EMOJI_PRESETS = ['💧', '📚', '🏋️', '🏃', '🧘', '💻', '🥗', '💤', '✍️', '🎯', '🍎', '☀️', '🚶', '💊'];

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

  const toggle = (h: Habit, date: string) => {
    haptic();
    setHabitProgress(h.id, date, 'toggle');
  };

  // taux de la semaine
  let due = 0, done = 0;
  habits.forEach((h) => days.forEach((d) => {
    if (d <= t && habitDueOn(h, d)) {
      due++;
      if (isHabitDone(h, d)) done++;
    }
  }));

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
              <HabitRow key={h.id} h={h} days={days} t={t} onToggle={(d) => toggle(h, d)} onEdit={() => setEdit(h)} />
            ))}
          </div>
        )}
      </div>
      <button className="btn btn-block" style={{ marginTop: 12 }} onClick={() => setEdit('new')}><Plus size={15} /> Nouvelle habitude</button>
      <HabitSheet habit={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function HabitRow({ h, days, t, onToggle, onEdit }: { h: Habit; days: string[]; t: string; onToggle: (d: string) => void; onEdit: () => void }) {
  const streak = habitStreak(h);
  return (
    <>
      <button onClick={onEdit} style={{ textAlign: 'left', minWidth: 0, padding: '6px 0' }}>
        <div className="ellipsis" style={{ fontWeight: 550, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 5 }}>
          {h.emoji && <span>{h.emoji}</span>}
          <span className="ellipsis">{h.name}</span>
        </div>
        <div className="faint small row" style={{ gap: 6, marginTop: 2 }}>
          {streak > 0 && <span className="row" style={{ gap: 2 }}><Flame size={11} color="var(--accent)" /> {streak} j</span>}
          {h.reminderTime && <span className="row" style={{ gap: 2 }}><Clock size={10} /> {h.reminderTime}</span>}
        </div>
      </button>
      {days.map((d) => {
        const dueDay = habitDueOn(h, d);
        const on = isHabitDone(h, d);
        const frozen = h.freezes?.includes(d);
        const future = d > t;
        const curVal = h.values?.[d] ?? 0;
        return (
          <button
            key={d}
            className={'wcell' + (on ? ' on' : '') + (frozen ? ' frozen' : '') + (!dueDay ? ' off' : '') + (future ? ' future' : '')}
            disabled={future}
            onClick={() => onToggle(d)}
            aria-label={`${h.name} ${d}`}
            title={h.kind === 'numeric' ? `${curVal}/${h.targetValue} ${h.unit || ''}` : undefined}
          >
            {on ? (
              <svg width="12" height="12" viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            ) : frozen ? (
              <Snowflake size={11} />
            ) : h.kind === 'numeric' && curVal > 0 ? (
              <span style={{ fontSize: 9.5, fontWeight: 700 }}>{curVal}</span>
            ) : null}
          </button>
        );
      })}
    </>
  );
}

function HabitSheet({ habit, onClose }: { habit: Habit | 'new' | null; onClose: () => void }) {
  const isNew = habit === 'new';
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💧');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [freqType, setFreqType] = useState<HabitFrequencyType>('days');
  const [timesPerWeek, setTimesPerWeek] = useState(3);
  const [kind, setKind] = useState<HabitKind>('boolean');
  const [targetValue, setTargetValue] = useState(2);
  const [unit, setUnit] = useState('L');
  const [step, setStep] = useState(0.5);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('any');
  const [reminderTime, setReminderTime] = useState('');
  const [streakGoal, setStreakGoal] = useState<number | undefined>(undefined);
  const [key, setKey] = useState<string | null>(null);

  const k = habit === null ? null : isNew ? 'new' : habit.id;
  if (k !== key) {
    setKey(k);
    if (habit && habit !== 'new') {
      setName(habit.name);
      setEmoji(habit.emoji || '💧');
      setDays(habit.days || [0, 1, 2, 3, 4, 5, 6]);
      setFreqType(habit.frequencyType || 'days');
      setTimesPerWeek(habit.timesPerWeek || 3);
      setKind(habit.kind || 'boolean');
      setTargetValue(habit.targetValue || 2);
      setUnit(habit.unit || 'L');
      setStep(habit.step || 0.5);
      setTimeOfDay(habit.timeOfDay || 'any');
      setReminderTime(habit.reminderTime || '');
      setStreakGoal(habit.streakGoal);
    } else {
      setName('');
      setEmoji('💧');
      setDays([0, 1, 2, 3, 4, 5, 6]);
      setFreqType('days');
      setTimesPerWeek(3);
      setKind('boolean');
      setTargetValue(2);
      setUnit('L');
      setStep(0.5);
      setTimeOfDay('any');
      setReminderTime('');
      setStreakGoal(undefined);
    }
  }
  if (!habit) return null;

  const save = () => {
    if (!name.trim()) return;
    if (freqType === 'days' && !days.length) return;
    update((d) => {
      const payload = {
        name: name.trim(),
        emoji,
        days,
        frequencyType: freqType,
        timesPerWeek: freqType === 'times_per_week' ? timesPerWeek : undefined,
        kind,
        targetValue: kind === 'numeric' ? targetValue : undefined,
        unit: kind === 'numeric' ? unit.trim() : undefined,
        step: kind === 'numeric' ? step : undefined,
        timeOfDay,
        reminderTime: reminderTime || undefined,
        streakGoal: streakGoal || undefined
      };

      if (isNew) {
        d.habits.push({
          id: uid(),
          ...payload,
          done: [],
          values: {},
          freezes: [],
          archived: false
        });
      } else {
        const h = d.habits.find((x) => x.id === (habit as Habit).id)!;
        Object.assign(h, payload);
      }
    });
    onClose();
  };

  const currentHabit = !isNew ? (habit as Habit) : null;
  const t = today();

  const handleUseFreezeToday = () => {
    if (!currentHabit) return;
    toggleHabitFreeze(currentHabit.id, t);
  };

  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'Nouvelle habitude' : 'Modifier l’habitude'}
      actions={!isNew && (
        <button
          className="icon-btn"
          aria-label="Supprimer"
          onClick={() => {
            if (confirm('Supprimer cette habitude et son historique ?')) {
              update((d) => {
                d.habits = d.habits.filter((x) => x.id !== (habit as Habit).id);
              });
              onClose();
            }
          }}
        >
          <Trash2 size={16} />
        </button>
      )}
    >
      <Field label="Habitude & Émoji">
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            style={{ width: 48, height: 40, textAlign: 'center', fontSize: 18, padding: 0 }}
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
          />
          <input
            className="input grow"
            autoFocus
            placeholder="Ex : Boire 2 L d'eau, Lire 20 min…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {EMOJI_PRESETS.map((em) => (
            <button
              key={em}
              type="button"
              className={'chip' + (emoji === em ? ' solid' : '')}
              style={{ fontSize: 14, padding: '0 8px' }}
              onClick={() => setEmoji(em)}
            >
              {em}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Moment de la journée">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {[
            { id: 'any', l: 'Tout moment' },
            { id: 'morning', l: 'Matin ☀️' },
            { id: 'afternoon', l: 'Après-midi 🌤️' },
            { id: 'evening', l: 'Soir 🌙' }
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              className={'chip chip-lg' + (timeOfDay === m.id ? ' solid' : '')}
              onClick={() => setTimeOfDay(m.id as TimeOfDay)}
            >
              {m.l}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Alarme & Rappel personnalisé">
        <div className="row" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <input
            type="time"
            className="input"
            style={{ width: 115, height: 34 }}
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
          />
          {['07:30', '08:30', '12:30', '18:00', '21:00', '22:30'].map((time) => (
            <button
              key={time}
              type="button"
              className={'chip' + (reminderTime === time ? ' solid' : '')}
              onClick={() => setReminderTime(reminderTime === time ? '' : time)}
            >
              <Bell size={10} /> {time}
            </button>
          ))}
          {reminderTime && (
            <button type="button" className="btn btn-ghost small" onClick={() => setReminderTime('')}>Effacer</button>
          )}
        </div>
      </Field>

      <Field label="Type d'objectif">
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <button
            type="button"
            className={'chip chip-lg grow' + (kind === 'boolean' ? ' solid' : '')}
            style={{ justifyContent: 'center' }}
            onClick={() => setKind('boolean')}
          >
            ✓ Coche simple (Oui / Non)
          </button>
          <button
            type="button"
            className={'chip chip-lg grow' + (kind === 'numeric' ? ' solid' : '')}
            style={{ justifyContent: 'center' }}
            onClick={() => setKind('numeric')}
          >
            🔢 Quantitatif (Chiffré)
          </button>
        </div>

        {kind === 'numeric' && (
          <div className="card" style={{ padding: 12, background: 'var(--bg-elev)', marginTop: 8 }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 90 }}>
                <span className="faint small" style={{ display: 'block', marginBottom: 4 }}>Cible :</span>
                <input
                  type="number"
                  step="any"
                  className="input"
                  style={{ width: '100%', height: 34 }}
                  value={targetValue}
                  onChange={(e) => setTargetValue(Number(e.target.value) || 1)}
                />
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <span className="faint small" style={{ display: 'block', marginBottom: 4 }}>Unité :</span>
                <input
                  className="input"
                  style={{ width: '100%', height: 34 }}
                  placeholder="L, pages, pas…"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <span className="faint small" style={{ display: 'block', marginBottom: 4 }}>Pas (+ / tap) :</span>
                <input
                  type="number"
                  step="any"
                  className="input"
                  style={{ width: '100%', height: 34 }}
                  value={step}
                  onChange={(e) => setStep(Number(e.target.value) || 1)}
                />
              </div>
            </div>
          </div>
        )}
      </Field>

      <Field label="Fréquence">
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <button
            type="button"
            className={'chip chip-lg grow' + (freqType === 'days' ? ' solid' : '')}
            style={{ justifyContent: 'center' }}
            onClick={() => setFreqType('days')}
          >
            Jours précis
          </button>
          <button
            type="button"
            className={'chip chip-lg grow' + (freqType === 'times_per_week' ? ' solid' : '')}
            style={{ justifyContent: 'center' }}
            onClick={() => setFreqType('times_per_week')}
          >
            X fois / semaine
          </button>
        </div>

        {freqType === 'days' ? (
          <>
            <div className="row" style={{ gap: 6, marginBottom: 8 }}>
              {order.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={'chip' + (days.includes(d) ? ' solid' : '')}
                  style={{ width: 38, height: 34, justifyContent: 'center' }}
                  onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
                >
                  {DAYS_SHORT[d]}
                </button>
              ))}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn btn-ghost small" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>Tous les jours</button>
              <button type="button" className="btn btn-ghost small" onClick={() => setDays([1, 2, 3, 4, 5])}>Semaine</button>
              <button type="button" className="btn btn-ghost small" onClick={() => setDays([0, 6])}>Week-end</button>
            </div>
          </>
        ) : (
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="faint small">Objectif de :</span>
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                className={'chip' + (timesPerWeek === n ? ' solid' : '')}
                onClick={() => setTimesPerWeek(n)}
              >
                {n} j / sem
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label="Objectif de série (Streak)">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className={'chip' + (!streakGoal ? ' solid' : '')}
            onClick={() => setStreakGoal(undefined)}
          >
            Sans palier
          </button>
          {[7, 14, 21, 30, 60, 100].map((goal) => (
            <button
              key={goal}
              type="button"
              className={'chip' + (streakGoal === goal ? ' solid' : '')}
              onClick={() => setStreakGoal(goal)}
            >
              <Sparkles size={11} /> {goal} jours
            </button>
          ))}
        </div>
      </Field>

      {!isNew && currentHabit && (
        <Field label="Joker de série (Streak freeze)">
          <div className="row-between" style={{ background: 'var(--bg-elev)', padding: '10px 12px', borderRadius: 10 }}>
            <div>
              <div style={{ fontWeight: 550, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Snowflake size={13} color="#38bdf8" /> Joker pour aujourd’hui
              </div>
              <div className="faint small">Protège ta flamme 🔥 si tu ne peux pas faire cette habitude.</div>
            </div>
            <button
              type="button"
              className={'btn ' + (currentHabit.freezes?.includes(t) ? 'btn-primary' : 'btn-ghost')}
              style={{ fontSize: 12, height: 32 }}
              onClick={handleUseFreezeToday}
            >
              {currentHabit.freezes?.includes(t) ? 'Joker actif ✓' : 'Activer'}
            </button>
          </div>
        </Field>
      )}

      <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 16 }} onClick={save}>
        {isNew ? 'Ajouter l’habitude' : 'Enregistrer les modifications'}
      </button>
    </Sheet>
  );
}
