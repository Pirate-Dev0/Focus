import type { State, Exercise, Habit } from './types';
import { uid } from './utils';

// Données de départ importées depuis le Notion « QG — Lock In » (9 nov. 2026)
export function seed(): State {
  const ex = (name: string, group: string): Exercise => ({ id: uid(), name, group });
  const exercises: Exercise[] = [
    ex('Développé couché', 'Pecs'),
    ex('Développé incliné haltères', 'Pecs'),
    ex('Écarté poulie', 'Pecs'),
    ex('Dips', 'Pecs'),
    ex('Développé militaire', 'Épaules'),
    ex('Élévations latérales', 'Épaules'),
    ex('Face pull', 'Épaules'),
    ex('Extension triceps poulie', 'Triceps'),
    ex('Barre au front', 'Triceps'),
    ex('Tractions', 'Dos'),
    ex('Rowing barre', 'Dos'),
    ex('Tirage vertical', 'Dos'),
    ex('Rowing haltère', 'Dos'),
    ex('Curl biceps barre', 'Biceps'),
    ex('Curl marteau', 'Biceps'),
    ex('Squat', 'Jambes'),
    ex('Presse à cuisses', 'Jambes'),
    ex('Soulevé de terre roumain', 'Jambes'),
    ex('Leg curl', 'Jambes'),
    ex('Leg extension', 'Jambes'),
    ex('Mollets debout', 'Jambes')
  ];
  const byName = (n: string) => exercises.find((e) => e.name === n)!.id;

  const habit = (name: string, days = [0, 1, 2, 3, 4, 5, 6]): Habit => ({ id: uid(), name, days, done: [], archived: false });

  const revna = uid(), waketap = uid(), vinted = uid(), tiktok = uid(), general = uid();
  const now = Date.now();

  return {
    version: 1,
    updatedAt: 0, // 0 = jamais modifié : le cloud gagne toujours au premier login
    settings: {
      name: 'Ethan',
      home: { order: ['tasks', 'habits', 'goal', 'upcoming', 'overview'], hidden: [] },
      goal: { title: '10 000 € de MRR', target: 10000, deadline: '2027-12-31', start: 0 },
      theme: 'system',
      notifyHabitsHour: 21,
      notifyDeadlinesHour: 9,
      vapidPublicKey: ''
    },
    projects: [
      { id: waketap, name: 'WakeTap', kind: 'App mobile', status: 'lance', priority: 'p0', deadline: '2026-11-30', mrr: 0, countsInMrr: true, gauge: { mode: 'mrr', label: 'MRR', current: 0, target: 10000 }, archived: false, createdAt: now },
      { id: tiktok, name: 'TikTok / Shorts', kind: 'Revenu passif', status: 'lance', priority: 'p1', mrr: 0, countsInMrr: true, gauge: { mode: 'mrr', label: 'MRR', current: 0, target: null }, archived: false, createdAt: now },
      { id: revna, name: 'Revna', kind: 'SaaS', status: 'construction', priority: 'p2', link: 'https://revna.fr', mrr: 0, countsInMrr: true, gauge: { mode: 'mrr', label: 'MRR', current: 0, target: 10000 }, archived: false, createdAt: now },
      { id: vinted, name: 'Vinted', kind: 'Revente', status: 'idee', priority: 'p2', mrr: 0, countsInMrr: false, gauge: { mode: 'custom', label: 'Bénéfice / mois (€)', current: 200, target: 5000 }, archived: false, createdAt: now },
      { id: general, name: 'Général', kind: 'Perso', status: 'lance', priority: 'none', mrr: 0, countsInMrr: false, gauge: { mode: 'custom', label: 'Progression', current: 0, target: null }, archived: false, createdAt: now }
    ],
    tasks: [
      { id: uid(), projectId: general, title: 'Renseigner le MRR actuel de chaque projet', notes: 'Pour que la progression vers 10k soit juste dès le départ.', status: 'todo', priority: 'p0', due: '2026-11-09', checklist: [], createdAt: now, order: 0 },
      { id: uid(), projectId: general, title: 'Première revue hebdo (dimanche)', notes: '', status: 'todo', priority: 'p1', due: '2026-11-15', checklist: [], createdAt: now, order: 1 },
      { id: uid(), projectId: revna, title: 'Page setting', notes: "Reprise de l'ancienne base Revio — Suivi tâches journalières.", status: 'todo', priority: 'p2', checklist: [], createdAt: now, order: 0 }
    ],
    habits: [
      habit('Salle', [1, 2, 3, 4, 5]),
      habit('Manger assez (prise de masse)'),
      habit('Boire 2 L d’eau'),
      habit('Deep work 2 h'),
      habit('Lire 20 min'),
      habit('Au lit avant minuit')
    ],
    exercises,
    routines: [
      { id: uid(), name: 'Push', exerciseIds: ['Développé couché', 'Développé incliné haltères', 'Développé militaire', 'Élévations latérales', 'Extension triceps poulie'].map(byName) },
      { id: uid(), name: 'Pull', exerciseIds: ['Tractions', 'Rowing barre', 'Tirage vertical', 'Face pull', 'Curl biceps barre', 'Curl marteau'].map(byName) },
      { id: uid(), name: 'Legs', exerciseIds: ['Squat', 'Presse à cuisses', 'Soulevé de terre roumain', 'Leg curl', 'Mollets debout'].map(byName) }
    ],
    workouts: [],
    bodyWeights: [],
    expenses: [],
    vinted: [],
    mrrHistory: [],
    pushSubs: []
  };
}
