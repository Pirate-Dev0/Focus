import { useRef, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent, closestCorners } from '@dnd-kit/core';
import { ArrowLeft, ExternalLink, ListChecks, Plus, Settings2, AlignLeft } from 'lucide-react';
import { update, useAppState } from '../store';
import { go } from '../router';
import { Check, PriorityIcon, Progress, StatusIcon, Empty } from '../components/ui';
import { setTaskDone } from '../actions';
import { DueChip, TaskSheet } from '../components/TaskSheet';
import { ProjectSheet } from './Projects';
import type { Status, Task } from '../types';
import { eur, haptic, num, prioRank, PROJECT_STATUS_LABEL, STATUSES, STATUS_LABEL, uid } from '../utils';

export default function Board({ id }: { id: string }) {
  const s = useAppState();
  const p = s.projects.find((x) => x.id === id);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [adding, setAdding] = useState<Status | null>(null);
  const [draft, setDraft] = useState('');
  const [activeCol, setActiveCol] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } })
  );

  if (!p) return <Empty title="Projet introuvable"><button className="btn" style={{ marginTop: 12 }} onClick={() => go('projects')}>Retour</button></Empty>;

  const tasks = s.tasks.filter((t) => t.projectId === id);
  const col = (st: Status) =>
    tasks
      .filter((t) => t.status === st)
      .sort((a, b) => (st === 'done' ? (b.doneAt || 0) - (a.doneAt || 0) : a.order - b.order || prioRank(a.priority) - prioRank(b.priority)));

  const onStart = (e: DragStartEvent) => {
    setDragId(String(e.active.id));
    haptic();
  };
  const onEnd = (e: DragEndEvent) => {
    setDragId(null);
    if (!e.over) return;
    const overId = String(e.over.id);
    const target = (STATUSES.includes(overId as Status) ? overId : s.tasks.find((t) => t.id === overId)?.status) as Status | undefined;
    if (!target) return;
    update((d) => {
      const t = d.tasks.find((x) => x.id === e.active.id)!;
      const overTask = d.tasks.find((x) => x.id === overId);
      t.status = target;
      t.doneAt = target === 'done' ? t.doneAt || Date.now() : undefined;
      // réordonne la colonne
      const list = d.tasks.filter((x) => x.projectId === id && x.status === target && x.id !== t.id).sort((a, b) => a.order - b.order);
      const idx = overTask && overTask.id !== t.id ? list.findIndex((x) => x.id === overTask.id) : list.length;
      list.splice(idx < 0 ? list.length : idx, 0, t);
      list.forEach((x, i) => (x.order = i));
    });
    haptic();
  };

  const addTask = (st: Status) => {
    if (!draft.trim()) { setAdding(null); return; }
    update((d) => {
      d.tasks.push({ id: uid(), projectId: id, title: draft.trim(), notes: '', status: st, priority: 'none', checklist: [], createdAt: Date.now(), order: -1, doneAt: st === 'done' ? Date.now() : undefined });
    });
    setDraft('');
  };

  const cur = p.gauge.mode === 'mrr' ? p.mrr : p.gauge.current;
  const isMoney = p.gauge.mode === 'mrr' || p.gauge.label.includes('€');
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const dragged = s.tasks.find((t) => t.id === dragId);

  // iPhone : une colonne à la fois, la barre du haut permet de sauter de l'une à l'autre
  const colLeft = (i: number) => {
    const b = boardRef.current;
    const c = b?.children[i] as HTMLElement | undefined;
    return b && c ? c.offsetLeft - b.offsetLeft - 16 : 0;
  };
  const jumpTo = (i: number) => {
    haptic();
    setActiveCol(i);
    boardRef.current?.scrollTo({ left: colLeft(i), behavior: 'smooth' });
  };
  const onBoardScroll = () => {
    const b = boardRef.current;
    if (!b) return;
    let best = 0;
    STATUSES.forEach((_, i) => { if (Math.abs(colLeft(i) - b.scrollLeft) < Math.abs(colLeft(best) - b.scrollLeft)) best = i; });
    if (best !== activeCol) setActiveCol(best);
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 6, gap: 4 }}>
        <button className="btn btn-ghost" style={{ paddingLeft: 4 }} onClick={() => go('projects')}><ArrowLeft size={16} /> Projets</button>
        <div style={{ flex: 1 }} />
        {p.link && <a className="icon-btn" href={p.link} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a>}
        <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Réglages du projet"><Settings2 size={17} /></button>
      </div>
      <div className="page-head" style={{ marginTop: 0 }}>
        <div className="grow">
          <div className="row" style={{ gap: 8 }}><PriorityIcon p={p.priority} size={16} /><h1 className="page-title">{p.name}</h1></div>
          <div className="page-sub">{p.kind} · {PROJECT_STATUS_LABEL[p.status]} · {done}/{total} tâches faites</div>
        </div>
      </div>

      <button className="card card-click card-pad" style={{ marginBottom: 18 }} onClick={() => setSettings(true)}>
        <div className="row-between small" style={{ marginBottom: 8 }}>
          <span className="muted">{p.gauge.mode === 'mrr' ? 'MRR' : p.gauge.label || 'Objectif'}</span>
          <span className="mono" style={{ fontWeight: 600, fontSize: 15 }}>
            {isMoney ? eur(cur) : num(cur)}
            {p.gauge.target ? <span className="faint" style={{ fontWeight: 500 }}> / {isMoney ? eur(p.gauge.target) : num(p.gauge.target)}</span> : <span className="faint" style={{ fontWeight: 500 }}> · définir une cible</span>}
          </span>
        </div>
        <Progress value={cur} max={p.gauge.target} height={6} />
      </button>

      <div className="col-tabs hide-desktop" role="tablist">
        {STATUSES.map((st, i) => (
          <button key={st} role="tab" aria-selected={activeCol === i} className={activeCol === i ? 'on' : ''} onClick={() => jumpTo(i)}>
            <StatusIcon status={st} size={13} /> {STATUS_LABEL[st]} <span className="count">{col(st).length}</span>
          </button>
        ))}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setDragId(null)}>
        <div className="board" ref={boardRef} onScroll={onBoardScroll}>
          {STATUSES.map((st) => (
            <Column key={st} status={st} count={col(st).length}>
              {col(st).map((t) => <CardItem key={t.id} t={t} onOpen={() => setOpenTask(t.id)} />)}
              {adding === st ? (
                <div className="kcard">
                  <textarea
                    autoFocus
                    className="input-bare"
                    rows={2}
                    style={{ fontSize: 14, resize: 'none' }}
                    placeholder="Titre de la carte…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addTask(st); }
                      if (e.key === 'Escape') { setAdding(null); setDraft(''); }
                    }}
                    onBlur={() => { addTask(st); setAdding(null); }}
                  />
                </div>
              ) : (
                <button className="add-card" onClick={() => { setAdding(st); setDraft(''); }}><Plus size={14} /> Ajouter</button>
              )}
            </Column>
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
          {dragged ? <CardBody t={dragged} className="kcard overlay" withCheck /> : null}
        </DragOverlay>
      </DndContext>

      <TaskSheet taskId={openTask} onClose={() => setOpenTask(null)} />
      {settings && <ProjectSheet project={p} onClose={() => setSettings(false)} />}
    </>
  );
}

function Column({ status, count, children }: { status: Status; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={'column' + (isOver ? ' over' : '')}>
      <div className="column-head">
        <StatusIcon status={status} />
        {STATUS_LABEL[status]}
        <span className="count">{count}</span>
      </div>
      <div className="column-body">{children}</div>
    </div>
  );
}

function CardItem({ t, onOpen }: { t: Task; onOpen: () => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: t.id });
  const drop = useDroppable({ id: t.id });
  return (
    <div ref={drop.setNodeRef}>
      <div ref={setNodeRef} {...attributes} {...listeners} onClick={onOpen}>
        <CardBody t={t} className={'kcard' + (isDragging ? ' dragging' : '')} withCheck />
      </div>
    </div>
  );
}

function CardBody({ t, className, withCheck }: { t: Task; className: string; withCheck?: boolean }) {
  const cl = t.checklist.length;
  const cd = t.checklist.filter((c) => c.done).length;
  const hasMeta = t.priority !== 'none' || t.due || cl || t.notes;
  return (
    <div className={className} style={{ cursor: 'pointer' }}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
        {withCheck && (
          // la coche ne doit pas démarrer un glisser-déposer
          <span onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} style={{ marginTop: -1 }}>
            <Check on={t.status === 'done'} onClick={() => { haptic(); setTaskDone(t.id, t.status !== 'done'); }} />
          </span>
        )}
        <div className="t grow" style={{ textDecoration: t.status === 'done' ? 'line-through' : undefined, color: t.status === 'done' ? 'var(--text-3)' : undefined }}>{t.title}</div>
      </div>
      {hasMeta ? (
        <div className="m" style={withCheck ? { paddingLeft: 32 } : undefined}>
          {t.priority !== 'none' && <PriorityIcon p={t.priority} size={13} />}
          <DueChip due={t.due} done={t.status === 'done'} />
          {cl > 0 && <span className="row" style={{ gap: 3 }}><ListChecks size={12} /> {cd}/{cl}</span>}
          {t.notes && <AlignLeft size={12} />}
        </div>
      ) : null}
    </div>
  );
}
