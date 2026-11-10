// Boîte de réception de Claude.
// Claude dépose des fichiers inbox/*.json dans le repo PRIVÉ de données (focus-data) ;
// à chaque synchro, l'app les lit, ajoute les tâches, puis supprime le fichier.
// Claude n'écrit jamais dans data.json : l'app reste la seule à le modifier.
import type { ChecklistItem, Priority, State, Task } from './types';

const PRIO: Record<string, Priority> = {
  p0: 'p0', p1: 'p1', p2: 'p2', p3: 'p3', none: 'none',
  urgent: 'p0', urgente: 'p0', haute: 'p1', high: 'p1', moyenne: 'p2', medium: 'p2', normale: 'p2', basse: 'p3', low: 'p3', aucune: 'none'
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strList = (v: unknown, max: number, n: number) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);
const hash = (s: string) => {
  let h = 5381;
  for (const ch of s) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
};
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + 'T12:00:00'));
const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/**
 * Transforme le contenu d'un fichier de la boîte en tâches prêtes à ajouter.
 * Accepte { tasks: [...] }, une liste de tâches, ou une seule tâche.
 * Les identifiants dépendent du nom du fichier : relire deux fois le même fichier ne crée pas de doublon.
 */
export function inboxTasks(fileName: string, raw: unknown, s: State, now = Date.now()): Task[] {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  const list: unknown[] = Array.isArray(raw) ? raw : obj && Array.isArray(obj.tasks) ? obj.tasks : obj ? [obj] : [];
  const projects = s.projects.filter((p) => !p.archived);
  const fallback = projects.find((p) => p.name === 'Général') || projects[0];
  const out: Task[] = [];

  list.slice(0, 50).forEach((x, i) => {
    if (!x || typeof x !== 'object' || !fallback) return;
    const t = x as Record<string, unknown>;
    const title = str(t.title, 200);
    if (!title) return;
    const id = 'cl' + hash(fileName) + i.toString(36);
    if (s.tasks.some((k) => k.id === id)) return;

    // Projet : nom exact (sans accents ni majuscules), puis nom approchant, sinon « Général »
    const wanted = str(t.project, 80);
    const w = norm(wanted);
    const proj = (w && (projects.find((p) => norm(p.name) === w) || projects.find((p) => norm(p.name).includes(w) || w.includes(norm(p.name))))) || fallback;
    let notes = str(t.notes, 4000);
    if (w && proj === fallback && norm(fallback.name) !== w) notes = (notes ? notes + '\n\n' : '') + `Projet demandé : ${wanted}`;

    const due = str(t.due, 10);
    const dueTime = str(t.dueTime, 5);
    const url = str(t.url, 500);
    const est = typeof t.estimateMinutes === 'number' && t.estimateMinutes > 0 ? Math.min(1440, Math.round(t.estimateMinutes)) : undefined;
    const remind = typeof t.reminderMinutes === 'number' && t.reminderMinutes >= 0 ? Math.min(10080, Math.round(t.reminderMinutes)) : undefined;
    const checklist: ChecklistItem[] = strList(t.checklist, 200, 30).map((text, j) => ({ id: id + 'c' + j, text, done: false }));
    const tags = strList(t.tags, 30, 8).map((g) => g.replace(/^#/, '')).filter(Boolean);
    const task: Task = {
      id,
      projectId: proj.id,
      title,
      notes,
      status: 'todo',
      priority: PRIO[norm(str(t.priority, 20))] || 'none',
      checklist,
      createdAt: now,
      order: s.tasks.filter((k) => k.projectId === proj.id && k.status === 'todo').length + out.filter((k) => k.projectId === proj.id).length,
      source: 'claude'
    };
    if (isDate(due)) {
      task.due = due;
      if (isTime(dueTime)) task.dueTime = dueTime;
      if (remind !== undefined) task.reminder = { enabled: true, offsetMinutes: remind };
    }
    if (est) task.estimateMinutes = est;
    if (tags.length) task.tags = tags;
    if (/^https?:\/\/\S+$/.test(url)) task.url = url;
    out.push(task);
  });
  return out;
}
