import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronRight, Dumbbell, Play, Plus, Trash2, Trophy, X, Scale, Flame, Timer, TrendingUp, TrendingDown, Zap, type LucideIcon } from 'lucide-react';
import { getState, update, useAppState } from '../store';
import { Empty, Field, NumInput, Segmented, Sheet, Sparkline, toast } from '../components/ui';
import type { State, Workout } from '../types';
import { addDays, DAYS_SHORT, daysBetween, est1RM, fmtDate, haptic, num, parseDate, today, uid } from '../utils';

/* ---------- Couleurs (mêmes teintes que Habitudes / Portefeuille) ---------- */
const PALETTE = ['#3b82f6', '#c026d3', '#14b8a6', '#f97316', '#ec4899', '#22c55e', '#6366f1', '#ef4444'];
const colorOf = (key: string) => {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
};
const GROUP_COLORS: Record<string, string> = {
  Pecs: '#ef4444', Dos: '#3b82f6', Épaules: '#f97316', Biceps: '#c026d3', Triceps: '#ec4899',
  Jambes: '#22c55e', Abdos: '#14b8a6', Cardio: '#0ea5e9', Autre: '#8b8b94'
};
const groupColor = (g: string) => GROUP_COLORS[g] || '#8b8b94';
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lundi → dimanche

/** Pastille carrée teintée : icône ou initiale (même rendu que le Portefeuille) */
function Tile({ Icon, color, children }: { Icon?: LucideIcon; color: string; children?: ReactNode }) {
  return (
    <span className="w-tile" style={{ '--c': color } as CSSProperties} aria-hidden="true">
      {Icon ? <Icon size={18} strokeWidth={2.1} /> : children}
    </span>
  );
}

function lastSetsFor(s: State, exerciseId: string, excludeId?: string) {
  const ws = s.workouts
    .filter((w) => w.id !== excludeId && w.finishedAt)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.startedAt - a.startedAt));
  for (const w of ws) {
    const e = w.entries.find((x) => x.exerciseId === exerciseId && x.sets.length);
    if (e) return { date: w.date, sets: e.sets };
  }
  return null;
}

function exerciseHistory(s: State, exerciseId: string) {
  return s.workouts
    .filter((w) => w.finishedAt)
    .map((w) => {
      const e = w.entries.find((x) => x.exerciseId === exerciseId);
      if (!e || !e.sets.length) return null;
      const top = Math.max(...e.sets.map((x) => x.w));
      const best1rm = Math.max(...e.sets.map((x) => est1RM(x.w, x.r)));
      const volume = e.sets.reduce((a, x) => a + x.w * x.r, 0);
      return { date: w.date, top, best1rm, volume, sets: e.sets };
    })
    .filter(Boolean)
    .sort((a, b) => a!.date.localeCompare(b!.date)) as { date: string; top: number; best1rm: number; volume: number; sets: { w: number; r: number }[] }[];
}

export default function Gym() {
  const s = useAppState();
  const t = today();
  const [tab, setTab] = useState<'historique' | 'progression' | 'programmes'>('historique');
  const [openWorkout, setOpenWorkout] = useState<string | null>(null);
  const [openEx, setOpenEx] = useState<string | null>(null);
  const [openRoutine, setOpenRoutine] = useState<string | null>(null);
  const [weightSheet, setWeightSheet] = useState(false);

  const active = s.workouts.find((w) => !w.finishedAt);
  const finished = s.workouts.filter((w) => w.finishedAt).sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt);
  const monthCount = finished.filter((w) => w.date.startsWith(t.slice(0, 7))).length;
  const weekCount = finished.filter((w) => daysBetween(w.date, t) < 7).length;
  const weight = s.bodyWeights[s.bodyWeights.length - 1];
  const firstWeight = s.bodyWeights[0];
  const wDiff = weight && firstWeight ? weight.kg - firstWeight.kg : 0;

  // semaine en cours (lundi → dimanche) : jours où une séance a été faite
  const dow = (parseDate(t).getDay() + 6) % 7;
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - dow));
  const doneDays = new Set(finished.map((w) => w.date));
  const weekTrained = week.filter((d) => doneDays.has(d)).length;

  const routineColor = (id?: string) => (id ? colorOf(id) : '#8b8b94');
  const activeColor = routineColor(active?.routineId);
  const activeSets = active ? active.entries.reduce((a, e) => a + e.sets.length, 0) : 0;
  const activeMin = active ? Math.max(0, Math.round((Date.now() - active.startedAt) / 60000)) : 0;

  const start = (routineId?: string) => {
    if (active) return setOpenWorkout(active.id);
    const st = getState();
    const r = st.routines.find((x) => x.id === routineId);
    const id = uid();
    update((d) => {
      d.workouts.push({
        id,
        date: today(),
        name: r?.name || 'Séance libre',
        routineId,
        startedAt: Date.now(),
        entries: (r?.exerciseIds || []).map((exerciseId) => {
          const last = lastSetsFor(st, exerciseId);
          return { exerciseId, sets: last ? last.sets.map((x) => ({ ...x })) : [{ w: 0, r: 10 }] };
        })
      });
    });
    haptic();
    setOpenWorkout(id);
  };

  const exName = (id: string) => s.exercises.find((e) => e.id === id)?.name || '?';

  return (
    <>
      {/* ---------- En-tête : stats + semaine ---------- */}
      <div className="hb-head card gy-head">
        <div className="hb-title">Ma salle</div>
        <div className="hb-sub">Charges pré-remplies, progression suivie.</div>
        <div className="hb-stats">
          <div>
            <div className="hb-num" style={{ color: '#3b82f6' }}>{weekCount}</div>
            <div className="hb-lbl">Cette semaine</div>
          </div>
          <div>
            <div className="hb-num" style={{ color: '#22c55e' }}>{monthCount}</div>
            <div className="hb-lbl">Ce mois</div>
          </div>
          <div>
            <div className="hb-num" style={{ color: '#c026d3' }}>{finished.length}</div>
            <div className="hb-lbl">Au total</div>
          </div>
        </div>
        <div className="gy-week" aria-label={`${weekTrained} jour${weekTrained > 1 ? 's' : ''} d'entraînement cette semaine`}>
          {week.map((d, i) => {
            const on = doneDays.has(d);
            return (
              <div key={d} className={'gy-wd' + (on ? ' on' : '') + (d === t ? ' today' : '') + (d > t ? ' future' : '')}>
                <span className="gy-wd-dot">{on ? <Dumbbell size={12} strokeWidth={2.6} /> : null}</span>
                <span className="gy-wd-l">{DAYS_SHORT[WEEK_ORDER[i]]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- Poids de corps ---------- */}
      <button className="card card-click gy-weight" onClick={() => setWeightSheet(true)}>
        <Tile Icon={Scale} color="#14b8a6" />
        <div className="grow w-row-main">
          <div className="w-row-sub">Poids de corps</div>
          <div className="gy-weight-v">
            {weight ? num(weight.kg) : '—'}<small> kg</small>
            {weight && firstWeight && weight !== firstWeight && (
              <span className="w-delta">
                {wDiff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {wDiff >= 0 ? '+' : '−'}{num(Math.abs(wDiff))} kg
              </span>
            )}
          </div>
          {!weight && <div className="w-row-sub">Touche pour noter</div>}
        </div>
        {s.bodyWeights.length >= 2 && <span className="gy-weight-spark"><Sparkline data={s.bodyWeights.slice(-20).map((b) => b.kg)} width={72} height={30} /></span>}
        <ChevronRight size={17} className="faint" />
      </button>

      {/* ---------- Séance en cours / démarrer ---------- */}
      {active ? (
        <button className="gy-live" style={{ '--c': activeColor } as CSSProperties} onClick={() => setOpenWorkout(active.id)}>
          <div className="gy-live-top">
            <span className="gy-live-badge"><i /> Séance en cours</span>
            <span className="gy-live-time"><Timer size={13} /> {activeMin} min</span>
          </div>
          <div className="gy-live-name ellipsis">{active.name}</div>
          <div className="gy-live-meta">
            <span><Dumbbell size={13} /> {active.entries.length} exercice{active.entries.length > 1 ? 's' : ''}</span>
            <span><Zap size={13} /> {activeSets} série{activeSets > 1 ? 's' : ''}</span>
          </div>
          <span className="gy-live-cta"><Play size={14} fill="currentColor" /> Reprendre la séance</span>
        </button>
      ) : (
        <>
          <div className="section-title"><span>Démarrer une séance</span><span className="faint">charges pré-remplies</span></div>
          <div className="list">
            {s.routines.map((r) => {
              const c = routineColor(r.id);
              return (
                <button key={r.id} className="list-item w-row" onClick={() => start(r.id)}>
                  <Tile Icon={Dumbbell} color={c} />
                  <div className="grow w-row-main">
                    <div className="w-row-name ellipsis">{r.name}</div>
                    <div className="w-row-sub ellipsis">{r.exerciseIds.length} exercice{r.exerciseIds.length > 1 ? 's' : ''}{r.exerciseIds.length ? ' · ' + r.exerciseIds.map(exName).join(' · ') : ''}</div>
                  </div>
                  <span className="gy-play" style={{ '--c': c } as CSSProperties}><Play size={14} fill="currentColor" /></span>
                </button>
              );
            })}
            <button className="list-item w-row" onClick={() => start()}>
              <Tile Icon={Plus} color="#8b8b94" />
              <div className="grow w-row-main">
                <div className="w-row-name">Séance libre</div>
                <div className="w-row-sub">Ajoute tes exercices au fur et à mesure</div>
              </div>
              <span className="gy-play" style={{ '--c': '#8b8b94' } as CSSProperties}><Play size={14} fill="currentColor" /></span>
            </button>
          </div>
        </>
      )}

      <div className="gy-tabs">
        <Segmented full value={tab} onChange={setTab} options={[{ value: 'historique', label: 'Historique' }, { value: 'progression', label: 'Progression' }, { value: 'programmes', label: 'Programmes' }]} />
      </div>

      {tab === 'historique' && (
        <div className="list">
          {finished.length === 0 && <Empty title="Aucune séance">Lance un programme au-dessus : tes charges de la dernière fois seront pré-remplies.</Empty>}
          {finished.slice(0, 40).map((w) => {
            const vol = w.entries.reduce((a, e) => a + e.sets.reduce((b, x) => b + x.w * x.r, 0), 0);
            const sets = w.entries.reduce((a, e) => a + e.sets.length, 0);
            const min = w.finishedAt ? Math.max(1, Math.round((w.finishedAt - w.startedAt) / 60000)) : 0;
            return (
              <button key={w.id} className="list-item w-row" onClick={() => setOpenWorkout(w.id)}>
                <Tile Icon={Dumbbell} color={routineColor(w.routineId)} />
                <div className="grow w-row-main">
                  <div className="w-row-name ellipsis">{w.name}</div>
                  <div className="w-row-sub ellipsis">{w.entries.length} exos · {sets} séries{min ? ` · ${min} min` : ''}</div>
                </div>
                <div className="w-row-end">
                  <span className="w-amt">{num(vol / 1000)} t</span>
                  <span className="w-amt-sub">{fmtDate(w.date)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {tab === 'progression' && <Progression onOpen={setOpenEx} />}

      {tab === 'programmes' && (
        <>
          <div className="list">
            {s.routines.length === 0 && <div className="list-empty">Crée ton premier programme : tes séances démarreront en un geste.</div>}
            {s.routines.map((r) => (
              <button key={r.id} className="list-item w-row" onClick={() => setOpenRoutine(r.id)}>
                <Tile color={routineColor(r.id)}>{r.name.trim().charAt(0).toUpperCase() || '?'}</Tile>
                <div className="grow w-row-main">
                  <div className="w-row-name ellipsis">{r.name}</div>
                  <div className="w-row-sub ellipsis">{r.exerciseIds.map(exName).join(' · ') || 'Aucun exercice'}</div>
                </div>
                <span className="gy-count">{r.exerciseIds.length}<small> exos</small></span>
                <ChevronRight size={16} className="faint" />
              </button>
            ))}
          </div>
          <button className="hb-new card gy-new" onClick={() => { const nid = uid(); update((d) => { d.routines.push({ id: nid, name: 'Nouveau programme', exerciseIds: [] }); }); setOpenRoutine(nid); }}>
            <span className="hb-new-ic"><Plus size={14} strokeWidth={2.8} /></span>
            <span className="grow">Nouveau programme</span>
            <ChevronRight size={17} color="var(--text-3)" />
          </button>
        </>
      )}

      {openWorkout && <WorkoutSheet id={openWorkout} onClose={() => setOpenWorkout(null)} />}
      {openEx && <ExerciseSheet id={openEx} onClose={() => setOpenEx(null)} />}
      {openRoutine && <RoutineSheet id={openRoutine} onClose={() => setOpenRoutine(null)} />}
      <WeightSheet open={weightSheet} onClose={() => setWeightSheet(false)} />
    </>
  );
}

function Progression({ onOpen }: { onOpen: (id: string) => void }) {
  const s = useAppState();
  const rows = useMemo(
    () =>
      s.exercises
        .map((e) => ({ e, h: exerciseHistory(s, e.id) }))
        .filter((x) => x.h.length)
        .sort((a, b) => b.h[b.h.length - 1].date.localeCompare(a.h[a.h.length - 1].date)),
    [s.workouts, s.exercises]
  );
  if (!rows.length) return <div className="list"><Empty title="Pas encore de données">Ta progression par exercice apparaîtra après ta première séance.</Empty></div>;
  return (
    <div className="list">
      {rows.map(({ e, h }) => {
        const last = h[h.length - 1];
        const first = h[0];
        const diff = last.top - first.top;
        const c = groupColor(e.group);
        const isPR = h.length > 1 && last.top >= Math.max(...h.map((x) => x.top)) && diff > 0;
        return (
          <button key={e.id} className="list-item w-row" onClick={() => onOpen(e.id)}>
            <Tile color={c}>{e.group.charAt(0).toUpperCase()}</Tile>
            <div className="grow w-row-main">
              <div className="w-row-name ellipsis">{e.name}</div>
              <div className="w-row-sub ellipsis">{e.group} · {h.length} séance{h.length > 1 ? 's' : ''}{isPR ? <> · <Flame size={11} color="#f97316" style={{ verticalAlign: -1 }} /> record</> : null}</div>
            </div>
            <span className="gy-spark" style={{ color: c }}><Sparkline data={h.slice(-12).map((x) => x.top)} width={52} height={22} fill={false} /></span>
            <div className="w-row-end" style={{ minWidth: 58 }}>
              <span className="w-amt">{num(last.top)} kg</span>
              <span className={'w-amt-sub' + (diff > 0 ? ' w-pos' : diff < 0 ? ' w-neg' : '')}>{diff > 0 ? '+' : diff < 0 ? '−' : '±'}{num(Math.abs(diff))} kg</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function WorkoutSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useAppState();
  const w = s.workouts.find((x) => x.id === id);
  const [adding, setAdding] = useState(false);
  if (!w) return null;
  const set = (fn: (w: Workout) => void) => update((d) => { const x = d.workouts.find((k) => k.id === id); if (x) fn(x); });
  const exName = (eid: string) => s.exercises.find((e) => e.id === eid)?.name || '?';
  const groups = [...new Set(s.exercises.map((e) => e.group))];

  const finish = () => {
    set((x) => {
      x.entries = x.entries.map((e) => ({ ...e, sets: e.sets.filter((k) => k.r > 0) }));
      x.finishedAt = x.finishedAt || Date.now();
    });
    update((d) => {
      // coche l'habitude "Salle" automatiquement
      const h = d.habits.find((k) => k.name.toLowerCase().includes('salle') && !k.archived);
      if (h && !h.done.includes(w.date)) h.done.push(w.date);
    });
    haptic();
    toast('Séance terminée 💪');
    onClose();
  };

  return (
    <Sheet
      open
      full
      onClose={onClose}
      title={<input className="input-bare" style={{ fontWeight: 600, fontSize: 16 }} value={w.name} onChange={(e) => set((x) => (x.name = e.target.value))} />}
      actions={<button className="icon-btn" aria-label="Supprimer" onClick={() => { if (confirm('Supprimer cette séance ?')) { update((d) => { d.workouts = d.workouts.filter((x) => x.id !== id); }); onClose(); } }}><Trash2 size={16} /></button>}
    >
      <div className="row" style={{ marginBottom: 14 }}>
        <input type="date" className="input" style={{ width: 160 }} value={w.date} onChange={(e) => set((x) => (x.date = e.target.value))} />
        {w.finishedAt && <span className="chip">Terminée</span>}
      </div>

      {w.entries.map((e, ei) => {
        const last = lastSetsFor(s, e.exerciseId, w.id);
        const best = Math.max(0, ...exerciseHistory(s, e.exerciseId).filter((h) => h.date !== w.date).map((h) => h.top));
        return (
          <div key={ei} className="card" style={{ padding: 14, marginBottom: 10 }}>
            <div className="row-between" style={{ marginBottom: 4 }}>
              <div style={{ fontWeight: 600 }}>{exName(e.exerciseId)}</div>
              <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => set((x) => x.entries.splice(ei, 1))}><X size={14} /></button>
            </div>
            <div className="faint small" style={{ marginBottom: 10 }}>
              {last ? <>Dernière fois ({fmtDate(last.date)}) : {last.sets.map((k) => `${num(k.w)}×${k.r}`).join(', ')}</> : 'Première fois sur cet exercice'}
              {best > 0 && <> · <Trophy size={11} style={{ verticalAlign: -1 }} /> {num(best)} kg</>}
            </div>
            <div className="set-row faint small" style={{ marginBottom: 4 }}><span className="set-idx">#</span><span style={{ textAlign: 'center' }}>Charge (kg)</span><span style={{ textAlign: 'center' }}>Reps</span><span /></div>
            {e.sets.map((k, si) => (
              <div key={si} className="set-row">
                <span className="set-idx">{si + 1}</span>
                <NumInput value={k.w} onChange={(n) => set((x) => (x.entries[ei].sets[si].w = n))} />
                <NumInput value={k.r} onChange={(n) => set((x) => (x.entries[ei].sets[si].r = Math.round(n)))} />
                <button className="icon-btn" onClick={() => set((x) => x.entries[ei].sets.splice(si, 1))}><X size={14} /></button>
              </div>
            ))}
            <button className="add-card" style={{ marginTop: 2 }} onClick={() => set((x) => { const prev = x.entries[ei].sets[x.entries[ei].sets.length - 1]; x.entries[ei].sets.push(prev ? { ...prev } : { w: 0, r: 10 }); })}>
              <Plus size={14} /> Série
            </button>
          </div>
        );
      })}

      {adding ? (
        <div className="card" style={{ padding: 12, marginBottom: 10 }}>
          <select
            className="input"
            autoFocus
            defaultValue=""
            onChange={(ev) => {
              const eid = ev.target.value;
              if (!eid) return;
              const last = lastSetsFor(s, eid);
              set((x) => x.entries.push({ exerciseId: eid, sets: last ? last.sets.map((k) => ({ ...k })) : [{ w: 0, r: 10 }] }));
              setAdding(false);
            }}
          >
            <option value="">Choisir un exercice…</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {s.exercises.filter((x) => x.group === g).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </optgroup>
            ))}
          </select>
          <NewExercise onCreated={(eid) => { set((x) => x.entries.push({ exerciseId: eid, sets: [{ w: 0, r: 10 }] })); setAdding(false); }} />
        </div>
      ) : (
        <button className="btn btn-block" style={{ marginBottom: 12 }} onClick={() => setAdding(true)}><Plus size={15} /> Ajouter un exercice</button>
      )}

      <Field label="Note">
        <textarea className="input" style={{ minHeight: 60 }} placeholder="Sensations, douleurs, objectif prochaine fois…" value={w.note || ''} onChange={(e) => set((x) => (x.note = e.target.value))} />
      </Field>

      {!w.finishedAt ? (
        <button className="btn btn-primary btn-lg btn-block" onClick={finish}>Terminer la séance</button>
      ) : (
        <button className="btn btn-lg btn-block" onClick={onClose}>Fermer</button>
      )}
    </Sheet>
  );
}

function NewExercise({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState('Pecs');
  const groups = ['Pecs', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Jambes', 'Abdos', 'Cardio', 'Autre'];
  return (
    <div className="row" style={{ marginTop: 8, gap: 6 }}>
      <input className="input grow" placeholder="Ou nouvel exercice…" value={name} onChange={(e) => setName(e.target.value)} />
      <select className="input" style={{ width: 110 }} value={group} onChange={(e) => setGroup(e.target.value)}>{groups.map((g) => <option key={g}>{g}</option>)}</select>
      <button className="btn" onClick={() => {
        if (!name.trim()) return;
        const id = uid();
        update((d) => { d.exercises.push({ id, name: name.trim(), group }); });
        onCreated(id);
      }}><Plus size={14} /></button>
    </div>
  );
}

function ExerciseSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useAppState();
  const e = s.exercises.find((x) => x.id === id);
  if (!e) return null;
  const h = exerciseHistory(s, id);
  const best = h.reduce((a, x) => (x.top > a.top ? x : a), h[0]);
  const best1 = Math.max(...h.map((x) => x.best1rm));
  return (
    <Sheet open onClose={onClose} title={e.name}>
      <div className="grid grid-2" style={{ marginBottom: 14 }}>
        <div className="card stat"><div className="k">Record charge</div><div className="v">{num(best.top)} kg</div><div className="s">{fmtDate(best.date)}</div></div>
        <div className="card stat"><div className="k">1RM estimé</div><div className="v">{num(Math.round(best1 * 2) / 2)} kg</div><div className="s">formule d'Epley</div></div>
      </div>
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="faint small" style={{ marginBottom: 8 }}>Charge max par séance</div>
        <ChartLine data={h.map((x) => x.top)} labels={h.map((x) => fmtDate(x.date))} />
      </div>
      <div className="list">
        {[...h].reverse().map((x, i) => (
          <div key={i} className="list-item">
            <span className="grow small">{fmtDate(x.date, { withDay: true })}</span>
            <span className="faint small mono">{x.sets.map((k) => `${num(k.w)}×${k.r}`).join('  ')}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function ChartLine({ data, labels }: { data: number[]; labels: string[] }) {
  const W = 520, H = 140, P = 24;
  if (data.length < 2) return <div className="faint small">Encore une séance et la courbe apparaît.</div>;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [P + (i / (data.length - 1)) * (W - P * 2), H - P - ((v - min) / span) * (H - P * 2)]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="var(--border)" />
      <path d={pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ')} fill="none" stroke="var(--text)" strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3} fill="var(--text)" />)}
      <text x={pts[0][0]} y={pts[0][1] - 8} fontSize="11" fill="var(--text-2)" textAnchor="start">{num(data[0])}</text>
      <text x={pts[pts.length - 1][0]} y={pts[pts.length - 1][1] - 8} fontSize="11" fill="var(--text)" fontWeight="600" textAnchor="end">{num(data[data.length - 1])} kg</text>
      <text x={P} y={H - 6} fontSize="10" fill="var(--text-3)">{labels[0]}</text>
      <text x={W - P} y={H - 6} fontSize="10" fill="var(--text-3)" textAnchor="end">{labels[labels.length - 1]}</text>
    </svg>
  );
}

function RoutineSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useAppState();
  const rid = id;
  const r = s.routines.find((x) => x.id === rid);
  if (!r) return null;
  const set = (fn: (r: typeof s.routines[number]) => void) => update((d) => { const x = d.routines.find((k) => k.id === rid); if (x) fn(x); });
  const groups = [...new Set(s.exercises.map((e) => e.group))];
  return (
    <Sheet open onClose={onClose} title="Programme" actions={<button className="icon-btn" onClick={() => { if (confirm('Supprimer ce programme ?')) { update((d) => { d.routines = d.routines.filter((x) => x.id !== rid); }); onClose(); } }}><Trash2 size={16} /></button>}>
      <Field label="Nom"><input className="input" value={r.name} onChange={(e) => set((x) => (x.name = e.target.value))} /></Field>
      <Field label="Exercices (dans l'ordre)">
        <div className="list">
          {r.exerciseIds.map((eid, i) => (
            <div key={eid + i} className="list-item" style={{ minHeight: 42 }}>
              <span className="set-idx">{i + 1}</span>
              <span className="grow">{s.exercises.find((e) => e.id === eid)?.name}</span>
              <button className="icon-btn" disabled={i === 0} style={{ width: 26, height: 26, opacity: i === 0 ? 0.3 : 1 }} onClick={() => set((x) => { [x.exerciseIds[i - 1], x.exerciseIds[i]] = [x.exerciseIds[i], x.exerciseIds[i - 1]]; })}>↑</button>
              <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => set((x) => x.exerciseIds.splice(i, 1))}><X size={14} /></button>
            </div>
          ))}
          {r.exerciseIds.length === 0 && <div className="list-empty">Ajoute des exercices ci-dessous</div>}
        </div>
      </Field>
      <select className="input" value="" onChange={(e) => e.target.value && set((x) => x.exerciseIds.push(e.target.value))}>
        <option value="">+ Ajouter un exercice…</option>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {s.exercises.filter((x) => x.group === g).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </optgroup>
        ))}
      </select>
      <NewExercise onCreated={(eid) => set((x) => x.exerciseIds.push(eid))} />
      <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 18 }} onClick={onClose}>OK</button>
    </Sheet>
  );
}

function WeightSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useAppState();
  const last = s.bodyWeights[s.bodyWeights.length - 1];
  const [kg, setKg] = useState<number>(last?.kg || 0);
  const save = () => {
    if (!kg) return;
    update((d) => {
      const t = today();
      const ex = d.bodyWeights.find((b) => b.date === t);
      if (ex) ex.kg = kg;
      else d.bodyWeights.push({ date: t, kg });
      d.bodyWeights.sort((a, b) => a.date.localeCompare(b.date));
    });
    haptic();
    toast('Poids enregistré');
  };
  return (
    <Sheet open={open} onClose={onClose} title="Poids de corps">
      <div className="row" style={{ marginBottom: 16 }}>
        <NumInput value={kg || null} onChange={setKg} placeholder="kg" className="input title-input grow" />
        <button className="btn btn-primary btn-lg" onClick={save}>Noter aujourd'hui</button>
      </div>
      {s.bodyWeights.length >= 2 && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <ChartLine data={s.bodyWeights.map((b) => b.kg)} labels={s.bodyWeights.map((b) => fmtDate(b.date))} />
        </div>
      )}
      <div className="list">
        {[...s.bodyWeights].reverse().slice(0, 30).map((b) => (
          <div key={b.date} className="list-item">
            <span className="grow">{fmtDate(b.date, { withDay: true })}</span>
            <span className="mono" style={{ fontWeight: 500 }}>{num(b.kg)} kg</span>
            <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => update((d) => { d.bodyWeights = d.bodyWeights.filter((x) => x.date !== b.date); })}><X size={14} /></button>
          </div>
        ))}
        {!s.bodyWeights.length && <div className="list-empty">Pèse-toi le matin à jeun pour des mesures fiables.</div>}
      </div>
    </Sheet>
  );
}
