import { useEffect, useState, type CSSProperties } from 'react';
import { BarChart3, Bell, Check, ChevronDown, ChevronRight, Clock, Flame, Hash, Minus, Moon, Plus, Snowflake, Sun, Sunrise, Trash2 } from 'lucide-react';
import { update, useAppState } from '../store';
import { go } from '../router';
import { ChipScroll, NumInput, Segmented, Sheet, Empty, toast } from '../components/ui';
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

const HABIT_COLORS = ['#3b82f6', '#c026d3', '#14b8a6', '#f97316', '#ec4899', '#22c55e', '#6366f1', '#ef4444'];
// Couleurs en plus, dépliables dans la fiche habitude (rangées par teinte)
const MORE_COLORS = [
  '#b91c1c', '#e11d48', '#db2777', '#a855f7', '#8b5cf6', '#1d4ed8', '#0ea5e9', '#06b6d4',
  '#10b981', '#15803d', '#65a30d', '#f59e0b', '#c2410c', '#a16207', '#64748b', '#3f3f46',
];
const WEEKS = 7; // lignes de la grille d'historique
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lundi → dimanche

const fmtNum = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

function Habits() {
  const s = useAppState();
  const [edit, setEdit] = useState<Habit | 'new' | null>(null);
  const t = today();
  const habits = s.habits.filter((h) => !h.archived);

  // chaque habitude garde sa couleur (synchronisée), même si l'ordre change
  useEffect(() => {
    if (!s.habits.some((h) => !h.color)) return;
    update((d) => {
      d.habits.forEach((h, i) => { if (!h.color) h.color = HABIT_COLORS[i % HABIT_COLORS.length]; });
    });
  }, [s.habits]);

  const dow = (parseDate(t).getDay() + 6) % 7;
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - dow));
  const dueToday = habits.filter((h) => habitDueOn(h, t));
  const doneToday = dueToday.filter((h) => isHabitDone(h, t)).length;
  let due = 0, done = 0;
  habits.forEach((h) => week.forEach((d) => {
    if (d <= t && habitDueOn(h, d)) {
      due++;
      if (isHabitDone(h, d)) done++;
    }
  }));
  const rate = due ? Math.round((done / due) * 100) : 0;

  return (
    <>
      <div className="hb-head card">
        <div className="hb-title">Mes habitudes</div>
        <div className="hb-sub">Des routines qui te rapprochent de ton objectif.</div>
        <div className="hb-stats">
          <div>
            <div className="hb-num" style={{ color: '#3b82f6' }}>{habits.length}</div>
            <div className="hb-lbl">Habitudes</div>
          </div>
          <div>
            <div className="hb-num" style={{ color: '#22c55e' }}>{doneToday}<span className="hb-den">/{dueToday.length}</span></div>
            <div className="hb-lbl">Faites aujourd’hui</div>
          </div>
          <div>
            <div className="hb-num" style={{ color: '#c026d3' }}>{rate}<span className="hb-den"> %</span></div>
            <div className="hb-lbl">Cette semaine</div>
          </div>
        </div>
      </div>

      <button className="hb-new card" onClick={() => setEdit('new')}>
        <span className="hb-new-ic"><Plus size={14} strokeWidth={2.8} /></span>
        <span className="grow">Nouvelle habitude</span>
        <ChevronRight size={17} color="var(--text-3)" />
      </button>

      {habits.length === 0 ? (
        <div className="card"><Empty title="Aucune habitude">Ajoute ce que tu veux tenir tous les jours.</Empty></div>
      ) : (
        <div className="hb-list">
          {habits.map((h, i) => (
            <HabitCard key={h.id} h={h} color={h.color || HABIT_COLORS[i % HABIT_COLORS.length]} t={t} onEdit={() => setEdit(h)} />
          ))}
        </div>
      )}
      <HabitSheet habit={edit} defaultColor={HABIT_COLORS[s.habits.length % HABIT_COLORS.length]} onClose={() => setEdit(null)} />
    </>
  );
}

function bestStreak(h: Habit, t: string) {
  let best = 0, run = 0;
  for (let i = 365; i >= 0; i--) {
    const d = addDays(t, -i);
    if (!habitDueOn(h, d)) continue;
    if (isHabitDone(h, d)) best = Math.max(best, ++run);
    else if (h.freezes?.includes(d) || d === t) continue;
    else run = 0;
  }
  return best;
}

function HabitCard({ h, color, t, onEdit }: { h: Habit; color: string; t: string; onEdit: () => void }) {
  const [showStats, setShowStats] = useState(false);
  const dow = (parseDate(t).getDay() + 6) % 7;
  const start = addDays(t, -dow - (WEEKS - 1) * 7);
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(start, i));
  const thisWeek = cells.slice(-7);

  const numeric = h.kind === 'numeric';
  const cur = h.values?.[t] ?? 0;
  const target = h.targetValue || 1;
  const step = h.step || 1;
  const unit = h.unit || '';
  const doneT = isHabitDone(h, t);
  const dueT = habitDueOn(h, t);
  const perWeek = h.frequencyType === 'times_per_week';
  const weekDone = thisWeek.filter((d) => isHabitDone(h, d)).length;
  const streak = habitStreak(h);

  // plus la série est longue, plus la case est foncée
  let run = 0;
  const states = cells.map((d) => {
    if (d > t) return { d, cls: 'future' };
    if (isHabitDone(h, d)) {
      run++;
      return { d, cls: 'done', i: Math.min(100, 55 + run * 15) };
    }
    if (h.freezes?.includes(d)) return { d, cls: 'frozen' };
    const due = habitDueOn(h, d);
    if (due && d !== t) run = 0;
    if (numeric && (h.values?.[d] ?? 0) > 0) return { d, cls: 'partial' };
    return { d, cls: due ? 'miss' : 'off' };
  });

  const toggleDay = (d: string) => {
    if (d > t) return;
    haptic();
    const was = isHabitDone(h, d);
    setHabitProgress(h.id, d, 'toggle');
    if (d !== t) {
      const label = parseDate(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
      toast(`${was ? 'Retiré' : 'Validé'} · ${label}`, { label: 'Annuler', run: () => setHabitProgress(h.id, d, 'toggle') });
    }
  };

  const checkIn = () => {
    haptic();
    setHabitProgress(h.id, t, numeric ? step : 'toggle');
  };

  const remove = () => {
    haptic();
    let idx = -1;
    update((d) => {
      idx = d.habits.findIndex((x) => x.id === h.id);
      if (idx >= 0) d.habits.splice(idx, 1);
    });
    toast('Habitude supprimée', {
      label: 'Annuler',
      run: () => update((d) => { if (!d.habits.some((x) => x.id === h.id)) d.habits.splice(Math.max(0, idx), 0, h); })
    });
  };

  let stats: { streak: number; best: number; rate30: number; total: number } | null = null;
  if (showStats) {
    let due30 = 0, done30 = 0;
    for (let i = 0; i < 30; i++) {
      const d = addDays(t, -i);
      if (habitDueOn(h, d) && (d !== t || isHabitDone(h, d))) {
        due30++;
        if (isHabitDone(h, d)) done30++;
      }
    }
    stats = {
      streak,
      best: bestStreak(h, t),
      rate30: due30 ? Math.round((done30 / due30) * 100) : 0,
      total: new Set(h.done).size
    };
  }

  const pct = numeric && !doneT ? Math.min(100, (cur / target) * 100) : 0;

  return (
    <div className="hb-card" style={{ '--c': color } as CSSProperties}>
      <div className="hb-main">
        <div className="hm" role="grid" aria-label={`Historique ${h.name}`}>
          {states.map(({ d, cls, i }) => (
            <button
              key={d + cls}
              className={'hm-cell ' + cls + (d === t ? ' today' : '')}
              style={i ? ({ '--i': i + '%' } as CSSProperties) : undefined}
              disabled={cls === 'future'}
              onClick={() => toggleDay(d)}
              aria-label={`${h.name} ${d}`}
              title={numeric ? `${fmtNum(h.values?.[d] ?? 0)}/${fmtNum(target)} ${unit}` : undefined}
            />
          ))}
        </div>

        <div className="hb-side">
          <button className="hb-name" onClick={onEdit}>
            {h.emoji && <span className="em">{h.emoji}</span>}
            <span className="ellipsis">{h.name}</span>
          </button>
          {(streak > 0 || h.reminderTime || perWeek) && (
            <div className="hb-meta">
              {perWeek && <span>{weekDone}/{h.timesPerWeek || 3} cette sem.</span>}
              {streak > 0 && <span className="row" style={{ gap: 2 }}><Flame size={11} color="#f97316" /> {streak} j</span>}
              {h.reminderTime && <span className="row" style={{ gap: 2 }}><Clock size={10} /> {h.reminderTime}</span>}
            </div>
          )}

          <div className="hb-icons">
            <button className={'hb-ic' + (showStats ? ' on' : '')} aria-label="Statistiques" onClick={() => { haptic(); setShowStats(!showStats); }}>
              <BarChart3 size={16} strokeWidth={2.4} />
            </button>
            <button className="hb-ic del" aria-label="Supprimer" onClick={remove}>
              <Trash2 size={15} strokeWidth={2.2} />
            </button>
          </div>

          <div className="hb-days">
            {WEEK_ORDER.map((wd, i) => {
              const d = thisWeek[i];
              const on = perWeek ? isHabitDone(h, d) : h.days.includes(wd);
              return (
                <span key={wd} className={'hb-day' + (on ? ' on' : '') + (d === t ? ' today' : '')}>
                  {DAYS_SHORT[wd]}
                </span>
              );
            })}
          </div>

          <div className="hb-actions">
            {numeric && cur > 0 && (
              <button className="hb-minus" aria-label="Retirer" onClick={() => { haptic(); setHabitProgress(h.id, t, -step); }}>
                <Minus size={17} strokeWidth={2.6} />
              </button>
            )}
            <button
              className={'hb-check' + (doneT ? ' done' : !dueT ? ' soft' : '')}
              style={{ '--p': pct + '%' } as CSSProperties}
              onClick={checkIn}
            >
              <span className="hb-check-in">
                {doneT ? (
                  <><Check size={17} strokeWidth={3} /> {numeric ? `${fmtNum(cur)}/${fmtNum(target)} ${unit}` : 'Fait'}</>
                ) : numeric ? (
                  <><Plus size={17} strokeWidth={2.8} /> {fmtNum(step)} {unit}<span className="hb-check-sub">{fmtNum(cur)}/{fmtNum(target)}</span></>
                ) : (
                  <><Plus size={17} strokeWidth={2.8} /> Valider</>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      {stats && (
        <div className="hb-statrow">
          <div><b>{stats.streak} j</b><span>Série</span></div>
          <div><b>{stats.best} j</b><span>Record</span></div>
          <div><b>{stats.rate30} %</b><span>30 jours</span></div>
          <div><b>{stats.total}</b><span>Total</span></div>
        </div>
      )}
    </div>
  );
}

function HabitSheet({ habit, defaultColor, onClose }: { habit: Habit | 'new' | null; defaultColor: string; onClose: () => void }) {
  const isNew = habit === 'new';
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💧');
  const [color, setColor] = useState(defaultColor);
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
  const [moreColors, setMoreColors] = useState(false);

  const k = habit === null ? null : isNew ? 'new' : habit.id;
  if (k !== key) {
    setKey(k);
    if (habit && habit !== 'new') {
      setName(habit.name);
      setEmoji(habit.emoji || '💧');
      setColor(habit.color || defaultColor);
      setMoreColors(!!habit.color && !HABIT_COLORS.includes(habit.color));
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
      setColor(defaultColor);
      setMoreColors(false);
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
        color,
        days,
        frequencyType: freqType,
        timesPerWeek: freqType === 'times_per_week' ? timesPerWeek : undefined,
        kind,
        targetValue: kind === 'numeric' ? (targetValue > 0 ? targetValue : 1) : undefined,
        unit: kind === 'numeric' ? unit.trim() : undefined,
        step: kind === 'numeric' ? (step > 0 ? step : 1) : undefined,
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
  const sameDays = (a: number[]) => a.length === days.length && a.every((d) => days.includes(d));
  const DAY_PRESETS = [
    { l: 'Tous les jours', v: [0, 1, 2, 3, 4, 5, 6] },
    { l: 'En semaine', v: [1, 2, 3, 4, 5] },
    { l: 'Week-end', v: [0, 6] }
  ];
  const MOMENTS: { id: TimeOfDay; l: string; icon: typeof Sun }[] = [
    { id: 'any', l: 'Libre', icon: Clock },
    { id: 'morning', l: 'Matin', icon: Sunrise },
    { id: 'afternoon', l: 'Après-midi', icon: Sun },
    { id: 'evening', l: 'Soir', icon: Moon }
  ];
  const freqLabel = freqType === 'times_per_week'
    ? `${timesPerWeek}× par semaine`
    : DAY_PRESETS.find((p) => sameDays(p.v))?.l ?? `${days.length} jour${days.length > 1 ? 's' : ''} / semaine`;
  const momentLabel = timeOfDay === 'any' ? '' : MOMENTS.find((m) => m.id === timeOfDay)?.l.toLowerCase();
  const summary = [freqLabel, momentLabel && `le ${momentLabel}`, reminderTime && `rappel ${reminderTime}`].filter(Boolean).join(' · ');
  const canSave = Boolean(name.trim()) && (freqType !== 'days' || days.length > 0);

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
      footer={
        <button className="btn btn-primary btn-lg btn-block" disabled={!canSave} onClick={save}>
          {isNew ? 'Ajouter l’habitude' : 'Enregistrer'}
        </button>
      }
    >
      <div className="hs" style={{ '--c': color } as CSSProperties}>
        {/* Aperçu : icône + nom + résumé */}
        <div className="hs-hero">
          <input
            className="hs-emoji"
            aria-label="Émoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
          />
          <div className="hs-hero-main">
            <input
              className="hs-name"
              autoFocus={isNew}
              placeholder="Nom de l’habitude"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
            <div className="hs-summary">{summary}</div>
          </div>
        </div>

        <section className="hs-sec">
          <div className="hs-label">Icône</div>
          <div className="hs-emojis">
            {EMOJI_PRESETS.map((em) => (
              <button key={em} type="button" className={'hs-emo' + (emoji === em ? ' on' : '')} onClick={() => setEmoji(em)}>
                {em}
              </button>
            ))}
          </div>
        </section>

        <section className="hs-sec">
          <div className="hs-label-row">
            <div className="hs-label">Couleur</div>
            <button type="button" className="hs-more" onClick={() => setMoreColors((v) => !v)} aria-expanded={moreColors}>
              {moreColors ? 'Moins' : 'Plus de couleurs'}
              <ChevronDown size={14} className={moreColors ? 'flip' : ''} />
            </button>
          </div>
          <div className="hs-colors">
            {(moreColors ? [...HABIT_COLORS, ...MORE_COLORS] : HABIT_COLORS).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                className={'hb-swatch' + (color.toLowerCase() === c ? ' on' : '')}
                style={{ '--c': c } as CSSProperties}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          {moreColors && (() => {
            const custom = ![...HABIT_COLORS, ...MORE_COLORS].includes(color.toLowerCase());
            return (
              <label className={'hs-custom' + (custom ? ' on' : '')}>
                <span className={'hs-custom-dot' + (custom ? '' : ' rainbow')} style={{ '--c': color } as CSSProperties} />
                <span className="hs-row-text">
                  <b>Couleur personnalisée</b>
                  <span>{custom ? color.toUpperCase() : 'Choisis n’importe quelle teinte'}</span>
                </span>
                <ChevronRight size={16} className="faint" />
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#3b82f6'}
                  onChange={(e) => setColor(e.target.value)}
                  aria-label="Couleur personnalisée"
                />
              </label>
            );
          })()}
        </section>

        <section className="hs-sec">
          <div className="hs-label">Objectif</div>
          <Segmented
            full
            value={kind}
            onChange={setKind}
            options={[
              { value: 'boolean', label: <><Check size={14} /> Oui / Non</> },
              { value: 'numeric', label: <><Hash size={14} /> Quantité</> }
            ]}
          />
          <div className="hs-hint">
            {kind === 'boolean' ? 'Une simple case à cocher chaque jour.' : 'Tu ajoutes une quantité jusqu’à atteindre ta cible.'}
          </div>
          {kind === 'numeric' && (
            <div className="hs-grid3">
              <label className="hs-mini">
                <span>Cible</span>
                <NumInput value={targetValue} onChange={setTargetValue} placeholder="2" />
              </label>
              <label className="hs-mini">
                <span>Unité</span>
                <input className="input" placeholder="L, pages…" value={unit} onChange={(e) => setUnit(e.target.value)} />
              </label>
              <label className="hs-mini">
                <span>Par appui</span>
                <NumInput value={step} onChange={setStep} placeholder="0,5" />
              </label>
            </div>
          )}
        </section>

        <section className="hs-sec">
          <div className="hs-label">Fréquence</div>
          <Segmented
            full
            value={freqType}
            onChange={setFreqType}
            options={[
              { value: 'days', label: 'Jours précis' },
              { value: 'times_per_week', label: 'X fois / sem.' }
            ]}
          />
          {freqType === 'days' ? (
            <>
              <div className="hs-days">
                {order.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={'hs-day' + (days.includes(d) ? ' on' : '')}
                    onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
                  >
                    {DAYS_SHORT[d]}
                  </button>
                ))}
              </div>
              <div className="hs-presets">
                {DAY_PRESETS.map((p) => (
                  <button key={p.l} type="button" className={'hs-preset' + (sameDays(p.v) ? ' on' : '')} onClick={() => setDays(p.v)}>
                    {p.l}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="hs-days five">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button key={n} type="button" className={'hs-day' + (timesPerWeek === n ? ' on' : '')} onClick={() => setTimesPerWeek(n)}>
                    {n}
                  </button>
                ))}
              </div>
              <div className="hs-hint center">fois par semaine, les jours que tu veux</div>
            </>
          )}
        </section>

        <section className="hs-sec">
          <div className="hs-label">Moment de la journée</div>
          <div className="hs-moments">
            {MOMENTS.map(({ id, l, icon: Icon }) => (
              <button key={id} type="button" className={'hs-moment' + (timeOfDay === id ? ' on' : '')} onClick={() => setTimeOfDay(id)}>
                <Icon size={18} />
                <span>{l}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="hs-sec">
          <div className="hs-label">Rappel</div>
          <div className="hs-card">
            <div className="hs-row">
              <span className="hs-row-icon"><Bell size={16} /></span>
              <div className="hs-row-text">
                <b>Notification</b>
                <span>{reminderTime ? `Chaque jour prévu à ${reminderTime}` : 'Désactivée'}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(reminderTime)}
                aria-label="Activer le rappel"
                className={'hs-switch' + (reminderTime ? ' on' : '')}
                onClick={() => setReminderTime(reminderTime ? '' : '08:30')}
              >
                <span className="hs-switch-knob" />
              </button>
            </div>
            {reminderTime && (
              <div className="hs-card-more">
                <div className="hs-row">
                  <span className="hs-row-text"><b>Heure</b></span>
                  <input type="time" className="input hs-time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
                </div>
                <ChipScroll>
                  {['07:30', '08:30', '12:30', '18:00', '21:00', '22:30'].map((time) => (
                    <button key={time} type="button" className={'hs-pill' + (reminderTime === time ? ' solid on' : '')} onClick={() => setReminderTime(time)}>
                      {time}
                    </button>
                  ))}
                </ChipScroll>
              </div>
            )}
          </div>
        </section>

        <section className="hs-sec">
          <div className="hs-label">Objectif de série</div>
          <ChipScroll>
            <button type="button" className={'hs-pill' + (!streakGoal ? ' solid on' : '')} onClick={() => setStreakGoal(undefined)}>
              Aucun
            </button>
            {[7, 14, 21, 30, 60, 100].map((goal) => (
              <button key={goal} type="button" className={'hs-pill' + (streakGoal === goal ? ' solid on' : '')} onClick={() => setStreakGoal(goal)}>
                <Flame size={13} /> {goal} jours
              </button>
            ))}
          </ChipScroll>
        </section>

        {!isNew && currentHabit && (
          <section className="hs-sec">
            <div className="hs-label">Joker de série</div>
            <div className="hs-card">
              <div className="hs-row">
                <span className="hs-row-icon ice"><Snowflake size={16} /></span>
                <div className="hs-row-text">
                  <b>Joker pour aujourd’hui</b>
                  <span>Garde ta série si tu ne peux pas la faire.</span>
                </div>
                <button
                  type="button"
                  className={'btn small ' + (currentHabit.freezes?.includes(t) ? 'btn-primary' : 'btn-ghost')}
                  onClick={handleUseFreezeToday}
                >
                  {currentHabit.freezes?.includes(t) ? 'Actif ✓' : 'Activer'}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </Sheet>
  );
}
