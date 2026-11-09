import { useState, type CSSProperties, type ReactNode } from 'react';
import { Car, ChevronRight, Dumbbell, ExternalLink, Footprints, Package, Plus, Receipt, Repeat, Server, Shirt, Smartphone, Tag, Target, Ticket, Trash2, TrendingDown, TrendingUp, Utensils, Watch, Wrench, type LucideIcon } from 'lucide-react';
import { update, useAppState } from '../store';
import { go } from '../router';
import { Empty, Field, NumInput, Segmented, Sheet, Sparkline, toast } from '../components/ui';
import { EXPENSE_CATS, VINTED_CATS } from '../components/QuickAdd';
import type { Expense, VintedItem, VintedStatus } from '../types';
import { eur, fmtDate, haptic, monthlySubs, mrrTotal, num, parseDate, PROJECT_STATUS_LABEL, spentThisMonth, today, uid, vintedProfit, vintedStats } from '../utils';

/* ---------- Petits outils d'affichage ---------- */
/** Montant signé avec un vrai signe moins : « +12 € », « −26 € » */
const signed = (n: number, cents = true) => {
  const a = Math.abs(n);
  const zero = cents ? Math.round(a * 100) === 0 : Math.round(a) === 0;
  return (zero ? '' : n < 0 ? '\u2212' : '+') + (cents ? money(a) : eur(a));
};
/** Les centimes seulement quand il y en a : « 20 € », « 21,99 € » */
const money = (n: number) => eur(n, Math.round(Math.abs(n) * 100) % 100 !== 0);
/** Vert si positif, rouge si négatif */
const tone = (n: number) => (n > 0 ? ' w-pos' : n < 0 ? ' w-neg' : '');

const PROJECT_COLORS = ['#3b82f6', '#c026d3', '#14b8a6', '#f97316', '#ec4899', '#22c55e', '#6366f1', '#ef4444'];
const colorOf = (key: string) => {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PROJECT_COLORS[h % PROJECT_COLORS.length];
};

const EXP_META: Record<string, { Icon: LucideIcon; color: string }> = {
  'Outils & SaaS': { Icon: Wrench, color: '#6366f1' },
  Hébergement: { Icon: Server, color: '#0ea5e9' },
  'Abonnements perso': { Icon: Repeat, color: '#a855f7' },
  Bouffe: { Icon: Utensils, color: '#f59e0b' },
  'Salle & santé': { Icon: Dumbbell, color: '#10b981' },
  Transport: { Icon: Car, color: '#64748b' },
  Fringues: { Icon: Shirt, color: '#ec4899' },
  Sorties: { Icon: Ticket, color: '#f97316' }
};
const expMeta = (c: string) => EXP_META[c] || { Icon: Receipt, color: '#8b8b94' };

const VIN_ICON: Record<string, LucideIcon> = { Vêtements: Shirt, Chaussures: Footprints, Accessoires: Watch, Électronique: Smartphone };
const V_COLOR: Record<VintedStatus, string> = { achete: '#f59e0b', en_vente: '#3b82f6', vendu: '#22c55e', invendu: '#8b8b94' };
const V_SHORT: Record<VintedStatus, string> = { achete: 'À publier', en_vente: 'En vente', vendu: 'Vendu', invendu: 'Invendu' };

/** Pastille carrée teintée : icône ou initiale */
function Tile({ Icon, color, children }: { Icon?: LucideIcon; color: string; children?: ReactNode }) {
  return (
    <span className="w-tile" style={{ '--c': color } as CSSProperties} aria-hidden="true">
      {Icon ? <Icon size={18} strokeWidth={2.1} /> : children}
    </span>
  );
}

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
      <div className="w-tabs">
        <Segmented
          full
          value={current}
          onChange={(v) => go('wallet/' + v)}
          options={[
            { value: 'revenus', label: <><TrendingUp size={15} /> Revenus</> },
            { value: 'depenses', label: <><Receipt size={15} /> Dépenses</> },
            { value: 'vinted', label: <><Tag size={15} /> Vinted</> }
          ]}
        />
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
  const net = mrr - subs;
  const goal = s.settings.goal;
  const pct = Math.min(100, (mrr / Math.max(1, goal.target)) * 100);
  const hist = s.mrrHistory;
  const delta = hist.length >= 2 ? mrr - hist[hist.length - 2].total : 0;
  const vin = vintedStats(s.vinted);
  const projects = s.projects
    .filter((p) => !p.archived && p.name !== 'Général')
    .sort((a, b) => Number(b.countsInMrr) - Number(a.countsInMrr) || (b.mrr || 0) - (a.mrr || 0));
  const p = s.projects.find((x) => x.id === edit);

  return (
    <>
      <div className="card w-hero">
        <div className="w-hero-top">
          <span className="w-label">MRR total</span>
          {delta !== 0 && (
            <span className={'w-delta' + tone(delta)}>
              {delta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {signed(delta, false)}
            </span>
          )}
        </div>
        <div className="w-big-row">
          <div className="w-big">{eur(mrr)}</div>
          {hist.length >= 2 && <span className="w-spark"><Sparkline data={hist.map((h) => h.total)} width={84} height={36} /></span>}
        </div>
        <div className="w-goal">
          <div className="w-goal-bar"><i style={{ width: pct > 0 ? `max(8px, ${pct}%)` : 0 }} /></div>
          <div className="w-goal-meta">
            <span><Target size={13} /> {goal.title}</span>
            <b>{num(pct)} %</b>
          </div>
        </div>
        <div className="w-split">
          <div><span>Charges fixes</span><b>{signed(-subs, false)}</b></div>
          <div><span>Net mensuel</span><b className={tone(net)}>{signed(net, false)}</b></div>
        </div>
      </div>

      <div className="section-title">
        <span>Par projet<span className="count">{projects.length}</span></span>
        <span className="faint">{mrr === 0 ? 'Touche pour saisir le MRR' : 'par mois'}</span>
      </div>
      <div className="list">
        {projects.map((x) => {
          const share = mrr > 0 && x.countsInMrr ? (x.mrr || 0) / mrr : 0;
          const c = colorOf(x.id);
          return (
            <button key={x.id} className={'list-item w-row' + (x.countsInMrr ? '' : ' off')} onClick={() => setEdit(x.id)}>
              <Tile color={c}>{x.name.trim().charAt(0).toUpperCase()}</Tile>
              <div className="grow w-row-main">
                <div className="w-row-name ellipsis">{x.name}</div>
                <div className="w-row-sub ellipsis">{[x.kind, x.countsInMrr ? PROJECT_STATUS_LABEL[x.status] : 'hors objectif'].filter(Boolean).join(' · ')}</div>
                {share > 0 && <div className="w-share"><i style={{ width: share * 100 + '%', background: c }} /></div>}
              </div>
              <div className="w-row-end">
                <span className="w-amt">{eur(x.mrr)}</span>
                {share > 0 && <span className="w-amt-sub">{num(share * 100)} %</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="section-title"><span>Vinted</span><span className="faint">compté à part</span></div>
      <button className="card card-click w-link" onClick={() => go('wallet/vinted')}>
        <Tile Icon={Tag} color="#14b8a6" />
        <div className="grow w-row-main">
          <div className="w-row-name">Solde Vinted</div>
          <div className="w-row-sub ellipsis">{vin.stockCount} en stock · {vin.soldCount} vendu{vin.soldCount > 1 ? 's' : ''}</div>
        </div>
        <span className={'w-amt' + tone(vin.balance)}>{signed(vin.balance, false)}</span>
        <ChevronRight size={17} className="faint" />
      </button>

      {p && (
        <Sheet open onClose={() => setEdit(null)} title={p.name}>
          <Field label="MRR actuel (€ / mois)">
            <div className="qa-unit">
              <NumInput autoFocus className="input qa-big" value={p.mrr} onChange={(n) => update((d) => { d.projects.find((k) => k.id === p.id)!.mrr = n; })} />
              <span>€</span>
            </div>
          </Field>
          <label className="w-toggle">
            <span>
              <b>Compte dans l'objectif</b>
              <small>{goal.title}</small>
            </span>
            <input type="checkbox" checked={p.countsInMrr} onChange={(e) => update((d) => { d.projects.find((k) => k.id === p.id)!.countsInMrr = e.target.checked; })} />
            <i aria-hidden="true" />
          </label>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => { setEdit(null); haptic(); toast('MRR mis à jour'); }}>OK</button>
        </Sheet>
      )}
    </>
  );
}

/* ---------------- DÉPENSES ---------------- */
type ExpenseEdit = Expense | 'mensuel' | 'ponctuel';

function Depenses() {
  const s = useAppState();
  const [edit, setEdit] = useState<ExpenseEdit | null>(null);
  const subs = s.expenses.filter((e) => e.kind === 'mensuel').sort((a, b) => Number(b.active) - Number(a.active) || b.amount - a.amount);
  const once = s.expenses.filter((e) => e.kind === 'ponctuel').sort((a, b) => b.date.localeCompare(a.date));
  const byMonth = once.reduce<Record<string, Expense[]>>((acc, e) => { (acc[e.date.slice(0, 7)] ||= []).push(e); return acc; }, {});
  const month = today().slice(0, 7);
  const monthly = monthlySubs(s);
  const net = mrrTotal(s) - monthly;
  // Répartition du mois : abonnements actifs + dépenses ponctuelles du mois
  const parts = [...subs.filter((e) => e.active), ...once.filter((e) => e.date.startsWith(month))].reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const cats = Object.entries(parts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const monthName = parseDate(month + '-01').toLocaleDateString('fr-FR', { month: 'long' });

  const row = (e: Expense, sub: string, end: ReactNode) => {
    const { Icon, color } = expMeta(e.category);
    return (
      <button key={e.id} className={'list-item w-row' + (e.kind === 'mensuel' && !e.active ? ' off' : '')} onClick={() => setEdit(e)}>
        <Tile Icon={Icon} color={color} />
        <div className="grow w-row-main">
          <div className="w-row-name ellipsis">{e.name}</div>
          <div className="w-row-sub ellipsis">{sub}</div>
        </div>
        <div className="w-row-end">{end}</div>
      </button>
    );
  };

  return (
    <>
      <div className="card w-hero">
        <div className="w-hero-top"><span className="w-label">Dépensé en {monthName}</span></div>
        <div className="w-big">{eur(spentThisMonth(s))}</div>
        {cats.length > 0 ? (
          <>
            <div className="w-stack" aria-hidden="true">{cats.map(([c, v]) => <i key={c} style={{ flexGrow: v, background: expMeta(c).color }} />)}</div>
            <div className="w-legend">
              {cats.map(([c, v]) => <span key={c}><i style={{ background: expMeta(c).color }} />{c}<b>{eur(v)}</b></span>)}
            </div>
          </>
        ) : (
          <div className="w-hint">Rien de dépensé ce mois-ci pour l'instant.</div>
        )}
        <div className="w-split">
          <div><span>Charges fixes</span><b>{eur(monthly)}<small>/mois</small></b></div>
          <div><span>Net mensuel</span><b className={tone(net)}>{signed(net, false)}</b></div>
        </div>
      </div>

      <div className="section-title">
        <span>Abonnements<span className="count">{subs.length}</span></span>
        <button className="w-add" onClick={() => setEdit('mensuel')}><Plus size={14} /> Ajouter</button>
      </div>
      <div className="list">
        {subs.length === 0 && <div className="list-empty">Ajoute tes abonnements : ils sont déduits du MRR pour calculer ton net.</div>}
        {subs.map((e) => row(e, e.category + (e.active ? '' : ' · en pause'), <><span className="w-amt">{money(e.amount)}</span><span className="w-amt-sub">par mois</span></>))}
      </div>

      <div className="section-title">
        <span>Dépenses ponctuelles</span>
        <button className="w-add" onClick={() => setEdit('ponctuel')}><Plus size={14} /> Ajouter</button>
      </div>
      {once.length === 0 ? (
        <div className="list"><div className="list-empty">Rien pour l'instant.</div></div>
      ) : (
        Object.entries(byMonth).map(([m, items]) => (
          <div key={m} className="w-month">
            <div className="w-month-head">
              <span>{parseDate(m + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
              <span>{money(items.reduce((a, e) => a + e.amount, 0))}</span>
            </div>
            <div className="list">
              {items.map((e) => row(e, `${e.category} · ${fmtDate(e.date)}`, <span className="w-amt">{money(e.amount)}</span>))}
            </div>
          </div>
        ))
      )}
      {edit && <ExpenseSheet expense={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function ExpenseSheet({ expense, onClose }: { expense: ExpenseEdit; onClose: () => void }) {
  const isNew = typeof expense === 'string';
  const [e, setE] = useState<Expense>(typeof expense === 'string' ? { id: uid(), name: '', amount: 0, category: EXPENSE_CATS[0], kind: expense, date: today(), active: true } : { ...expense });
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
  const n = (k: number) => <span className="seg-n">{k}</span>;

  return (
    <>
      <div className="card w-hero">
        <div className="w-hero-top">
          <span className="w-label">Solde Vinted</span>
          <span className="w-label-sub">ventes − achats</span>
        </div>
        <div className={'w-big' + tone(st.balance)}>{signed(st.balance)}</div>
        <div className="w-split w-trio">
          <div><span>Bénéfice</span><b className={tone(st.profit)}>{signed(st.profit, false)}</b><small>marge {num(st.margin)} %</small></div>
          <div><span>Immobilisé</span><b>{eur(st.immobilised)}</b><small>{st.stockCount} en stock</small></div>
          <div><span>Potentiel</span><b>{signed(st.potential, false)}</b><small>si tout part</small></div>
        </div>
      </div>

      <div className="w-filter">
        <Segmented
          full
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'stock', label: <>En stock {n(st.stockCount)}</> },
            { value: 'vendu', label: <>Vendus {n(st.soldCount)}</> },
            { value: 'tous', label: <>Tous {n(s.vinted.length)}</> }
          ]}
        />
        <button className="w-plus" onClick={() => setEdit('new')} aria-label="Nouvel article"><Plus size={19} /></button>
      </div>
      <div className="list">
        {items.length === 0 && <Empty title="Rien ici">Ajoute un article dès que tu l'achètes.</Empty>}
        {items.map((i) => {
          const sold = i.status === 'vendu';
          const profit = vintedProfit(i);
          const cost = i.buyPrice + i.buyFees;
          return (
            <button key={i.id} className="list-item w-row" onClick={() => setEdit(i)}>
              <Tile Icon={VIN_ICON[i.category] || Package} color={V_COLOR[i.status]} />
              <div className="grow w-row-main">
                <div className="w-row-name ellipsis">{i.name}</div>
                <div className="w-row-sub ellipsis">
                  {sold
                    ? `Vendu ${money(i.sellPrice || 0)} · coût ${money(cost)}`
                    : `Acheté ${money(cost)}${i.targetPrice ? ` · visé ${money(i.targetPrice)}` : ''}`}
                </div>
              </div>
              {sold ? (
                <div className="w-row-end">
                  <span className={'w-amt' + tone(profit)}>{signed(profit)}</span>
                  <span className="w-amt-sub">{i.sellDate ? fmtDate(i.sellDate) : 'bénéfice'}</span>
                </div>
              ) : (
                <span className="w-status" style={{ '--c': V_COLOR[i.status] } as CSSProperties}>{V_SHORT[i.status]}</span>
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
            <span className={'w-amt' + tone(profit)}>{signed(profit)}</span>
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
