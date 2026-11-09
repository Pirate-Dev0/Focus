// Actions sur les tâches partagées entre l'accueil, les projets et les fenêtres, avec « Annuler ».
import { getState, update } from './store';
import { toast } from './components/ui';
import { addDays, fmtDate, today, uid } from './utils';
import type { Priority, Task } from './types';

export function setTaskDone(id: string, done: boolean) {
  const prev = getState().tasks.find((t) => t.id === id);
  if (!prev) return;
  const before = { status: prev.status, doneAt: prev.doneAt };
  update((d) => {
    const t = d.tasks.find((x) => x.id === id);
    if (!t) return;
    t.status = done ? 'done' : prev.status === 'done' ? 'todo' : prev.status;
    t.doneAt = done ? Date.now() : undefined;
  });
  if (done)
    toast('Tâche terminée', {
      label: 'Annuler',
      run: () =>
        update((d) => {
          const t = d.tasks.find((x) => x.id === id);
          if (t) Object.assign(t, before);
        })
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

// « Appeler le comptable #revna » → tâche dans le projet Revna. Le # est optionnel.
export function addTaskFromText(text: string, opts: { due?: string; projectId?: string; priority?: Priority } = {}): Task | null {
  const s = getState();
  let title = text.trim();
  if (!title) return null;
  let projectId = opts.projectId;
  const found = projectFromTag(title);
  if (found) {
    projectId = found.project.id;
    title = title.replace(found.tag, ' ').replace(/\s+/g, ' ').trim();
  }
  if (!projectId) projectId = s.projects.find((p) => p.name === 'Général')?.id || s.projects[0]?.id || '';
  const task: Task = {
    id: uid(),
    projectId,
    title,
    notes: '',
    status: 'todo',
    priority: opts.priority || 'none',
    due: opts.due,
    checklist: [],
    createdAt: Date.now(),
    order: s.tasks.filter((t) => t.projectId === projectId && t.status === 'todo').length
  };
  update((d) => {
    d.tasks.push(task);
  });
  return task;
}
