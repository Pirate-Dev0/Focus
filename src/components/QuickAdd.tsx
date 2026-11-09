import { useEffect, useRef, useState } from 'react';
import { CheckSquare, Receipt, Shirt, Scale } from 'lucide-react';
import { getState, update, useAppState } from '../store';
import { Field, NumInput, Segmented, Sheet, toast, PriorityIcon } from './ui';
import type { Priority } from '../types';
import { addDays, haptic, PRIORITY_LABEL, today, uid } from '../utils';

type Kind = 'task' | 'expense' | 'vinted' | 'weight';

export const EXPENSE_CATS = ['Outils & SaaS', 'Hébergement', 'Abonnements perso', 'Bouffe', 'Salle & santé', 'Transport', 'Fringues', 'Sorties', 'Autre'];
export const VINTED_CATS = ['Vêtements', 'Chaussures', 'Accessoires', 'Électronique', 'Autre'];

export function QuickAdd({ open, onClose, defaultProject }: { open: boolean; onClose: () => void; defaultProject?: string }) {
  const s = useAppState();
  const [kind, setKind] = useState<Kind>('task');
  const projects = s.projects.filter((p) => !p.archived);

  // tâche
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [due, setDue] = useState<string>('');
  const [prio, setPrio] = useState<Priority>('none');
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

  useEffect(() => {
    if (!open) return;
    const st = getState();
    setProjectId(defaultProject || st.projects.find((p) => p.name === 'Général')?.id || st.projects[0]?.id || '');
    setTitle(''); setDue(''); setPrio('none'); setName(''); setAmount(0); setVName(''); setVBuy(0); setVTarget(0);
    const last = st.bodyWeights[st.bodyWeights.length - 1];
    setKg(last?.kg || 0);
    setTimeout(() => firstRef.current?.focus(), 250);
  }, [open, defaultProject]);

  const submit = () => {
    if (kind === 'task') {
      if (!title.trim()) return;
      update((d) => {
        const order = d.tasks.filter((t) => t.projectId === projectId && t.status === 'todo').length;
        d.tasks.push({ id: uid(), projectId, title: title.trim(), notes: '', status: 'todo', priority: prio, due: due || undefined, checklist: [], createdAt: Date.now(), order });
      });
      toast('Tâche ajoutée');
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

  return (
    <Sheet open={open} onClose={onClose} title="Ajout rapide">
      <div style={{ marginBottom: 16 }}>
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
      </div>

      <div onKeyDown={onEnter}>
        {kind === 'task' && (
          <>
            <input ref={firstRef} className="input-bare title-input" placeholder="Que faut-il faire ?" value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 16 }} />
            <Field label="Projet">
              <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Échéance">
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {dueOpts.map((o) => (
                  <button key={o.l} type="button" className={'chip' + (due === o.v ? ' solid' : '')} style={{ height: 30, padding: '0 10px' }} onClick={() => setDue(o.v)}>{o.l}</button>
                ))}
                <input type="date" className="input" style={{ width: 150, height: 30 }} value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
            </Field>
            <Field label="Priorité">
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {(['p0', 'p1', 'p2', 'p3', 'none'] as Priority[]).map((p) => (
                  <button key={p} type="button" className={'chip' + (prio === p ? ' solid' : '')} style={{ height: 30, padding: '0 10px' }} onClick={() => setPrio(p)}>
                    <PriorityIcon p={p} size={12} /> {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        {kind === 'expense' && (
          <>
            <input ref={firstRef} className="input-bare title-input" placeholder="Nom (ex : Vercel Pro)" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 16 }} />
            <div className="field-row">
              <Field label="Montant (€)"><NumInput value={amount || null} onChange={setAmount} placeholder="0" /></Field>
              <Field label="Catégorie">
                <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
                  {EXPENSE_CATS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Segmented full value={freq} onChange={setFreq} options={[{ value: 'ponctuel', label: 'Ponctuelle' }, { value: 'mensuel', label: 'Tous les mois' }]} />
          </>
        )}

        {kind === 'vinted' && (
          <>
            <input ref={firstRef} className="input-bare title-input" placeholder="Article (ex : Nike TN noires)" value={vName} onChange={(e) => setVName(e.target.value)} style={{ marginBottom: 16 }} />
            <div className="field-row">
              <Field label="Prix d'achat (€)"><NumInput value={vBuy || null} onChange={setVBuy} placeholder="0" /></Field>
              <Field label="Revente visée (€)"><NumInput value={vTarget || null} onChange={setVTarget} placeholder="0" /></Field>
            </div>
            <Field label="Catégorie">
              <select className="input" value={vCat} onChange={(e) => setVCat(e.target.value)}>
                {VINTED_CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </>
        )}

        {kind === 'weight' && (
          <Field label="Poids du jour (kg)">
            <NumInput autoFocus value={kg || null} onChange={setKg} placeholder="70,5" className="input title-input" />
          </Field>
        )}
      </div>

      <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 18 }} onClick={submit}>Ajouter</button>
    </Sheet>
  );
}
