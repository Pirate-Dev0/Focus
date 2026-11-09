import { produce } from 'immer';
import { useSyncExternalStore } from 'react';
import type { State } from './types';
import { seed } from './seed';
import { mrrTotal, today } from './utils';

const KEY = 'focus.state.v1';
const listeners = new Set<() => void>();
let onLocalChange: ((s: State) => void) | null = null;

export function migrate(raw: any): State {
  const base = seed();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings || {}), goal: { ...base.settings.goal, ...(raw.settings?.goal || {}) } },
    dev: {
      devModeActive: raw.dev?.devModeActive ?? base.dev.devModeActive,
      bridgePort: raw.dev?.bridgePort ?? base.dev.bridgePort,
      services: Array.isArray(raw.dev?.services) && raw.dev.services.length > 0 ? raw.dev.services.map(cleanDemoService) : base.dev.services,
      actions: Array.isArray(raw.dev?.actions) ? raw.dev.actions.filter((a: any) => a?.title !== DEMO_ACTION_TITLE) : base.dev.actions
    }
  };
}

// Données de démo d'une première version de la page Dev : on les retire si elles traînent encore dans un état sauvegardé
const DEMO_ACTION_TITLE = 'Validation manuelle 2FA / Session GitHub';
const DEMO_USAGE: Record<string, [number, string]> = {
  'Claude (Anthropic)': [642000, 'Pro / API Tier 2'],
  'Google Antigravity': [1250000, 'Workspace Agentic'],
  ElevenLabs: [48500, 'Creator Plan']
};
function cleanDemoService(s: any) {
  const demo = DEMO_USAGE[s?.name];
  if (!demo || s.used !== demo[0] || s.plan !== demo[1]) return s;
  return { ...s, plan: '', used: 0, limit: undefined, costUsd: undefined, budgetUsd: undefined, resetDate: undefined, notes: undefined };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch {}
  return seed();
}

let state: State = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export const getState = () => state;

export function setState(next: State, opts: { remote?: boolean } = {}) {
  state = next;
  persist();
  listeners.forEach((l) => l());
  if (!opts.remote) onLocalChange?.(state);
}

export function update(fn: (draft: State) => void) {
  const prevMrr = mrrTotal(state);
  const next = produce(state, (d) => {
    fn(d);
    const total = mrrTotal(d as State);
    if (total !== prevMrr) {
      const t = today();
      const last = d.mrrHistory[d.mrrHistory.length - 1];
      if (last && last.date === t) last.total = total;
      else d.mrrHistory.push({ date: t, total });
    }
    d.updatedAt = Date.now();
  });
  setState(next);
}

export function setLocalChangeHandler(fn: ((s: State) => void) | null) {
  onLocalChange = fn;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useAppState(): State {
  return useSyncExternalStore(subscribe, () => state);
}
