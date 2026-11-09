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
    settings: { ...base.settings, ...(raw.settings || {}), goal: { ...base.settings.goal, ...(raw.settings?.goal || {}) } }
  };
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
