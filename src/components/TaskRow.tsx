import { useState } from 'react';
import { Bell, CalendarClock, Check as CheckIcon, Clock, ExternalLink, ListChecks, Repeat, Sparkles, Tag } from 'lucide-react';
import type { Task } from '../types';
import { postponeTask, setTaskDone } from '../actions';
import { daysBetween, fmtDate, fmtDuration, haptic, today } from '../utils';
import { Check, PriorityIcon } from './ui';
import { SwipeRow } from './SwipeRow';

/* Une tâche dans une liste : on coche (petite pause pour voir la coche avant qu'elle parte),
   on glisse → pour terminer, ← pour reporter à demain, on touche pour ouvrir. */
export function TaskRow({ task, project, onOpen, day }: { task: Task; project?: string; onOpen: () => void; day?: string }) {
  const [ticking, setTicking] = useState(false);
  const done = task.status === 'done';
  const t = today();
  const late = !done && !!task.due && task.due < t;
  const showDue = task.due && (late || task.due !== (day || t));
  const cl = task.checklist.length;
  const cd = task.checklist.filter((c) => c.done).length;

  const toggle = () => {
    haptic();
    if (done) return setTaskDone(task.id, false);
    setTicking(true);
    setTimeout(() => {
      setTaskDone(task.id, true);
      setTicking(false);
    }, 320);
  };

  const meta = [
    task.source === 'claude' ? (
      <span key="cl" className="chip chip-xs chip-claude" title="Ajoutée par Claude">
        <Sparkles size={10} /> Claude
      </span>
    ) : null,
    project && project !== 'Général' ? <span key="p">{project}</span> : null,
    task.recurrence ? (
      <span key="rec" className="chip chip-xs" title="Tâche récurrente">
        <Repeat size={10} /> {task.recurrence.freq === 'daily' ? '1j' : task.recurrence.freq === 'weekdays' ? 'L-V' : task.recurrence.freq === 'weekly' ? '1sem' : task.recurrence.freq === 'monthly' ? '1m' : 'Auto'}
      </span>
    ) : null,
    task.dueTime ? (
      <span key="tm" className="chip chip-xs">
        <Clock size={10} /> {task.dueTime}
      </span>
    ) : null,
    task.reminder?.enabled ? (
      <span key="rem" className="chip chip-xs" title="Rappel programmé">
        <Bell size={10} />
      </span>
    ) : null,
    task.estimateMinutes ? (
      <span key="est" className="chip chip-xs">
        {fmtDuration(task.estimateMinutes)}
      </span>
    ) : null,
    task.status === 'doing' ? <span key="s" className="chip chip-xs">En cours</span> : null,
    task.status === 'blocked' ? <span key="b" className="chip chip-xs danger">Bloqué</span> : null,
    showDue ? <span key="d" className={'chip chip-xs' + (late ? ' danger' : '')}>{late && daysBetween(task.due!, t) > 1 ? `${daysBetween(task.due!, t)} j de retard` : fmtDate(task.due)}</span> : null,
    cl ? <span key="c" className="row" style={{ gap: 3 }}><ListChecks size={12} /> {cd}/{cl}</span> : null,
    task.tags?.map((tg) => (
      <span key={'tag-' + tg} className="chip chip-xs">
        <Tag size={9} /> #{tg}
      </span>
    )),
    task.url ? (
      <a
        key="link"
        href={task.url}
        target="_blank"
        rel="noreferrer"
        className="chip chip-xs"
        style={{ color: 'var(--accent)' }}
        onClick={(e) => e.stopPropagation()}
        title="Ouvrir le lien"
      >
        <ExternalLink size={10} /> Lien
      </a>
    ) : null
  ].filter(Boolean);

  return (
    <SwipeRow
      onRight={done ? undefined : () => setTaskDone(task.id, true)}
      onLeft={done ? undefined : () => postponeTask(task.id)}
      right={<><CheckIcon size={18} strokeWidth={2.6} /> Fait</>}
      left={<>Demain <CalendarClock size={18} /></>}
    >
      <div className={'task-row' + (done || ticking ? ' is-done' : '')} onClick={onOpen} role="button" tabIndex={0}>
        <Check on={done || ticking} onClick={toggle} />
        <div className="grow">
          <div className="task-title">{task.title}</div>
          {meta.length > 0 && <div className="task-meta">{meta}</div>}
        </div>
        {task.priority !== 'none' && !done && <PriorityIcon p={task.priority} />}
      </div>
    </SwipeRow>
  );
}
