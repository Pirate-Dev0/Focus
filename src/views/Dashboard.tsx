import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronUp, Clock, Dumbbell, Eye, EyeOff, Flame, FolderKanban, Plus, Settings, SlidersHorizontal, Snowflake, Wallet, Zap } from 'lucide-react';
import { update, useAppState } from '../store';
import { go } from '../router';
import { Field, NumInput, Progress, Sheet, Sparkline } from '../components/ui';
import { TaskSheet } from '../components/TaskSheet';
import { TaskRow } from '../components/TaskRow';
import { HabitGlyph, habitGlyphKind } from '../components/habitIcons';
import { SyncBadge } from '../App';
import { isConnected } from '../sync';
import { addTaskFromText, moveTasksTo, setHabitProgress } from '../actions';
import type { Habit, HomeSection, State, TimeOfDay } from '../types';
import {
  addDays, clamp, dayShort, daysBetween, doneOn, eur, fmtDate, greeting, habitDueOn, habitStreak, haptic, isHabitDone, monthlySubs, mrrTotal, num,
  openTasksFor, parseDate, spentThisMonth, today, vintedStats
} from '../utils';

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const SECTION_LABEL: Record<HomeSection, string> = {
  tasks: 'Tâches du jour',
  habits: 'Habitudes',
  goal: 'Objectif principal',
  upcoming: 'À venir',
  overview: "Vue d'ensemble"
};
const swipeLearned = () => { try { return localStorage.getItem('focus.swipeLearned') === '1'; } catch { return false; } };
// L'objectif n'est plus dans la liste : il est fixé tout en haut, au-dessus des jours.
const DEFAULT_ORDER: HomeSection[] = ['tasks', 'habits', 'upcoming', 'overview'];

export function homeLayout(s: State) {
  const h = s.settings.home;
  const order = [...(h?.order || []).filter((x) => DEFAULT_ORDER.includes(x)), ...DEFAULT_ORDER.filter((x) => !h?.order?.includes(x))];
  return { order, hidden: h?.hidden || [] };
}

export default function Dashboard() {
  const s = useAppState();
  const t = today();
  const [day, setDay] = useState(t);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [editGoal, setEditGoal] = useState(false);
  const [custom, setCustom] = useState(false);
  const isToday = day === t;
  const { order, hidden } = homeLayout(s);

  const projectName = (id: string) => s.projects.find((p) => p.id === id)?.name || '';
  const habitsDue = s.habits.filter((h) => !h.archived && habitDueOn(h, day));
  const habitsDone = habitsDue.filter((h) => isHabitDone(h, day)).length;
  const open = useMemo(() => openTasksFor(s.tasks, day), [s.tasks, day]);
  const doneToday = s.tasks.filter((x) => doneOn(x, day));

  // anneau de la journée : tâches + habitudes
  const total = open.length + doneToday.length + habitsDue.length;
  const achieved = doneToday.length + habitsDone;

  const title = isToday ? "Aujourd'hui" : daysBetween(t, day) === 1 ? 'Demain' : parseDate(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' });
  // sous le titre : la date du jour affiché, ou l'écart quand le titre la donne déjà
  const gap = daysBetween(t, day);
  const dateLabel = isToday || gap === 1
    ? parseDate(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : gap > 0 ? `Dans ${gap} jours` : `Il y a ${-gap} jour${gap < -1 ? 's' : ''}`;

  const sections: Record<HomeSection, JSX.Element | null> = {
    tasks: <TasksSection key="tasks" day={day} open={open} done={doneToday} onOpen={setOpenTask} projectName={projectName} />,
    habits: habitsDue.length ? <HabitsSection key="habits" day={day} /> : null,
    goal: null,
    upcoming: isToday ? <UpcomingSection key="upcoming" onOpen={setOpenTask} projectName={projectName} /> : null,
    overview: <OverviewSection key="overview" />
  };

  return (
    <>
      {/* En-tête : salut + actions en haut, grand titre + anneau du jour, date en dessous */}
      <header className="today-head">
        <div className="today-top">
          <span className="today-kicker">{greeting()} {s.settings.name}</span>
          <span className="today-actions hide-desktop">
            <SyncBadge compact />
            <button className="icon-btn" onClick={() => go('settings')} aria-label="Réglages"><Settings size={19} /></button>
          </span>
        </div>
        <div className="today-main">
          <div className="grow">
            <h1 className="page-title" style={{ textTransform: 'capitalize' }}>{title}</h1>
            <div className="today-date">{dateLabel}</div>
          </div>
          <DayRing value={achieved} total={total} />
        </div>
      </header>

      <GoalHero onEdit={() => setEditGoal(true)} />

      <DayStrip day={day} onPick={(d) => { haptic(); setDay(d); }} />

      {order.filter((k) => !hidden.includes(k)).map((k) => sections[k])}

      {!isConnected() && (
        <button className="card card-click card-pad row" style={{ marginTop: 18, display: 'flex' }} onClick={() => go('settings')}>
          <span className="grow"><b style={{ fontWeight: 600 }}>Synchro désactivée</b><span className="faint small" style={{ display: 'block' }}>Connecte ton repo GitHub privé pour retrouver tes données sur tous tes appareils.</span></span>
          <ArrowUpRight size={15} className="faint" />
        </button>
      )}

      <button className="btn btn-ghost customize-btn" onClick={() => setCustom(true)}><SlidersHorizontal size={14} /> Personnaliser l'accueil</button>

      <TaskSheet taskId={openTask} onClose={() => setOpenTask(null)} />
      <GoalSheet open={editGoal} onClose={() => setEditGoal(false)} />
      <HomeSheet open={custom} onClose={() => setCustom(false)} />
    </>
  );
}

/* ---------- Anneau de progression du jour ---------- */
function DayRing({ value, total }: { value: number; total: number }) {
  const pct = total ? clamp(value / total) : 0;
  const r = 17, c = 2 * Math.PI * r;
  return (
    <div className={'day-ring' + (total && value >= total ? ' full' : '')} title={`${value}/${total} faits aujourd'hui`}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--track)" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeOpacity={pct ? 1 : 0} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 22 22)" style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <span>{value}/{total}</span>
    </div>
  );
}

/* ---------- Bande des 7 jours ---------- */
function DayStrip({ day, onPick }: { day: string; onPick: (d: string) => void }) {
  const s = useAppState();
  const t = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, i));
  return (
    <div className="day-strip" role="tablist">
      {days.map((d) => {
        const n = openTasksFor(s.tasks, d).length;
        // journée bouclée : tout ce qui était prévu (habitudes + tâches) est fait
        const habits = s.habits.filter((h) => !h.archived && habitDueOn(h, d));
        const total = n + habits.length + s.tasks.filter((x) => doneOn(x, d)).length;
        const achieved = habits.filter((h) => isHabitDone(h, d)).length + s.tasks.filter((x) => doneOn(x, d)).length;
        const complete = total > 0 && achieved === total;
        const wd = parseDate(d).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
        return (
          <button
            key={d}
            role="tab"
            aria-selected={d === day}
            aria-label={`${dayShort(d)} ${parseDate(d).getDate()}${complete ? ', journée terminée' : n ? `, ${n} tâche${n > 1 ? 's' : ''}` : ''}`}
            className={'ds' + (d === day ? ' on' : '') + (d === t ? ' is-today' : '') + (complete ? ' done' : '')}
            onClick={() => onPick(d)}
          >
            <span className="ds-wd">{wd}</span>
            <span className="ds-dot">
              {complete
                ? <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                : parseDate(d).getDate()}
            </span>
            <span className="ds-dots">{Array.from({ length: Math.min(n, 3) }, (_, i) => <i key={i} />)}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Tâches ---------- */
function TasksSection({ day, open, done, onOpen, projectName }: { day: string; open: ReturnType<typeof openTasksFor>; done: State['tasks']; onOpen: (id: string) => void; projectName: (id: string) => string }) {
  const t = today();
  const [showDone, setShowDone] = useState(false);
  const late = day === t ? open.filter((x) => x.due && x.due < t) : [];
  const main = open.filter((x) => !late.includes(x));
  return (
    <section className="home-section">
      <div className="section-title">
        <span>Tâches<span className="count">{open.length}</span></span>
        {late.length > 0 && (
          <button className="link-btn" onClick={() => moveTasksTo(late.map((x) => x.id), t)}>Tout pour aujourd'hui <ArrowRight size={12} /></button>
        )}
      </div>

      {late.length > 0 && (
        <>
          <div className="sub-label danger-text">En retard · {late.length}</div>
          <div className="list" style={{ marginBottom: 10 }}>
            {late.map((x) => <TaskRow key={x.id} task={x} project={projectName(x.projectId)} onOpen={() => onOpen(x.id)} day={day} />)}
          </div>
        </>
      )}

      <div className="list">
        {main.map((x) => <TaskRow key={x.id} task={x} project={projectName(x.projectId)} onOpen={() => onOpen(x.id)} day={day} />)}
        {main.length === 0 && late.length === 0 && (
          <div className="list-empty">{done.length ? 'Tout est fait. Belle journée 🔥' : day === t ? 'Rien de prévu. Ajoute ce qui compte aujourd’hui ↓' : 'Rien de prévu ce jour-là.'}</div>
        )}
        <InlineAdd day={day} />
      </div>

      {done.length > 0 && (
        <>
          <button className="sub-label done-toggle" onClick={() => setShowDone(!showDone)}>
            {done.length} terminée{done.length > 1 ? 's' : ''} {showDone ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showDone && (
            <div className="list">
              {done.map((x) => <TaskRow key={x.id} task={x} project={projectName(x.projectId)} onOpen={() => onOpen(x.id)} day={day} />)}
            </div>
          )}
        </>
      )}
      {open.length > 0 && !swipeLearned() && <p className="swipe-hint hide-desktop">Glisse → pour terminer, ← pour reporter à demain</p>}
    </section>
  );
}

function InlineAdd({ day }: { day: string }) {
  const [v, setV] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const submit = () => {
    if (!v.trim()) return;
    addTaskFromText(v, { due: day });
    haptic();
    setV('');
    ref.current?.focus();
  };
  return (
    <form className="inline-add" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Plus size={18} />
      <input
        ref={ref}
        className="input-bare"
        placeholder={`Ajouter pour ${fmtDate(day).toLowerCase()}…  #projet`}
        value={v}
        onChange={(e) => setV(e.target.value)}
        enterKeyHint="done"
        autoCapitalize="sentences"
      />
      {v.trim() && <button type="submit" className="btn btn-primary" style={{ height: 30 }}>OK</button>}
    </form>
  );
}

/* ---------- Habitudes ---------- */
const SLOT_LABEL: Record<TimeOfDay, string> = { any: '', morning: 'Le matin', afternoon: 'L’après-midi', evening: 'Le soir' };

function HabitsSection({ day }: { day: string }) {
  const s = useAppState();
  const t = today();
  const future = day > t;
  const [filterSlot, setFilterSlot] = useState<TimeOfDay | 'all'>('all');
  const allHabitsDue = s.habits.filter((h) => !h.archived && habitDueOn(h, day));
  const doneCount = allHabitsDue.filter((h) => isHabitDone(h, day)).length;

  const hasSlots = allHabitsDue.some((h) => h.timeOfDay && h.timeOfDay !== 'any');
  const habits = filterSlot === 'all'
    ? allHabitsDue
    : allHabitsDue.filter((h) => h.timeOfDay === filterSlot);

  const toggle = (h: Habit) => {
    if (future) return;
    haptic();
    setHabitProgress(h.id, day, 'toggle');
  };

  const addStep = (h: Habit) => {
    if (future) return;
    haptic();
    setHabitProgress(h.id, day, h.step || 1);
  };

  return (
    <section className="home-section">
      <div className="section-title">
        <span>Habitudes<span className="count">{doneCount}/{allHabitsDue.length}</span></span>
        <button className="link-btn" onClick={() => go('life')}>Semaine <ArrowRight size={12} /></button>
      </div>

      {hasSlots && (
        <div className="row" style={{ gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 2 }}>
          {[
            { id: 'all', l: 'Toutes' },
            { id: 'morning', l: 'Matin ☀️' },
            { id: 'afternoon', l: 'Après-midi 🌤️' },
            { id: 'evening', l: 'Soir 🌙' }
          ].map((slot) => (
            <button
              key={slot.id}
              className={'chip chip-xs' + (filterSlot === slot.id ? ' solid' : '')}
              onClick={() => setFilterSlot(slot.id as any)}
            >
              {slot.l}
            </button>
          ))}
        </div>
      )}

      <div className="habit-grid">
        {habits.map((h) => {
          const on = isHabitDone(h, day);
          const frozen = h.freezes?.includes(day);
          const streak = habitStreak(h);
          const curVal = h.values?.[day] ?? 0;
          const target = h.targetValue || 1;
          const isNumeric = h.kind === 'numeric';
          const num = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
          const sub = isNumeric
            ? `${num(curVal)} / ${num(target)} ${h.unit || ''}`.trim()
            : frozen
              ? 'Joker actif'
              : h.reminderTime
                ? `Rappel à ${h.reminderTime}`
                : h.timeOfDay && h.timeOfDay !== 'any'
                  ? SLOT_LABEL[h.timeOfDay]
                  : '';

          return (
            <div
              key={h.id}
              className={'habit-tile' + (on ? ' on' : '') + (frozen ? ' frozen' : '')}
              style={{ cursor: future ? 'default' : 'pointer', '--c': h.color || '#3b82f6' } as CSSProperties}
              onClick={() => toggle(h)}
              role="button"
              tabIndex={0}
              aria-pressed={on}
            >
              <span className={'ht-emoji ' + habitGlyphKind(h)}><HabitGlyph h={h} size={21} /></span>

              <div className="ht-main">
                <div className="ht-name">{h.name}</div>
                {sub && (
                  <div className="ht-sub">
                    {h.reminderTime && !isNumeric && !frozen && <Clock size={11} />}
                    {sub}
                  </div>
                )}
                {isNumeric && (
                  <div className="ht-bar"><i style={{ width: `${Math.min(100, (curVal / target) * 100)}%` }} /></div>
                )}
              </div>

              {isNumeric && !on && !future && (
                <button
                  type="button"
                  className="ht-step"
                  onClick={(e) => {
                    e.stopPropagation();
                    addStep(h);
                  }}
                  title={`Ajouter +${h.step || 1}`}
                >
                  +{num(h.step || 1)}
                </button>
              )}
              {streak > 1 && (
                <span className="ht-streak" title={`${streak} jours consécutifs`}>
                  <Flame size={12} />{streak}
                </span>
              )}

              <button
                type="button"
                className="ht-check"
                disabled={future}
                aria-label={on ? 'Marquer comme non faite' : 'Marquer comme faite'}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(h);
                }}
              >
                {on ? (
                  <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : frozen ? (
                  <Snowflake size={13} color="#38bdf8" />
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Objectif principal : en tête de l'accueil, c'est la motivation ---------- */
const MILESTONES = [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1]; // paliers intermédiaires (en part de la cible)

function GoalHero({ onEdit }: { onEdit: () => void }) {
  const s = useAppState();
  const t = today();
  const goal = s.settings.goal;
  const mrr = mrrTotal(s);
  const target = Math.max(1, goal.target);
  const pct = clamp(mrr / target) * 100;
  const reached = mrr >= target;
  const daysLeft = Math.max(0, daysBetween(t, goal.deadline));
  const perMonth = Math.max(0, (target - mrr) / Math.max(1, daysLeft / 30.4));
  const next = MILESTONES.map((f) => Math.round(target * f)).find((m) => m > mrr) ?? target;
  return (
    <button className={'goal-hero' + (reached ? ' reached' : '')} onClick={onEdit} aria-label={`${goal.title} : ${num(pct)} %. Modifier l'objectif`}>
      {/* Carte « dossier » : visuel flou en haut, onglet sombre qui le recouvre */}
      <span className="gh-shell">
        <span className="gh-art" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
        <span className="gh-corner">
          {reached ? 'Objectif' : 'Prochain palier'}<br />{reached ? 'atteint 🎉' : eur(next)}
        </span>
        <span className="gh-folder">
          <span className="gh-tab" aria-hidden="true">
            <svg className="gh-notch" viewBox="0 0 46 27" preserveAspectRatio="none"><path d="M0 0C10 0 15 4 20 12C25 21 30 26 40 26H46V27H0Z" /></svg>
          </span>
          <span className="gh-head">
            <span className="gh-title">{goal.title}</span>
            <span className="gh-sub">{reached ? `${num(pct)} % · bravo !` : `${num(pct)} % · +${eur(perMonth)} / mois`}</span>
          </span>
          <span className="gh-bar" aria-hidden="true">
            {[25, 50, 75].map((m) => <i key={m} className="gh-tick" style={{ left: m + '%' }} />)}
            <i className="gh-fill" style={{ width: pct + '%' }}><i className="gh-knob" /></i>
          </span>
          <span className="gh-foot">
            <span className="gh-value">
              <span className="gh-num">{eur(mrr)}</span>
              <span className="gh-of">/ {eur(target)}</span>
            </span>
            <span className="gh-days">{num(daysLeft)} {daysLeft > 1 ? 'jours' : 'jour'}</span>
          </span>
        </span>
      </span>
    </button>
  );
}

/* ---------- À venir (14 jours) ---------- */
function UpcomingSection({ onOpen, projectName }: { onOpen: (id: string) => void; projectName: (id: string) => string }) {
  const s = useAppState();
  const t = today();
  const items = s.tasks
    .filter((x) => x.status !== 'done' && x.due && x.due > t && daysBetween(t, x.due) <= 14)
    .sort((a, b) => a.due!.localeCompare(b.due!));
  if (!items.length) return null;
  const groups = items.slice(0, 12).reduce<Record<string, typeof items>>((acc, x) => ((acc[x.due!] ||= []).push(x), acc), {});
  return (
    <section className="home-section">
      <div className="section-title"><span>À venir<span className="count">{items.length}</span></span></div>
      {Object.entries(groups).map(([d, xs]) => (
        <div key={d} style={{ marginBottom: 10 }}>
          <div className="sub-label">{cap(fmtDate(d, { withDay: true }))}</div>
          <div className="list">
            {xs.map((x) => <TaskRow key={x.id} task={x} project={projectName(x.projectId)} onOpen={() => onOpen(x.id)} day={d} />)}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ---------- Vue d'ensemble (carrousel sur iPhone) ---------- */
function OverviewSection() {
  const s = useAppState();
  const t = today();
  const mrr = mrrTotal(s);
  const subs = monthlySubs(s);
  const vs = vintedStats(s.vinted);
  const habitsToday = s.habits.filter((h) => !h.archived && habitDueOn(h, t));
  const habitsDone = habitsToday.filter((h) => h.done.includes(t)).length;
  const lastWorkout = [...s.workouts].filter((w) => w.finishedAt).sort((a, b) => b.date.localeCompare(a.date))[0];
  const weight = s.bodyWeights[s.bodyWeights.length - 1];
  const weekAgo = s.bodyWeights.filter((b) => daysBetween(b.date, t) >= 7).slice(-1)[0];
  const workoutsMonth = s.workouts.filter((w) => w.finishedAt && w.date.startsWith(t.slice(0, 7))).length;
  const activeProjects = s.projects.filter((p) => !p.archived && p.status !== 'termine' && p.name !== 'Général');
  const openCount = (pid: string) => s.tasks.filter((x) => x.projectId === pid && x.status !== 'done').length;

  return (
    <section className="home-section">
      <div className="section-title"><span>Vue d'ensemble</span></div>
      <div className="carousel">
        <button className="card card-click group-card" onClick={() => go('life')}>
          <div className="row-between"><div className="gh"><span className="ico"><Zap size={14} /></span>Life</div><ArrowUpRight size={15} className="faint" /></div>
          <div>
            <div className="row-between small"><span className="muted">Habitudes du jour</span><span className="mono">{habitsDone}/{habitsToday.length}</span></div>
            <div style={{ marginTop: 6 }}><Progress value={habitsDone} max={habitsToday.length || 1} /></div>
          </div>
          <div>
            <div className="kv"><span>Meilleure série</span><span>{Math.max(0, ...s.habits.filter((h) => !h.archived).map(habitStreak))} j</span></div>
            <div className="kv"><span>Séances ce mois</span><span>{workoutsMonth}</span></div>
            <div className="kv"><span>Dernière séance</span><span>{lastWorkout ? `${lastWorkout.name} · ${fmtDate(lastWorkout.date)}` : '—'}</span></div>
            <div className="kv"><span>Poids</span><span>{weight ? `${num(weight.kg)} kg${weekAgo ? ` (${weight.kg - weekAgo.kg >= 0 ? '+' : ''}${num(weight.kg - weekAgo.kg)})` : ''}` : '—'}</span></div>
          </div>
        </button>

        <button className="card card-click group-card" onClick={() => go('wallet')}>
          <div className="row-between"><div className="gh"><span className="ico"><Wallet size={14} /></span>Portefeuille</div><ArrowUpRight size={15} className="faint" /></div>
          <div className="row-between" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="faint small">MRR</div>
              <div className="big-num" style={{ fontSize: 26 }}>{eur(mrr)}</div>
            </div>
            <div className="faint"><Sparkline data={s.mrrHistory.map((m) => m.total)} width={90} height={30} /></div>
          </div>
          <div>
            <div className="kv"><span>Abonnements / mois</span><span>{subs ? '−' : ''}{eur(subs)}</span></div>
            <div className="kv"><span>Net mensuel</span><span>{eur(mrr - subs)}</span></div>
            <div className="kv"><span>Dépensé ce mois</span><span>{eur(spentThisMonth(s))}</span></div>
            <div className="kv"><span>Solde Vinted</span><span>{eur(vs.balance)}</span></div>
          </div>
        </button>

        <button className="card card-click group-card" onClick={() => go('projects')}>
          <div className="row-between"><div className="gh"><span className="ico"><FolderKanban size={14} /></span>Projets</div><ArrowUpRight size={15} className="faint" /></div>
          <div className="stack gap-12">
            {activeProjects.slice(0, 4).map((p) => {
              const cur = p.gauge.mode === 'mrr' ? p.mrr : p.gauge.current;
              return (
                <div key={p.id}>
                  <div className="row-between small" style={{ marginBottom: 5 }}>
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    <span className="faint mono">{openCount(p.id)} tâche{openCount(p.id) > 1 ? 's' : ''}</span>
                  </div>
                  <Progress value={cur} max={p.gauge.target} />
                </div>
              );
            })}
          </div>
        </button>
      </div>
      {!lastWorkout && s.workouts.length === 0 && (
        <button className="card card-click card-pad row" style={{ marginTop: 12, display: 'flex' }} onClick={() => go('life/salle')}>
          <Dumbbell size={16} /> <span className="grow">Démarre ta première séance pour suivre tes charges</span> <ArrowUpRight size={15} className="faint" />
        </button>
      )}
    </section>
  );
}

/* ---------- Réglages de l'objectif ---------- */
function GoalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useAppState();
  const g = s.settings.goal;
  const setG = (fn: (g: typeof s.settings.goal) => void) => update((d) => fn(d.settings.goal));
  return (
    <Sheet open={open} onClose={onClose} title="Objectif principal">
      <p className="muted small" style={{ marginTop: 0 }}>
        La jauge se calcule toute seule : c'est la somme du MRR des projets qui comptent dans l'objectif (Portefeuille → Revenus).
      </p>
      <Field label="Intitulé"><input className="input" value={g.title} onChange={(e) => setG((x) => (x.title = e.target.value))} /></Field>
      <div className="field-row">
        <Field label="Cible (€ / mois)"><NumInput value={g.target} onChange={(n) => setG((x) => (x.target = n || 1))} /></Field>
        <Field label="Date limite"><input type="date" className="input" value={g.deadline} onChange={(e) => setG((x) => (x.deadline = e.target.value))} /></Field>
      </div>
      <button className="btn btn-block btn-lg" onClick={() => { onClose(); go('wallet'); }}>Mettre à jour mon MRR</button>
    </Sheet>
  );
}

/* ---------- Personnaliser l'accueil ---------- */
export function HomeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useAppState();
  const { order, hidden } = homeLayout(s);
  const save = (o: HomeSection[], h: HomeSection[]) => update((d) => { d.settings.home = { order: o, hidden: h }; });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const o = [...order];
    [o[i], o[j]] = [o[j], o[i]];
    haptic();
    save(o, hidden);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Personnaliser l'accueil">
      <p className="muted small" style={{ marginTop: 0 }}>Choisis ce qui s'affiche sous la bande des jours, et dans quel ordre.</p>
      <div className="list">
        {order.map((k, i) => {
          const off = hidden.includes(k);
          return (
            <div key={k} className="list-item" style={{ opacity: off ? 0.5 : 1 }}>
              <button className="icon-btn" aria-label={off ? 'Afficher' : 'Masquer'} onClick={() => { haptic(); save(order, off ? hidden.filter((x) => x !== k) : [...hidden, k]); }}>
                {off ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
              <span className="grow" style={{ fontWeight: 500 }}>{SECTION_LABEL[k]}</span>
              <button className="icon-btn" disabled={i === 0} style={{ opacity: i === 0 ? 0.25 : 1 }} onClick={() => move(i, -1)} aria-label="Monter"><ChevronUp size={18} /></button>
              <button className="icon-btn" disabled={i === order.length - 1} style={{ opacity: i === order.length - 1 ? 0.25 : 1 }} onClick={() => move(i, 1)} aria-label="Descendre"><ChevronDown size={18} /></button>
            </div>
          );
        })}
      </div>
      <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => save(DEFAULT_ORDER, [])}>Réinitialiser</button>
    </Sheet>
  );
}
