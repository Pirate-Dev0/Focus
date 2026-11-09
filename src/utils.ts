import type { Priority, ProjectStatus, State, Status, Habit, VintedItem } from './types';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const today = () => iso(new Date());
export const addDays = (s: string, n: number) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const daysBetween = (a: string, b: string) =>
  Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);

const eurFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurFmt2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
export const eur = (n: number, precise = false) => (precise ? eurFmt2 : eurFmt).format(n || 0);
export const num = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);

export const DAYS_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const DAYS_FULL = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function fmtDate(s?: string, opts: { withDay?: boolean } = {}) {
  if (!s) return '';
  const t = today();
  const diff = daysBetween(t, s);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  const d = parseDate(s);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    ...(opts.withDay ? { weekday: 'short' } : {}),
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {})
  });
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Bonne nuit';
  if (h < 18) return 'Bonjour';
  return 'Bonsoir';
}

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'À faire',
  doing: 'En cours',
  blocked: 'Bloqué',
  done: 'Fait'
};
export const STATUSES: Status[] = ['todo', 'doing', 'blocked', 'done'];

export const PRIORITY_LABEL: Record<Priority, string> = {
  p0: 'Urgent',
  p1: 'Haute',
  p2: 'Moyenne',
  p3: 'Basse',
  none: 'Aucune'
};
export const PRIORITIES: Priority[] = ['p0', 'p1', 'p2', 'p3', 'none'];
export const prioRank = (p: Priority) => PRIORITIES.indexOf(p);

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  idee: 'Idée',
  construction: 'En construction',
  lance: 'Lancé',
  croissance: 'En croissance',
  pause: 'Pause',
  termine: 'Terminé'
};

export const mrrTotal = (s: State) =>
  s.projects.filter((p) => !p.archived && p.countsInMrr).reduce((a, p) => a + (p.mrr || 0), 0);

export const monthlySubs = (s: State) =>
  s.expenses.filter((e) => e.kind === 'mensuel' && e.active).reduce((a, e) => a + e.amount, 0);

export const spentThisMonth = (s: State) => {
  const m = today().slice(0, 7);
  return monthlySubs(s) + s.expenses.filter((e) => e.kind === 'ponctuel' && e.date.startsWith(m)).reduce((a, e) => a + e.amount, 0);
};

export const vintedProfit = (i: VintedItem) =>
  i.status === 'vendu' ? (i.sellPrice || 0) - i.sellFees - i.buyPrice - i.buyFees : 0;

export function vintedStats(items: VintedItem[]) {
  const sold = items.filter((i) => i.status === 'vendu');
  const stock = items.filter((i) => i.status !== 'vendu');
  const revenue = sold.reduce((a, i) => a + (i.sellPrice || 0) - i.sellFees, 0);
  const spent = items.reduce((a, i) => a + i.buyPrice + i.buyFees, 0);
  const profit = sold.reduce((a, i) => a + vintedProfit(i), 0);
  const immobilised = stock.filter((i) => i.status !== 'invendu').reduce((a, i) => a + i.buyPrice + i.buyFees, 0);
  const potential = stock.reduce((a, i) => a + (i.targetPrice || 0) - i.buyPrice - i.buyFees, 0);
  const soldCost = sold.reduce((a, i) => a + i.buyPrice + i.buyFees, 0);
  return {
    balance: revenue - spent,
    profit,
    immobilised,
    potential,
    margin: soldCost > 0 ? (profit / soldCost) * 100 : 0,
    soldCount: sold.length,
    stockCount: stock.length
  };
}

export const habitDueOn = (h: Habit, date: string) => h.days.includes(parseDate(date).getDay());

export function habitStreak(h: Habit) {
  let streak = 0;
  let d = today();
  // aujourd'hui pas encore fait ne casse pas la série
  if (!h.done.includes(d)) d = addDays(d, -1);
  for (let i = 0; i < 400; i++) {
    if (habitDueOn(h, d)) {
      if (h.done.includes(d)) streak++;
      else break;
    }
    d = addDays(d, -1);
  }
  return streak;
}

export const est1RM = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));

export function clamp(n: number, a = 0, b = 1) {
  return Math.max(a, Math.min(b, n));
}

export function haptic() {
  try {
    navigator.vibrate?.(8);
  } catch {}
}
