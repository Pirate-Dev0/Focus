import { useState } from 'react';
import { ChevronRight, Plus, Trash2, Archive } from 'lucide-react';
import { update, useAppState } from '../store';
import { go } from '../router';
import { Field, NumInput, PriorityIcon, Progress, Segmented, Sheet, toast } from '../components/ui';
import type { Project, ProjectStatus } from '../types';
import { eur, fmtDate, num, PRIORITIES, PRIORITY_LABEL, prioRank, PROJECT_STATUS_LABEL, uid } from '../utils';

export default function Projects() {
  const s = useAppState();
  const [edit, setEdit] = useState<Project | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const projects = s.projects
    .filter((p) => p.archived === showArchived)
    .sort((a, b) => Number(a.name === 'Général') - Number(b.name === 'Général') || prioRank(a.priority) - prioRank(b.priority));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Projets</h1>
          <div className="page-sub">Un tableau par projet, une jauge par objectif.</div>
        </div>
        <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={15} /> Projet</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {projects.map((p) => <ProjectCard key={p.id} p={p} />)}
      </div>
      {s.projects.some((p) => p.archived) && (
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setShowArchived(!showArchived)}>
          <Archive size={14} /> {showArchived ? 'Voir les projets actifs' : 'Voir les archives'}
        </button>
      )}
      {edit && <ProjectSheet project={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function ProjectCard({ p }: { p: Project }) {
  const s = useAppState();
  const tasks = s.tasks.filter((t) => t.projectId === p.id);
  const open = tasks.filter((t) => t.status !== 'done').length;
  const doing = tasks.filter((t) => t.status === 'doing').length;
  const cur = p.gauge.mode === 'mrr' ? p.mrr : p.gauge.current;
  const isMoney = p.gauge.mode === 'mrr' || p.gauge.label.includes('€');
  return (
    <button className="card card-click card-pad" onClick={() => go('project/' + p.id)}>
      <div className="row-between" style={{ marginBottom: 2 }}>
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <PriorityIcon p={p.priority} />
          <span style={{ fontWeight: 600, fontSize: 15 }} className="ellipsis">{p.name}</span>
        </div>
        <ChevronRight size={16} className="faint" />
      </div>
      <div className="faint small" style={{ marginBottom: 14 }}>
        {p.kind} · {PROJECT_STATUS_LABEL[p.status]}{p.deadline ? ` · ${fmtDate(p.deadline)}` : ''}
      </div>
      <div className="row-between small" style={{ marginBottom: 6 }}>
        <span className="muted">{p.gauge.mode === 'mrr' ? 'MRR' : p.gauge.label}</span>
        <span className="mono" style={{ fontWeight: 500 }}>
          {isMoney ? eur(cur) : num(cur)}
          {p.gauge.target ? <span className="faint"> / {isMoney ? eur(p.gauge.target) : num(p.gauge.target)}</span> : ''}
        </span>
      </div>
      <Progress value={cur} max={p.gauge.target} height={5} />
      <div className="row" style={{ marginTop: 14, gap: 6 }}>
        <span className="chip">{open} ouverte{open > 1 ? 's' : ''}</span>
        {doing > 0 && <span className="chip">{doing} en cours</span>}
      </div>
    </button>
  );
}

export function ProjectSheet({ project, onClose }: { project: Project | 'new'; onClose: () => void }) {
  const isNew = project === 'new';
  const [p, setP] = useState<Project>(
    isNew
      ? { id: uid(), name: '', kind: 'SaaS', status: 'idee', priority: 'p2', mrr: 0, countsInMrr: true, gauge: { mode: 'mrr', label: 'MRR', current: 0, target: 1000 }, archived: false, createdAt: Date.now() }
      : JSON.parse(JSON.stringify(project))
  );
  const save = () => {
    if (!p.name.trim()) return;
    update((d) => {
      const i = d.projects.findIndex((x) => x.id === p.id);
      if (i >= 0) d.projects[i] = p;
      else d.projects.push(p);
    });
    onClose();
    if (isNew) go('project/' + p.id);
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'Nouveau projet' : 'Réglages du projet'}
      actions={!isNew && (
        <>
          <button className="icon-btn" title="Archiver" onClick={() => { update((d) => { const x = d.projects.find((k) => k.id === p.id)!; x.archived = !x.archived; }); toast(p.archived ? 'Projet restauré' : 'Projet archivé'); onClose(); go('projects'); }}><Archive size={16} /></button>
          <button className="icon-btn" title="Supprimer" onClick={() => { if (confirm(`Supprimer « ${p.name} » et toutes ses tâches ?`)) { update((d) => { d.projects = d.projects.filter((x) => x.id !== p.id); d.tasks = d.tasks.filter((t) => t.projectId !== p.id); }); onClose(); go('projects'); } }}><Trash2 size={16} /></button>
        </>
      )}
    >
      <Field label="Nom"><input className="input" autoFocus={isNew} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="Ex : Revna" /></Field>
      <div className="field-row">
        <Field label="Type"><input className="input" list="kinds" value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value })} /></Field>
        <Field label="Statut">
          <select className="input" value={p.status} onChange={(e) => setP({ ...p, status: e.target.value as ProjectStatus })}>
            {Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <datalist id="kinds">{['SaaS', 'App mobile', 'Revenu passif', 'Revente', 'Contenu', 'Perso'].map((k) => <option key={k} value={k} />)}</datalist>
      <div className="field-row">
        <Field label="Priorité">
          <select className="input" value={p.priority} onChange={(e) => setP({ ...p, priority: e.target.value as Project['priority'] })}>
            {PRIORITIES.map((k) => <option key={k} value={k}>{PRIORITY_LABEL[k]}</option>)}
          </select>
        </Field>
        <Field label="Deadline"><input type="date" className="input" value={p.deadline || ''} onChange={(e) => setP({ ...p, deadline: e.target.value || undefined })} /></Field>
      </div>
      <Field label="Lien"><input className="input" value={p.link || ''} onChange={(e) => setP({ ...p, link: e.target.value || undefined })} placeholder="https://" /></Field>

      <div className="divider" />
      <Field label="Jauge d'objectif">
        <Segmented full value={p.gauge.mode} onChange={(m) => setP({ ...p, gauge: { ...p.gauge, mode: m, label: m === 'mrr' ? 'MRR' : p.gauge.label === 'MRR' ? '' : p.gauge.label } })} options={[{ value: 'mrr', label: 'MRR du projet' }, { value: 'custom', label: 'Objectif perso' }]} />
      </Field>
      {p.gauge.mode === 'custom' ? (
        <>
          <Field label="Ce que tu mesures"><input className="input" value={p.gauge.label} onChange={(e) => setP({ ...p, gauge: { ...p.gauge, label: e.target.value } })} placeholder="Ex : Restaurants clients, Abonnés…" /></Field>
          <div className="field-row">
            <Field label="Actuel"><NumInput value={p.gauge.current} onChange={(n) => setP({ ...p, gauge: { ...p.gauge, current: n } })} /></Field>
            <Field label="Cible"><NumInput value={p.gauge.target} onChange={(n) => setP({ ...p, gauge: { ...p.gauge, target: n || null } })} /></Field>
          </div>
        </>
      ) : (
        <div className="field-row">
          <Field label="MRR actuel (€)"><NumInput value={p.mrr} onChange={(n) => setP({ ...p, mrr: n })} /></Field>
          <Field label="MRR cible (€)"><NumInput value={p.gauge.target} onChange={(n) => setP({ ...p, gauge: { ...p.gauge, target: n || null } })} /></Field>
        </div>
      )}
      <label className="row" style={{ marginBottom: 18, cursor: 'pointer' }}>
        <input type="checkbox" checked={p.countsInMrr} onChange={(e) => setP({ ...p, countsInMrr: e.target.checked })} style={{ width: 18, height: 18, accentColor: 'var(--text)' }} />
        <span>Son MRR compte dans l'objectif principal</span>
      </label>
      <button className="btn btn-primary btn-lg btn-block" onClick={save}>{isNew ? 'Créer le projet' : 'Enregistrer'}</button>
    </Sheet>
  );
}
