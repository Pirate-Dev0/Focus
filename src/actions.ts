// Actions sur les tâches partagées entre l'accueil, les projets et les fenêtres, avec « Annuler ».
import { getState, update } from './store';
import { toast } from './components/ui';
import { addDays, computeNextDueDate, fmtDate, today, uid } from './utils';
import type { Priority, Task, TaskRecurrence, TaskReminder } from './types';

export function setTaskDone(id: string, done: boolean) {
  const prev = getState().tasks.find((t) => t.id === id);
  if (!prev) return;
  const before = { status: prev.status, doneAt: prev.doneAt };
  let nextTaskId: string | null = null;

  update((d) => {
    const t = d.tasks.find((x) => x.id === id);
    if (!t) return;
    t.status = done ? 'done' : prev.status === 'done' ? 'todo' : prev.status;
    t.doneAt = done ? Date.now() : undefined;

    // Si la tâche a une récurrence et qu'on la termine, programmer la prochaine occurrence
    if (done && t.recurrence) {
      const nextDue = computeNextDueDate(t.due || today(), t.recurrence);
      const nextTask: Task = {
        ...t,
        id: uid(),
        due: nextDue,
        status: 'todo',
        doneAt: undefined,
        createdAt: Date.now(),
        checklist: t.checklist.map((c) => ({ ...c, done: false })),
        order: d.tasks.filter((x) => x.projectId === t.projectId && x.status === 'todo').length
      };
      nextTaskId = nextTask.id;
      d.tasks.push(nextTask);
    }
  });

  if (done) {
    const msg = prev.recurrence ? 'Tâche terminée · Prochaine occurrence créée' : 'Tâche terminée';
    toast(msg, {
      label: 'Annuler',
      run: () =>
        update((d) => {
          const t = d.tasks.find((x) => x.id === id);
          if (t) Object.assign(t, before);
          if (nextTaskId) {
            d.tasks = d.tasks.filter((x) => x.id !== nextTaskId);
          }
        })
    });
  }
}

export function setHabitProgress(habitId: string, date: string, delta: number | 'toggle') {
  update((d) => {
    const h = d.habits.find((x) => x.id === habitId);
    if (!h) return;
    if (h.kind === 'numeric') {
      h.values ||= {};
      const cur = h.values[date] || 0;
      const target = h.targetValue || 1;
      let nextVal = typeof delta === 'number' ? Math.max(0, cur + delta) : (cur >= target ? 0 : target);
      nextVal = Math.round(nextVal * 100) / 100;
      h.values[date] = nextVal;
      if (nextVal >= target) {
        if (!h.done.includes(date)) h.done.push(date);
      } else {
        h.done = h.done.filter((x) => x !== date);
      }
    } else {
      h.done = h.done.includes(date) ? h.done.filter((x) => x !== date) : [...h.done, date];
    }
  });
}

export function toggleHabitFreeze(habitId: string, date: string) {
  update((d) => {
    const h = d.habits.find((x) => x.id === habitId);
    if (!h) return;
    h.freezes ||= [];
    if (h.freezes.includes(date)) {
      h.freezes = h.freezes.filter((x) => x !== date);
      toast('Joker retiré');
    } else {
      h.freezes.push(date);
      toast('Joker activé 🔥 série protégée');
    }
  });
}

export function postponeTask(id: string, to?: string) {
  const prev = getState().tasks.find((t) => t.id === id);
  if (!prev) return;
  const t0 = today();
  // « demain » par rapport à aujourd'hui pour une tâche en retard ou du jour, sinon le lendemain de son échéance
  const target = to || addDays(prev.due && prev.due > t0 ? prev.due : t0, 1);
  const before = prev.due;
  update((d) => {
    const t = d.tasks.find((x) => x.id === id);
    if (t) t.due = target;
  });
  toast(`Reportée à ${fmtDate(target).toLowerCase()}`, {
    label: 'Annuler',
    run: () =>
      update((d) => {
        const t = d.tasks.find((x) => x.id === id);
        if (t) t.due = before;
      })
  });
}

export function moveTasksTo(ids: string[], day: string) {
  const before = new Map(getState().tasks.filter((t) => ids.includes(t.id)).map((t) => [t.id, t.due]));
  update((d) => d.tasks.forEach((t) => ids.includes(t.id) && (t.due = day)));
  toast(`${ids.length} tâche${ids.length > 1 ? 's' : ''} pour ${fmtDate(day).toLowerCase()}`, {
    label: 'Annuler',
    run: () => update((d) => d.tasks.forEach((t) => before.has(t.id) && (t.due = before.get(t.id))))
  });
}

export function projectFromTag(text: string) {
  const tag = text.match(/(^|\s)#(\S+)/);
  if (!tag) return null;
  const q = tag[2].toLowerCase();
  const p = getState().projects.find((x) => !x.archived && x.name.toLowerCase().replace(/\s+/g, '').startsWith(q));
  return p ? { project: p, tag: tag[0] } : null;
}

// « Appeler le comptable #revna @14:30 #urgent » → tâche dans le projet Revna avec heure et tag.
export function addTaskFromText(
  text: string,
  opts: {
    due?: string;
    dueTime?: string;
    projectId?: string;
    priority?: Priority;
    recurrence?: TaskRecurrence;
    estimateMinutes?: number;
    reminder?: TaskReminder;
    tags?: string[];
    url?: string;
  } = {}
): Task | null {
  const s = getState();
  let title = text.trim();
  if (!title) return null;
  let projectId = opts.projectId;
  const tags: string[] = [...(opts.tags || [])];
  let dueTime = opts.dueTime;

  // Détection d'heure @HH:MM
  const timeMatch = title.match(/(^|\s)@(\d{1,2}:\d{2})/);
  if (timeMatch) {
    dueTime = timeMatch[2].padStart(5, '0');
    title = title.replace(timeMatch[0], ' ');
  }

  // Projet via #nom-du-projet
  const found = projectFromTag(title);
  if (found) {
    projectId = found.project.id;
    title = title.replace(found.tag, ' ');
  }

  // Autres tags #mot
  const otherTags = title.match(/(^|\s)#([a-zA-Z0-9_\-]+)/g);
  if (otherTags) {
    for (const raw of otherTags) {
      const clean = raw.trim().replace(/^#/, '');
      if (clean && !tags.includes(clean)) tags.push(clean);
      title = title.replace(raw, ' ');
    }
  }

  title = title.replace(/\s+/g, ' ').trim();
  if (!projectId) projectId = s.projects.find((p) => p.name === 'Général')?.id || s.projects[0]?.id || '';

  const task: Task = {
    id: uid(),
    projectId,
    title,
    notes: '',
    status: 'todo',
    priority: opts.priority || 'none',
    due: opts.due,
    dueTime,
    reminder: opts.reminder,
    recurrence: opts.recurrence,
    estimateMinutes: opts.estimateMinutes,
    tags: tags.length ? tags : undefined,
    url: opts.url,
    checklist: [],
    createdAt: Date.now(),
    order: s.tasks.filter((t) => t.projectId === projectId && t.status === 'todo').length
  };

  update((d) => {
    d.tasks.push(task);
  });
  return task;
}
