export type Status = 'todo' | 'doing' | 'blocked' | 'done';
export type Priority = 'p0' | 'p1' | 'p2' | 'p3' | 'none';
export type ProjectStatus = 'idee' | 'construction' | 'lance' | 'croissance' | 'pause' | 'termine';

export interface ChecklistItem { id: string; text: string; done: boolean }

export interface Task {
  id: string;
  projectId: string;
  title: string;
  notes: string;
  status: Status;
  priority: Priority;
  due?: string; // YYYY-MM-DD
  checklist: ChecklistItem[];
  createdAt: number;
  doneAt?: number;
  order: number;
}

export interface Gauge {
  mode: 'mrr' | 'custom';
  label: string;
  current: number;
  target: number | null;
}

export interface Project {
  id: string;
  name: string;
  kind: string; // SaaS, App mobile…
  status: ProjectStatus;
  priority: Priority;
  link?: string;
  deadline?: string;
  mrr: number;
  countsInMrr: boolean;
  gauge: Gauge;
  archived: boolean;
  createdAt: number;
}

export interface Habit {
  id: string;
  name: string;
  days: number[]; // 0 = dimanche
  done: string[]; // dates YYYY-MM-DD
  archived: boolean;
}

export interface Exercise { id: string; name: string; group: string }
export interface Routine { id: string; name: string; exerciseIds: string[] }
export interface WorkSet { w: number; r: number }
export interface WorkoutEntry { exerciseId: string; sets: WorkSet[] }
export interface Workout {
  id: string;
  date: string;
  name: string;
  routineId?: string;
  entries: WorkoutEntry[];
  startedAt: number;
  finishedAt?: number;
  note?: string;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  category: string;
  kind: 'mensuel' | 'ponctuel';
  date: string;
  active: boolean;
}

export type VintedStatus = 'achete' | 'en_vente' | 'vendu' | 'invendu';
export interface VintedItem {
  id: string;
  name: string;
  category: string;
  status: VintedStatus;
  buyPrice: number;
  buyFees: number;
  targetPrice?: number;
  sellPrice?: number;
  sellFees: number;
  buyDate: string;
  sellDate?: string;
  link?: string;
}

export interface Settings {
  name: string;
  goal: { title: string; target: number; deadline: string; start: number };
  theme: 'system' | 'light' | 'dark';
  notifyHabitsHour: number;
  notifyDeadlinesHour: number;
  vapidPublicKey?: string;
}

export interface State {
  version: 1;
  updatedAt: number;
  settings: Settings;
  projects: Project[];
  tasks: Task[];
  habits: Habit[];
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[];
  bodyWeights: { date: string; kg: number }[];
  expenses: Expense[];
  vinted: VintedItem[];
  mrrHistory: { date: string; total: number }[];
  pushSubs?: { endpoint: string; keys: { p256dh: string; auth: string }; device: string; addedAt: number }[];
}
