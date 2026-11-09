import type { Priority, ProjectStatus, State, Status, Habit, Task, VintedItem, TaskRecurrence } from './types';

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
export const fmtInt = (n: number) => new Intl.NumberFormat('fr-FR').format(n || 0);

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

export const isHabitDone = (h: Habit, date: string) => {
  if (h.kind === 'numeric') {
    const val = h.values?.[date] ?? 0;
    return val >= (h.targetValue || 1) || h.done.includes(date);
  }
  return h.done.includes(date);
};

export const habitDueOn = (h: Habit, date: string) => {
  if (h.frequencyType === 'times_per_week') return true;
  return h.days.includes(parseDate(date).getDay());
};

export function habitStreak(h: Habit) {
  let streak = 0;
  let d = today();
  // aujourd'hui pas encore fait ne casse pas la série
  if (!isHabitDone(h, d) && !h.freezes?.includes(d)) d = addDays(d, -1);
  for (let i = 0; i < 400; i++) {
    if (habitDueOn(h, d)) {
      if (isHabitDone(h, d)) {
        streak++;
      } else if (h.freezes?.includes(d)) {
        // Jour de joker / freeze : ne brise pas la série
      } else {
        break;
      }
    }
    d = addDays(d, -1);
  }
  return streak;
}

export function computeNextDueDate(baseDue: string, rec: TaskRecurrence, fromDate?: string): string {
  const startStr = fromDate || baseDue || today();
  const d = parseDate(startStr);
  const interval = Math.max(1, rec.interval || 1);

  switch (rec.freq) {
    case 'daily':
      d.setDate(d.getDate() + interval);
      return iso(d);
    case 'weekdays': {
      do {
        d.setDate(d.getDate() + 1);
      } while (d.getDay() === 0 || d.getDay() === 6);
      return iso(d);
    }
    case 'weekly': {
      if (rec.daysOfWeek && rec.daysOfWeek.length > 0) {
        // Cherche le prochain jour de la liste
        let next = new Date(d);
        for (let i = 1; i <= 7 * interval; i++) {
          next.setDate(next.getDate() + 1);
          if (rec.daysOfWeek.includes(next.getDay())) return iso(next);
        }
      }
      d.setDate(d.getDate() + 7 * interval);
      return iso(d);
    }
    case 'monthly':
      d.setMonth(d.getMonth() + interval);
      return iso(d);
    case 'yearly':
      d.setFullYear(d.getFullYear() + interval);
      return iso(d);
    case 'after_completion':
      return addDays(today(), interval);
    default:
      d.setDate(d.getDate() + 1);
      return iso(d);
  }
}

export function fmtDuration(min?: number): string {
  if (!min || min <= 0) return '';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem ? `${h}h${rem}` : `${h}h`;
}

export const est1RM = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));

export function clamp(n: number, a = 0, b = 1) {
  return Math.max(a, Math.min(b, n));
}

// Retour haptique : vibrate() sur Android, et sur iPhone (iOS 18+) l'astuce du <input switch>
// qui déclenche le « tic » natif quand on le bascule. Doit être appelé pendant un geste (tap, fin de swipe).
export function haptic() {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(8);
      return;
    }
    const label = document.createElement('label');
    label.ariaHidden = 'true';
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    label.remove();
  } catch {}
}

/* ---------- Tâches par jour (accueil) ---------- */
export const doneOn = (t: Task, day: string) => t.status === 'done' && !!t.doneAt && iso(new Date(t.doneAt)) === day;

// Ce qui reste à faire pour un jour donné. Aujourd'hui : en retard + du jour + en cours + urgentes sans date.
export function openTasksFor(tasks: Task[], day: string) {
  const t = today();
  return tasks
    .filter((x) => x.status !== 'done')
    .filter((x) => (day === t ? (x.due && x.due <= t) || x.status === 'doing' || (x.priority === 'p0' && !x.due) : x.due === day))
    .sort((a, b) => {
      if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime);
      if (a.dueTime && !b.dueTime) return -1;
      if (!a.dueTime && b.dueTime) return 1;
      return prioRank(a.priority) - prioRank(b.priority) || (a.due || '9').localeCompare(b.due || '9') || a.createdAt - b.createdAt;
    });
}

export function dayShort(day: string) {
  const diff = daysBetween(today(), day);
  if (diff === 0) return 'Auj.';
  if (diff === 1) return 'Dem.';
  return parseDate(day).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
}
