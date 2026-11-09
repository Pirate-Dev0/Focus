import { useEffect, useRef, useState } from 'react';
import { CalendarDays, CheckSquare, Clock, Receipt, Repeat, Scale, Shirt, X } from 'lucide-react';
import { getState, update, useAppState } from '../store';
import { ChipScroll, NumInput, Segmented, Sheet, toast, PriorityIcon } from './ui';
import type { Priority, RecurrenceFreq } from '../types';
import { addDays, fmtDate, haptic, PRIORITY_LABEL, today, uid } from '../utils';
import { addTaskFromText, projectFromTag } from '../actions';

type Kind = 'task' | 'expense' | 'vinted' | 'weight';

export const EXPENSE_CATS = ['Outils & SaaS', 'Hébergement', 'Abonnements perso', 'Bouffe', 'Salle & santé', 'Transport', 'Fringues', 'Sorties', 'Autre'];
export const VINTED_CATS = ['Vêtements', 'Chaussures', 'Accessoires', 'Électronique', 'Autre'];

export function QuickAdd({ open, onClose, defaultProject, defaultDue }: { open: boolean; onClose: () => void; defaultProject?: string; defaultDue?: string }) {
  const s = useAppState();
  const [kind, setKind] = useState<Kind>('task');
  const projects = s.projects.filter((p) => !p.archived);

  // tâche
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [due, setDue] = useState<string>('');
  const [dueTime, setDueTime] = useState<string>('');
  const [prio, setPrio] = useState<Priority>('none');
  const [rec, setRec] = useState<RecurrenceFreq | 'none'>('none');
  // dépense
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [cat, setCat] = useState(EXPENSE_CATS[0]);
  const [freq, setFreq] = useState<'ponctuel' | 'mensuel'>('ponctuel');
  // vinted
  const [vName, setVName] = useState('');
  const [vBuy, setVBuy] = useState<number>(0);
  const [vTarget, setVTarget] = useState<number>(0);
  const [vCat, setVCat] = useState(VINTED_CATS[0]);
  // poids
  const [kg, setKg] = useState<number>(0);

  const firstRef = useRef<HTMLInputElement>(null);
  // « #wake » dans le titre → le projet WakeTap s'allume
  const tagged = kind === 'task' ? projectFromTag(title) : null;

  useEffect(() => {
    if (!open) return;
    const st = getState();
    setKind('task');
    setProjectId(defaultProject || st.projects.find((p) => p.name === 'Général')?.id || st.projects[0]?.id || '');
    setTitle(''); setDue(defaultDue || ''); setDueTime(''); setPrio('none'); setRec('none'); setName(''); setAmount(0); setVName(''); setVBuy(0); setVTarget(0);
    const last = st.bodyWeights[st.bodyWeights.length - 1];
    setKg(last?.kg || 0);
    // le clavier a déjà été ouvert par le tap sur « + » (primeKeyboard) : on passe le focus au vrai champ
    requestAnimationFrame(() => firstRef.current?.focus({ preventScroll: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // changer de type garde le clavier ouvert sur le bon champ
  useEffect(() => {
    if (open && kind !== 'weight') requestAnimationFrame(() => firstRef.current?.focus({ preventScroll: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const submit = () => {
    if (kind === 'task') {
      if (!title.trim()) return;
      const task = addTaskFromText(title, {
        projectId,
        due: due || undefined,
        dueTime: dueTime || undefined,
        priority: prio,
        recurrence: rec !== 'none' ? { freq: rec } : undefined
      });
      toast(task?.due ? `Tâche ajoutée pour ${fmtDate(task.due).toLowerCase()}` : 'Tâche ajoutée');
    } else if (kind === 'expense') {
      if (!name.trim() || !amount) return;
      update((d) => {
        d.expenses.push({ id: uid(), name: name.trim(), amount, category: cat, kind: freq, date: today(), active: true });
      });
      toast(freq === 'mensuel' ? 'Abonnement ajouté' : 'Dépense ajoutée');
    } else if (kind === 'vinted') {
      if (!vName.trim()) return;
      update((d) => {
        d.vinted.unshift({ id: uid(), name: vName.trim(), category: vCat, status: 'achete', buyPrice: vBuy, buyFees: 0, targetPrice: vTarget || undefined, sellFees: 0, buyDate: today() });
      });
      toast('Article ajouté');
    } else {
      if (!kg) return;
      update((d) => {
        const t = today();
        const ex = d.bodyWeights.find((b) => b.date === t);
        if (ex) ex.kg = kg;
        else d.bodyWeights.push({ date: t, kg });
        d.bodyWeights.sort((a, b) => a.date.localeCompare(b.date));
      });
      toast('Poids enregistré');
    }
    haptic();
    onClose();
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const dueOpts = [
    { v: '', l: 'Sans date' },
    { v: today(), l: "Aujourd'hui" },
    { v: addDays(today(), 1), l: 'Demain' },
    { v: addDays(today(), 7), l: 'Dans 1 sem.' }
  ];
  const customDue = Boolean(due) && !dueOpts.some((o) => o.v === due);
  const REC_OPTS: { f: RecurrenceFreq | 'none'; l: string }[] = [
    { f: 'none', l: 'Aucune' },
    { f: 'daily', l: 'Tous les jours' },
    { f: 'weekdays', l: 'Jours ouvrés' },
    { f: 'weekly', l: 'Chaque semaine' },
    { f: 'monthly', l: 'Chaque mois' }
  ];
  const margin = vBuy && vTarget ? vTarget - vBuy : 0;
  const lastKg = s.bodyWeights[s.bodyWeights.length - 1];
  const canSubmit = kind === 'task' ? Boolean(title.trim()) : kind === 'expense' ? Boolean(name.trim() && amount) : kind === 'vinted' ? Boolean(vName.trim()) : Boolean(kg);
  const pill = (on: boolean) => 'hs-pill' + (on ? ' solid on' : '');

  return (
    <Sheet open={open} onClose={onClose} title="Ajout rapide">
      <div className="hs qa">
        <Segmented<Kind>
          full
          value={kind}
          onChange={setKind}
          options={[
            { value: 'task', label: <><CheckSquare size={14} /> Tâche</> },
            { value: 'expense', label: <><Receipt size={14} /> Dépense</> },
            { value: 'vinted', label: <><Shirt size={14} /> Vinted</> },
            { value: 'weight', label: <><Scale size={14} /> Poids</> }
          ]}
        />

        <div onKeyDown={onEnter}>
          {kind === 'task' && (
            <>
              <input ref={firstRef} className="input-bare title-input qa-title" placeholder="Que faut-il faire ?" value={title} onChange={(e) => setTitle(e.target.value)} enterKeyHint="done" autoCapitalize="sentences" />

              <section className="hs-sec">
                <div className="hs-label">Projet</div>
                <ChipScroll>
                  {projects.map((p) => (
                    <button key={p.id} type="button" className={pill((tagged?.project.id || projectId) === p.id)} onClick={() => setProjectId(p.id)}>{p.name}</button>
                  ))}
                </ChipScroll>
              </section>

              <section className="hs-sec">
                <div className="hs-label">Échéance</div>
                <ChipScroll>
                  {dueOpts.map((o) => (
                    <button key={o.l} type="button" className={pill(due === o.v)} onClick={() => setDue(o.v)}>{o.l}</button>
                  ))}
                  <PickerPill type="date" value={due} onChange={setDue} on={customDue}>
                    <CalendarDays size={14} /> {customDue ? fmtDate(due, { withDay: true }) : 'Autre date'}
                  </PickerPill>
                </ChipScroll>
                <div className="hs-card qa-card">
                  <div className="hs-row">
                    <span className="hs-row-icon"><Clock size={16} /></span>
                    <div className="hs-row-text">
                      <b>Heure</b>
                      <span>{dueTime ? `À faire à ${dueTime}` : 'Optionnelle'}</span>
                    </div>
                    {dueTime && (
                      <button type="button" className="icon-btn" aria-label="Retirer l’heure" onClick={() => setDueTime('')}><X size={16} /></button>
                    )}
                    <PickerPill type="time" value={dueTime} onChange={setDueTime} on={Boolean(dueTime)}>
                      {dueTime || 'Ajouter'}
                    </PickerPill>
                  </div>
                </div>
              </section>

              <section className="hs-sec">
                <div className="hs-label">Répétition</div>
                <ChipScroll>
                  {REC_OPTS.map((opt) => (
                    <button key={opt.f} type="button" className={pill(rec === opt.f)} onClick={() => setRec(opt.f)}>
                      {opt.f !== 'none' && <Repeat size={13} />} {opt.l}
                    </button>
                  ))}
                </ChipScroll>
              </section>

              <section className="hs-sec">
                <div className="hs-label">Priorité</div>
                <div className="hs-moments five">
                  {(['p0', 'p1', 'p2', 'p3', 'none'] as Priority[]).map((p) => (
                    <button key={p} type="button" className={'hs-moment' + (prio === p ? ' on' : '')} onClick={() => setPrio(p)}>
                      <PriorityIcon p={p} size={17} />
                      <span>{PRIORITY_LABEL[p]}</span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {kind === 'expense' && (
            <>
              <input ref={firstRef} className="input-bare title-input qa-title" placeholder="Nom (ex : Vercel Pro)" enterKeyHint="done" value={name} onChange={(e) => setName(e.target.value)} />

              <section className="hs-sec">
                <div className="hs-label">Montant</div>
                <div className="qa-unit">
                  <NumInput value={amount || null} onChange={setAmount} placeholder="0" className="input qa-big" />
                  <span>€</span>
                </div>
              </section>

              <section className="hs-sec">
                <div className="hs-label">Fréquence</div>
                <Segmented full value={freq} onChange={setFreq} options={[{ value: 'ponctuel', label: 'Ponctuelle' }, { value: 'mensuel', label: 'Tous les mois' }]} />
              </section>

              <section className="hs-sec">
                <div className="hs-label">Catégorie</div>
                <div className="qa-wrap">
                  {EXPENSE_CATS.map((c) => (
                    <button key={c} type="button" className={pill(cat === c)} onClick={() => setCat(c)}>{c}</button>
                  ))}
                </div>
              </section>
            </>
          )}

          {kind === 'vinted' && (
            <>
              <input ref={firstRef} className="input-bare title-input qa-title" placeholder="Article (ex : Nike TN noires)" enterKeyHint="done" value={vName} onChange={(e) => setVName(e.target.value)} />

              <section className="hs-sec">
                <div className="qa-grid2">
                  <label className="hs-mini">
                    <span>Prix d’achat</span>
                    <div className="qa-unit">
                      <NumInput value={vBuy || null} onChange={setVBuy} placeholder="0" className="input" />
                      <span>€</span>
                    </div>
                  </label>
                  <label className="hs-mini">
                    <span>Revente visée</span>
                    <div className="qa-unit">
                      <NumInput value={vTarget || null} onChange={setVTarget} placeholder="0" className="input" />
                      <span>€</span>
                    </div>
                  </label>
                </div>
                {margin !== 0 && (
                  <div className={'qa-margin' + (margin < 0 ? ' neg' : '')}>
                    Marge visée : {margin > 0 ? '+' : ''}{margin.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €
                  </div>
                )}
              </section>

              <section className="hs-sec">
                <div className="hs-label">Catégorie</div>
                <div className="qa-wrap">
                  {VINTED_CATS.map((c) => (
                    <button key={c} type="button" className={pill(vCat === c)} onClick={() => setVCat(c)}>{c}</button>
                  ))}
                </div>
              </section>
            </>
          )}

          {kind === 'weight' && (
            <section className="hs-sec qa-weight">
              <div className="hs-label">Poids du jour</div>
              <div className="qa-unit">
                <NumInput autoFocus value={kg || null} onChange={setKg} placeholder="70,5" className="input qa-big" />
                <span>kg</span>
              </div>
              {lastKg && (
                <div className="hs-hint">Dernière pesée : {lastKg.kg.toLocaleString('fr-FR')} kg · {fmtDate(lastKg.date).toLowerCase()}</div>
              )}
            </section>
          )}
        </div>

        <button className="btn btn-primary btn-lg btn-block qa-submit" disabled={!canSubmit} onClick={submit}>Ajouter</button>
      </div>
    </Sheet>
  );
}

/* Pastille qui ouvre le sélecteur natif (date / heure) : l'input est invisible par-dessus */
function PickerPill({ type, value, onChange, on, children }: { type: 'date' | 'time'; value: string; onChange: (v: string) => void; on: boolean; children: React.ReactNode }) {
  return (
    <label className={'hs-pill hs-picker' + (on ? ' solid on' : '')}>
      {children}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* le tap natif suffit */ }
        }}
      />
    </label>
  );
}
