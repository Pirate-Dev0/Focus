import { useMemo, useState } from 'react';
import { ArrowUpRight, Check as CheckIcon, Dumbbell, FolderKanban, Settings, Sprout, Target, Wallet } from 'lucide-react';
import { update, useAppState } from '../store';
import { go } from '../router';
import { Check, PriorityIcon, Progress, Sheet, Sparkline, Field, NumInput } from '../components/ui';
import { DueChip, TaskSheet } from '../components/TaskSheet';
import { SyncBadge } from '../App';
import { isConnected } from '../sync';
import {
  clamp, daysBetween, eur, fmtDate, greeting, habitDueOn, habitStreak, haptic, monthlySubs, mrrTotal, num, parseDate, prioRank, spentThisMonth, today, vintedStats
} from '../utils';

export default function Dashboard() {
  const s = useAppState();
  const t = today();
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [editGoal, setEditGoal] = useState(false);

  const mrr = mrrTotal(s);
  const goal = s.settings.goal;
  const pct = clamp(mrr / goal.target) * 100;
  const daysLeft = Math.max(0, daysBetween(t, goal.deadline));
  const monthsLeft = Math.max(1, daysLeft / 30.4);
  const perMonth = Math.max(0, (goal.target - mrr) / monthsLeft);

  const habitsToday = s.habits.filter((h) => !h.archived && habitDueOn(h, t));
  const habitsDone = habitsToday.filter((h) => h.done.includes(t)).length;

  const projectName = (id: string) => s.projects.find((p) => p.id === id)?.name || '';

  const todayTasks = useMemo(
    () =>
      s.tasks
        .filter((x) => x.status !== 'done' || (x.doneAt && new Date(x.doneAt).toDateString() === new Date().toDateString() && x.due && x.due <= t))
        .filter((x) => (x.due && x.due <= t) || (x.status === 'doing') || (x.priority === 'p0' && x.status !== 'done'))
        .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.due || '9').localeCompare(b.due || '9') || prioRank(a.priority) - prioRank(b.priority)),
    [s.tasks, t]
  );

  const upcoming = s.tasks
    .filter((x) => x.status !== 'done' && x.due && x.due > t && daysBetween(t, x.due) <= 7)
    .sort((a, b) => a.due!.localeCompare(b.due!));

  const lastWorkout = [...s.workouts].filter((w) => w.finishedAt).sort((a, b) => b.date.localeCompare(a.date))[0];
  const weight = s.bodyWeights[s.bodyWeights.length - 1];
  const weekAgo = s.bodyWeights.filter((b) => daysBetween(b.date, t) >= 7).slice(-1)[0];
  const workoutsMonth = s.workouts.filter((w) => w.finishedAt && w.date.startsWith(t.slice(0, 7))).length;

  const subs = monthlySubs(s);
  const vs = vintedStats(s.vinted);
  const activeProjects = s.projects.filter((p) => !p.archived && p.status !== 'termine');
  const openCount = (pid: string) => s.tasks.filter((x) => x.projectId === pid && x.status !== 'done').length;

  const toggleHabit = (id: string) => {
    haptic();
    update((d) => {
      const h = d.habits.find((x) => x.id === id)!;
      h.done = h.done.includes(t) ? h.done.filter((x) => x !== t) : [...h.done, t];
    });
  };
  const toggleTask = (id: string) => {
    haptic();
    update((d) => {
      const x = d.tasks.find((k) => k.id === id)!;
      x.status = x.status === 'done' ? 'todo' : 'done';
      x.doneAt = x.status === 'done' ? Date.now() : undefined;
    });
  };

  const dateLabel = parseDate(t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="faint small" style={{ textTransform: 'capitalize' }}>{dateLabel}</div>
          <h1 className="page-title">{greeting()} {s.settings.name}</h1>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <span className="hide-desktop"><SyncBadge /></span>
          <button className="icon-btn hide-desktop" onClick={() => go('settings')} aria-label="Réglages"><Settings size={18} /></button>
        </div>
      </div>

      {/* ---------- OBJECTIF PRINCIPAL ---------- */}
      <button className="hero card-click" onClick={() => setEditGoal(true)}>
        <svg className="hero-ring" width="220" height="220" viewBox="0 0 220 220"><circle cx="110" cy="110" r="90" fill="none" stroke="currentColor" strokeWidth="26" /></svg>
        <div className="label"><Target size={13} /> OBJECTIF PRINCIPAL</div>
        <div className="goal">{goal.title}</div>
        <div className="value">{eur(mrr)}<span>/ {eur(goal.target)}</span></div>
        <div className="bar"><div style={{ width: pct + '%' }} /></div>
        <div className="meta">
          <span><b>{num(pct)} %</b> atteint</span>
          <span><b>{daysLeft}</b> jours restants</span>
          <span>il faut <b>+{eur(perMonth)}</b>/mois</span>
        </div>
      </button>

      {/* ---------- AUJOURD'HUI ---------- */}
      <div className="section-title">
        <span>Aujourd'hui</span>
        <span className="faint">{habitsDone}/{habitsToday.length} habitudes</span>
      </div>
      {habitsToday.length > 0 && (
        <div className="habit-chips" style={{ marginBottom: 10 }}>
          {habitsToday.map((h) => {
            const on = h.done.includes(t);
            return (
              <button key={h.id} className={'habit-chip' + (on ? ' on' : '')} onClick={() => toggleHabit(h.id)}>
                <span className="dot">{on && <CheckIcon size={11} strokeWidth={3.2} />}</span>
                {h.name}
              </button>
            );
          })}
        </div>
      )}
      <div className="list">
        {todayTasks.length === 0 && <div className="list-empty">Rien d'urgent aujourd'hui. Profite pour avancer sur un gros sujet.</div>}
        {todayTasks.map((x) => (
          <button key={x.id} className="list-item" onClick={() => setOpenTask(x.id)}>
            <Check on={x.status === 'done'} onClick={() => toggleTask(x.id)} />
            <div className="grow">
              <div className="ellipsis" style={{ fontWeight: 500, textDecoration: x.status === 'done' ? 'line-through' : undefined, color: x.status === 'done' ? 'var(--text-3)' : undefined }}>{x.title}</div>
              <div className="faint small ellipsis">{projectName(x.projectId)}{x.status === 'doing' ? ' · En cours' : ''}</div>
            </div>
            <PriorityIcon p={x.priority} />
            <DueChip due={x.due} done={x.status === 'done'} />
          </button>
        ))}
      </div>
      {upcoming.length > 0 && (
        <>
          <div className="section-title"><span>Cette semaine<span className="count">{upcoming.length}</span></span></div>
          <div className="list">
            {upcoming.slice(0, 5).map((x) => (
              <button key={x.id} className="list-item" onClick={() => setOpenTask(x.id)}>
                <Check on={false} onClick={() => toggleTask(x.id)} />
                <div className="grow ellipsis" style={{ fontWeight: 500 }}>{x.title}</div>
                <span className="faint small">{projectName(x.projectId)}</span>
                <span className="chip">{fmtDate(x.due, { withDay: true })}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ---------- LES 3 GRANDS GROUPES ---------- */}
      <div className="section-title"><span>Vue d'ensemble</span></div>
      <div className="grid grid-3">
        <button className="card card-click group-card" onClick={() => go('life')}>
          <div className="row-between"><div className="gh"><span className="ico"><Sprout size={14} /></span>Life</div><ArrowUpRight size={15} className="faint" /></div>
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
            {activeProjects.filter((p) => p.name !== 'Général').slice(0, 4).map((p) => {
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

      {lastWorkout === undefined && s.workouts.length === 0 && (
        <button className="card card-click card-pad row" style={{ marginTop: 12, display: 'flex' }} onClick={() => go('life/salle')}>
          <Dumbbell size={16} /> <span className="grow">Démarre ta première séance pour suivre tes charges</span> <ArrowUpRight size={15} className="faint" />
        </button>
      )}

      {!isConnected() && (
        <button className="card card-click card-pad row" style={{ marginTop: 12, display: 'flex' }} onClick={() => go('settings')}>
          <span className="grow"><b style={{ fontWeight: 600 }}>Synchro désactivée</b><span className="faint small" style={{ display: 'block' }}>Connecte ton repo GitHub privé pour retrouver tes données sur tous tes appareils.</span></span>
          <ArrowUpRight size={15} className="faint" />
        </button>
      )}

      <TaskSheet taskId={openTask} onClose={() => setOpenTask(null)} />
      <GoalSheet open={editGoal} onClose={() => setEditGoal(false)} />
    </>
  );
}

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
