export type Status = 'todo' | 'doing' | 'blocked' | 'done';
export type Priority = 'p0' | 'p1' | 'p2' | 'p3' | 'none';
export type ProjectStatus = 'idee' | 'construction' | 'lance' | 'croissance' | 'pause' | 'termine';

export type RecurrenceFreq = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'after_completion';
export interface TaskRecurrence {
  freq: RecurrenceFreq;
  interval?: number; // intervalle (ex: tous les 2 jours / tous les 3 mois)
  daysOfWeek?: number[]; // pour hebdomadaire sur jours précis (0 = dimanche)
}

export interface TaskReminder {
  enabled: boolean;
  offsetMinutes: number; // 0 = à l'heure pile, 15 = 15m avant, 60 = 1h avant, 1440 = 1 jour avant
  customTime?: string; // HH:MM
}

export interface ChecklistItem { id: string; text: string; done: boolean }

export interface Task {
  id: string;
  projectId: string;
  title: string;
  notes: string;
  status: Status;
  priority: Priority;
  due?: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  startDate?: string; // YYYY-MM-DD
  reminder?: TaskReminder;
  recurrence?: TaskRecurrence;
  estimateMinutes?: number; // 15, 30, 45, 60, 90, 120...
  tags?: string[];
  url?: string;
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

export type HabitKind = 'boolean' | 'numeric';
export type TimeOfDay = 'any' | 'morning' | 'afternoon' | 'evening';
export type HabitFrequencyType = 'days' | 'times_per_week';

export interface Habit {
  id: string;
  name: string;
  emoji?: string;
  icon?: string; // nom d'une icône Lucide (prioritaire sur l'emoji)
  color?: string;
  days: number[]; // 0 = dimanche
  frequencyType?: HabitFrequencyType;
  timesPerWeek?: number; // cible : X fois par semaine
  kind?: HabitKind;
  targetValue?: number; // ex: 2 (L), 20 (pages), 10000 (pas)
  unit?: string; // ex: "L", "pages", "pas", "min"
  step?: number; // incrément par tap (ex: 0.5, 5, 1000)
  values?: Record<string, number>; // progression par date YYYY-MM-DD
  timeOfDay?: TimeOfDay;
  reminderTime?: string; // HH:MM (ex: "08:30")
  freezes?: string[]; // dates où un joker/freeze a été utilisé
  streakGoal?: number; // ex: 30 jours
  done: string[]; // dates YYYY-MM-DD validées
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

export type HomeSection = 'tasks' | 'habits' | 'goal' | 'upcoming' | 'overview';

export type AiServiceUnit = 'tokens' | 'credits' | 'chars' | 'usd';

export interface AiService {
  id: string;
  name: string; // Ex: Claude (Anthropic), Google Antigravity, ElevenLabs
  category?: 'llm' | 'voice' | 'image' | 'code' | 'other';
  icon?: string;
  color?: string;
  plan: string; // Ex: Pro, Pay-as-you-go, Tier 2
  used: number;
  limit?: number;
  unit: AiServiceUnit;
  costUsd?: number;
  budgetUsd?: number;
  resetDate?: string; // YYYY-MM-DD
  notes?: string;
  updatedAt: number;
}

export interface AgentStep {
  id: string;
  title: string;
  details?: string;
  codeSnippet?: string;
  done: boolean;
}

export interface AgentAction {
  id: string;
  agentName: string; // Ex: Google Antigravity, Claude, Cursor
  title: string;
  reason: string; // Motif de l'intervention manuelle
  steps: AgentStep[];
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: number;
  completedAt?: number;
  responsePayload?: string;
}

export interface DevState {
  devModeActive: boolean;
  bridgePort?: number;
  services: AiService[];
  actions: AgentAction[];
}

export interface Settings {
  name: string;
  home?: { order: HomeSection[]; hidden: HomeSection[] };
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
  dev: DevState;
}
