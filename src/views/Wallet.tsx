import { useState } from 'react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { update, useAppState } from '../store';
import { go } from '../router';
import { Empty, Field, NumInput, Segmented, Sheet, Sparkline, toast } from '../components/ui';
import { EXPENSE_CATS, VINTED_CATS } from '../components/QuickAdd';
import type { Expense, VintedItem, VintedStatus } from '../types';
import { eur, fmtDate, haptic, monthlySubs, mrrTotal, num, parseDate, spentThisMonth, today, uid, vintedProfit, vintedStats } from '../utils';

export default function Wallet({ tab }: { tab?: string }) {
  const current = (['revenus', 'depenses', 'vinted'].includes(tab || '') ? tab : 'revenus') as 'revenus' | 'depenses' | 'vinted';
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Portefeuille</h1>
          <div className="page-sub">Ce qui rentre, ce qui sort, et Vinted à part.</div>
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <Segmented value={current} onChange={(v) => go('wallet/' + v)} options={[{ value: 'revenus', label: 'Revenus' }, { value: 'depenses', label: 'Dépenses' }, { value: 'vinted', label: 'Vinted' }]} />
      </div>
      {current === 'revenus' && <Revenus />}
      {current === 'depenses' && <Depenses />}
      {current === 'vinted' && <Vinted />}
    </>
  );
}

/* ---------------- REVENUS ---------------- */
function Revenus() {
  const s = useAppState();
  const [edit, setEdit] = useState<string | null>(null);
  const mrr = mrrTotal(s);
  const subs = monthlySubs(s);
  const projects = s.projects.filter((p) => !p.archived && p.name !== 'Général');
  const p = s.projects.find((x) => x.id === edit);
  const hist = s.mrrHistory;
  const prev = hist.length >= 2 ? hist[hist.length - 2].total : null;

  return (
    <>
      <div className="card card-pad" style={{ marginBottom: 12 }}>
        <div className="row-between" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="faint small">MRR total</div>
            <div className="big-num" style={{ fontSize: 36 }}>{eur(mrr)}</div>
            <div className="faint small mono">{prev !== null ? `${mrr - prev >= 0 ? '+' : ''}${eur(mrr - prev)} depuis la dernière mise à jour` : 'Mets à jour le MRR de chaque projet ↓'}</div>
          </div>
          <span className="muted"><Sparkline data={hist.map((h) => h.total)} width={110} height={44} /></span>
        </div>
        <div className="divider" style={{ margin: '14px 0 10px' }} />
        <div className="kv"><span>Abonnements & charges fixes</span><span>{subs ? '−' : ''}{eur(subs)}</span></div>
        <div className="kv"><span style={{ color: 'var(--text)', fontWeight: 600 }}>Net mensuel</span><span style={{ fontWeight: 600 }}>{eur(mrr - subs)}</span></div>
      </div>

      <div className="section-title"><span>MRR par projet</span><span className="faint">touche pour modifier</span></div>
      <div className="list">
        {projects.map((x) => (
          <button key={x.id} className="list-item" onClick={() => setEdit(x.id)}>
            <div className="grow">
              <div style={{ fontWeight: 500 }}>{x.name}</div>
              <div className="faint small">{x.countsInMrr ? 'Compte dans l’objectif' : 'Hors objectif MRR'}</div>
            </div>
            <span className="mono" style={{ fontWeight: 600, opacity: x.countsInMrr ? 1 : 0.4 }}>{eur(x.mrr)}</span>
          </button>
        ))}
      </div>

      <div className="section-title"><span>Vinted (séparé)</span></div>
      <button className="card card-click card-pad row-between" style={{ display: 'flex' }} onClick={() => go('wallet/vinted')}>
        <span className="muted">Solde Vinted</span>
        <span className="mono" style={{ fontWeight: 600 }}>{eur(vintedStats(s.vinted).balance)}</span>
      </button>

      {p && (
        <Sheet open onClose={() => setEdit(null)} title={p.name}>
          <Field label="MRR actuel (€ / mois)">
            <NumInput autoFocus className="input title-input" value={p.mrr} onChange={(n) => update((d) => { d.projects.find((k) => k.id === p.id)!.mrr = n; })} />
          </Field>
          <label className="row" style={{ marginBottom: 18, cursor: 'pointer' }}>
            <input type="checkbox" checked={p.countsInMrr} onChange={(e) => update((d) => { d.projects.find((k) => k.id === p.id)!.countsInMrr = e.target.checked; })} style={{ width: 18, height: 18, accentColor: 'var(--text)' }} />
            <span>Compte dans l'objectif principal</span>
          </label>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => { setEdit(null); haptic(); toast('MRR mis à jour'); }}>OK</button>
        </Sheet>
      )}
    </>
  );
}

/* ---------------- DÉPENSES ---------------- */
function Depenses() {
  const s = useAppState();
  const [edit, setEdit] = useState<Expense | 'new' | null>(null);
  const subs = s.expenses.filter((e) => e.kind === 'mensuel').sort((a, b) => Number(b.active) - Number(a.active) || b.amount - a.amount);
  const once = s.expenses.filter((e) => e.kind === 'ponctuel').sort((a, b) => b.date.localeCompare(a.date));
  const byMonth = once.reduce<Record<string, Expense[]>>((acc, e) => { (acc[e.date.slice(0, 7)] ||= []).push(e); return acc; }, {});
  const mrr = mrrTotal(s);
  const monthly = monthlySubs(s);

  return (
    <>
      <div className="grid grid-2" style={{ marginBottom: 12 }}>
        <div className="card stat"><div className="k">Charges fixes / mois</div><div className="v">{eur(monthly)}</div><div className="s">{subs.filter((x) => x.active).length} abonnement{subs.length > 1 ? 's' : ''} actif{subs.length > 1 ? 's' : ''}</div></div>
        <div className="card stat"><div className="k">Dépensé ce mois</div><div className="v">{eur(spentThisMonth(s))}</div><div className="s">Net mensuel : {eur(mrr - monthly)}</div></div>
      </div>

      <div className="section-title"><span>Abonnements<span className="count">{subs.length}</span></span></div>
      <div className="list">
        {subs.length === 0 && <div className="list-empty">Ajoute tes abonnements : ils sont déduits du MRR pour calculer ton net.</div>}
        {subs.map((e) => (
          <button key={e.id} className="list-item" onClick={() => setEdit(e)} style={{ opacity: e.active ? 1 : 0.45 }}>
            <div className="grow"><div style={{ fontWeight: 500 }}>{e.name}</div><div className="faint small">{e.category}{!e.active ? ' · en pause' : ''}</div></div>
            <span className="mono" style={{ fontWeight: 500 }}>{eur(e.amount, true)}<span className="faint">/m</span></span>
          </button>
        ))}
      </div>

      <div className="section-title"><span>Dépenses ponctuelles</span></div>
      {once.length === 0 ? (
        <div className="list"><div className="list-empty">Rien pour l'instant.</div></div>
      ) : (
        Object.entries(byMonth).map(([m, items]) => (
          <div key={m} style={{ marginBottom: 12 }}>
            <div className="row-between faint small" style={{ margin: '0 4px 6px', textTransform: 'capitalize' }}>
              <span>{parseDate(m + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
              <span className="mono">{eur(items.reduce((a, e) => a + e.amount, 0))}</span>
            </div>
            <div className="list">
              {items.map((e) => (
                <button key={e.id} className="list-item" onClick={() => setEdit(e)}>
                  <div className="grow"><div style={{ fontWeight: 500 }}>{e.name}</div><div className="faint small">{e.category} · {fmtDate(e.date)}</div></div>
                  <span className="mono" style={{ fontWeight: 500 }}>{eur(e.amount, true)}</span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
      <button className="btn btn-block" style={{ marginTop: 12 }} onClick={() => setEdit('new')}><Plus size={15} /> Nouvelle dépense</button>
      {edit && <ExpenseSheet expense={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function ExpenseSheet({ expense, onClose }: { expense: Expense | 'new'; onClose: () => void }) {
  const isNew = expense === 'new';
  const [e, setE] = useState<Expense>(isNew ? { id: uid(), name: '', amount: 0, category: EXPENSE_CATS[0], kind: 'mensuel', date: today(), active: true } : { ...expense });
  const save = () => {
    if (!e.name.trim() || !e.amount) return;
    update((d) => {
      const i = d.expenses.findIndex((x) => x.id === e.id);
      if (i >= 0) d.expenses[i] = e;
      else d.expenses.push(e);
    });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={isNew ? 'Nouvelle dépense' : 'Dépense'} actions={!isNew && <button className="icon-btn" onClick={() => { update((d) => { d.expenses = d.expenses.filter((x) => x.id !== e.id); }); onClose(); }}><Trash2 size={16} /></button>}>
      <Field label="Nom"><input className="input" value={e.name} onChange={(ev) => setE({ ...e, name: ev.target.value })} placeholder="Ex : Claude Pro" /></Field>
      <div className="field-row">
        <Field label="Montant (€)"><NumInput value={e.amount || null} onChange={(n) => setE({ ...e, amount: n })} /></Field>
        <Field label="Catégorie"><select className="input" value={e.category} onChange={(ev) => setE({ ...e, category: ev.target.value })}>{EXPENSE_CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
      </div>
      <div style={{ marginBottom: 14 }}><Segmented full value={e.kind} onChange={(k) => setE({ ...e, kind: k })} options={[{ value: 'mensuel', label: 'Tous les mois' }, { value: 'ponctuel', label: 'Ponctuelle' }]} /></div>
      {e.kind === 'ponctuel' ? (
        <Field label="Date"><input type="date" className="input" value={e.date} onChange={(ev) => setE({ ...e, date: ev.target.value })} /></Field>
      ) : (
        <label className="row" style={{ marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={e.active} onChange={(ev) => setE({ ...e, active: ev.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--text)' }} />
          <span>Abonnement actif</span>
        </label>
      )}
      <button className="btn btn-primary btn-lg btn-block" onClick={save}>Enregistrer</button>
    </Sheet>
  );
}

/* ---------------- VINTED ---------------- */
const V_LABEL: Record<VintedStatus, string> = { achete: 'À mettre en ligne', en_vente: 'En vente', vendu: 'Vendu', invendu: 'Invendu' };

function Vinted() {
  const s = useAppState();
  const [filter, setFilter] = useState<'stock' | 'vendu' | 'tous'>('stock');
  const [edit, setEdit] = useState<VintedItem | 'new' | null>(null);
  const st = vintedStats(s.vinted);
  const items = s.vinted.filter((i) => (filter === 'tous' ? true : filter === 'vendu' ? i.status === 'vendu' : i.status !== 'vendu'));

  return (
    <>
      <div className="card card-pad" style={{ marginBottom: 12 }}>
        <div className="faint small">Solde Vinted</div>
        <div className="big-num" style={{ fontSize: 34 }}>{eur(st.balance, true)}</div>
        <div className="faint small">Ventes encaissées − tous les achats</div>
      </div>
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card stat"><div className="k">Bénéfice réalisé</div><div className="v">{eur(st.profit)}</div><div className="s">{st.soldCount} vendu{st.soldCount > 1 ? 's' : ''} · marge {num(st.margin)} %</div></div>
        <div className="card stat"><div className="k">Argent immobilisé</div><div className="v">{eur(st.immobilised)}</div><div className="s">{st.stockCount} en stock · potentiel +{eur(st.potential)}</div></div>
      </div>

      <div className="row-between" style={{ marginBottom: 10 }}>
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'stock', label: 'En stock' }, { value: 'vendu', label: 'Vendus' }, { value: 'tous', label: 'Tous' }]} />
        <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={14} /> Article</button>
      </div>
      <div className="list">
        {items.length === 0 && <Empty title="Rien ici">Ajoute un article dès que tu l'achètes.</Empty>}
        {items.map((i) => {
          const profit = vintedProfit(i);
          return (
            <button key={i.id} className="list-item" onClick={() => setEdit(i)}>
              <div className="grow">
                <div style={{ fontWeight: 500 }} className="ellipsis">{i.name}</div>
                <div className="faint small">{V_LABEL[i.status]} · acheté {eur(i.buyPrice + i.buyFees, true)}{i.targetPrice && i.status !== 'vendu' ? ` · visé ${eur(i.targetPrice)}` : ''}</div>
              </div>
              {i.status === 'vendu' ? (
                <span className="mono" style={{ fontWeight: 600, color: profit < 0 ? 'var(--danger)' : undefined }}>{profit >= 0 ? '+' : ''}{eur(profit, true)}</span>
              ) : (
                <span className="chip">{V_LABEL[i.status]}</span>
              )}
            </button>
          );
        })}
      </div>
      {edit && <VintedSheet item={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function VintedSheet({ item, onClose }: { item: VintedItem | 'new'; onClose: () => void }) {
  const isNew = item === 'new';
  const [v, setV] = useState<VintedItem>(isNew ? { id: uid(), name: '', category: VINTED_CATS[0], status: 'achete', buyPrice: 0, buyFees: 0, sellFees: 0, buyDate: today() } : { ...item });
  const save = (next = v) => {
    if (!next.name.trim()) return;
    update((d) => {
      const i = d.vinted.findIndex((x) => x.id === next.id);
      if (i >= 0) d.vinted[i] = next;
      else d.vinted.unshift(next);
    });
    onClose();
  };
  const profit = (v.sellPrice || 0) - v.sellFees - v.buyPrice - v.buyFees;
  return (
    <Sheet open onClose={onClose} title={isNew ? 'Nouvel article' : 'Article'} actions={<>
      {v.link && <a className="icon-btn" href={v.link} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a>}
      {!isNew && <button className="icon-btn" onClick={() => { if (confirm('Supprimer cet article ?')) { update((d) => { d.vinted = d.vinted.filter((x) => x.id !== v.id); }); onClose(); } }}><Trash2 size={16} /></button>}
    </>}>
      <Field label="Article"><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Ex : Veste Carhartt" /></Field>
      <Field label="Statut">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(V_LABEL) as VintedStatus[]).map((k) => (
            <button key={k} className={'chip' + (v.status === k ? ' solid' : '')} style={{ height: 30, padding: '0 10px' }} onClick={() => setV({ ...v, status: k, sellDate: k === 'vendu' ? v.sellDate || today() : v.sellDate, sellPrice: k === 'vendu' ? v.sellPrice ?? v.targetPrice : v.sellPrice })}>{V_LABEL[k]}</button>
          ))}
        </div>
      </Field>
      <div className="field-row">
        <Field label="Prix d'achat"><NumInput value={v.buyPrice || null} onChange={(n) => setV({ ...v, buyPrice: n })} /></Field>
        <Field label="Frais d'achat"><NumInput value={v.buyFees || null} placeholder="Livraison…" onChange={(n) => setV({ ...v, buyFees: n })} /></Field>
      </div>
      <div className="field-row">
        <Field label="Revente visée"><NumInput value={v.targetPrice ?? null} onChange={(n) => setV({ ...v, targetPrice: n })} /></Field>
        <Field label="Catégorie"><select className="input" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{VINTED_CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
      </div>
      {v.status === 'vendu' && (
        <>
          <div className="field-row">
            <Field label="Prix de vente"><NumInput value={v.sellPrice ?? null} onChange={(n) => setV({ ...v, sellPrice: n })} /></Field>
            <Field label="Frais de vente"><NumInput value={v.sellFees || null} placeholder="Envoi, emballage" onChange={(n) => setV({ ...v, sellFees: n })} /></Field>
          </div>
          <div className="card card-pad row-between" style={{ display: 'flex', marginBottom: 14 }}>
            <span className="muted">Bénéfice</span>
            <span className="mono" style={{ fontWeight: 600 }}>{profit >= 0 ? '+' : ''}{eur(profit, true)}</span>
          </div>
        </>
      )}
      <div className="field-row">
        <Field label="Acheté le"><input type="date" className="input" value={v.buyDate} onChange={(e) => setV({ ...v, buyDate: e.target.value })} /></Field>
        {v.status === 'vendu' ? (
          <Field label="Vendu le"><input type="date" className="input" value={v.sellDate || ''} onChange={(e) => setV({ ...v, sellDate: e.target.value })} /></Field>
        ) : (
          <Field label="Lien annonce"><input className="input" value={v.link || ''} placeholder="https://vinted.fr/…" onChange={(e) => setV({ ...v, link: e.target.value })} /></Field>
        )}
      </div>
      <button className="btn btn-primary btn-lg btn-block" onClick={() => save()}>Enregistrer</button>
    </Sheet>
  );
}
