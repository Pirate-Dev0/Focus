// Synchro via un repo GitHub PRIVÉ : tout l'état de Focus vit dans data.json.
// Aucun serveur : l'app parle directement à l'API GitHub avec un token perso.
import { useSyncExternalStore } from 'react';
import { getState, migrate, setLocalChangeHandler, setState, update } from './store';
import type { State } from './types';

export interface GhConfig { owner: string; repo: string; token: string; branch: string }
const CFG_KEY = 'focus.github';

export function getConfig(): GhConfig | null {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveConfig(c: GhConfig | null) {
  try {
    if (c) localStorage.setItem(CFG_KEY, JSON.stringify(c));
    else localStorage.removeItem(CFG_KEY);
  } catch {}
}

/* ---------- statut ---------- */
export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error';
let status: SyncStatus = getConfig() ? 'syncing' : 'local';
let lastSync: number | null = null;
let lastError: string | null = null;
const statusL = new Set<() => void>();
function setStatus(s: SyncStatus, err: string | null = null) {
  status = s;
  lastError = err;
  if (s === 'synced') lastSync = Date.now();
  statusL.forEach((l) => l());
}
export const syncInfo = () => ({ lastSync, lastError });
export function useSyncStatus() {
  return useSyncExternalStore(
    (l) => {
      statusL.add(l);
      return () => statusL.delete(l);
    },
    () => status
  );
}

/* ---------- API GitHub ---------- */
const b64encode = (str: string) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const b64decode = (b64: string) => {
  const bin = atob(b64.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

function gh(c: GhConfig, path: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com/repos/${c.owner}/${c.repo}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${c.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
}

let sha: string | null = null;

async function readRemote(c: GhConfig): Promise<State | null> {
  const res = await gh(c, `/contents/data.json?ref=${encodeURIComponent(c.branch)}`);
  if (res.status === 404) {
    sha = null;
    return null;
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const j = await res.json();
  sha = j.sha;
  return migrate(JSON.parse(b64decode(j.content)));
}

async function writeRemote(c: GhConfig, s: State, retry = true): Promise<void> {
  const res = await gh(c, '/contents/data.json', {
    method: 'PUT',
    body: JSON.stringify({
      message: `Focus · ${new Date().toLocaleString('fr-FR')}`,
      content: b64encode(JSON.stringify(s)),
      branch: c.branch,
      ...(sha ? { sha } : {})
    })
  });
  if ((res.status === 409 || res.status === 422) && retry) {
    // quelqu'un (l'autre appareil) a écrit entre-temps : on relit et on garde le plus récent
    const remote = await readRemote(c);
    if (remote && remote.updatedAt > getState().updatedAt) {
      setState(mergeSubs(remote, getState()), { remote: true });
      return;
    }
    return writeRemote(c, getState(), false);
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const j = await res.json();
  sha = j.content.sha;
}

// Les abonnements push de chaque appareil ne doivent jamais se perdre
function mergeSubs(winner: State, other: State): State {
  const subs = [...(winner.pushSubs || [])];
  for (const s of other.pushSubs || []) if (!subs.some((x) => x.endpoint === s.endpoint)) subs.push(s);
  return { ...winner, pushSubs: subs };
}

/* ---------- Consommation réelle des IA ----------
   usage.json : écrit toutes les heures par la GitHub Action du repo de données (ElevenLabs).
   usage-mac.json : écrit par le Mac (npm run usage) pour Claude Code et Antigravity.
   On les lit à part : ils ne font pas partie de l'état synchronisé, donc jamais de conflit avec data.json. */
export interface LiveService {
  plan?: string | null;
  used?: number;
  limit?: number | null;
  unit?: string;
  resetAt?: number | null;
  status?: string | null;
  error?: string;
  fetchedAt?: number;
  details?: { label: string; value: string }[];
  source?: 'cloud' | 'mac';
  seenAt?: number; // dernière fois que la source a écrit son fichier
}
export interface LiveUsage { updatedAt: number; services: Record<string, LiveService | undefined> }
const USAGE_KEY = 'focus.usage';
let usage: LiveUsage | null = (() => {
  try {
    return JSON.parse(localStorage.getItem(USAGE_KEY) || 'null');
  } catch {
    return null;
  }
})();
const USAGE_FILES = ['usage.json', 'usage-mac.json'] as const;
const usageSha: Record<string, string> = {};
const usageParts: Record<string, LiveUsage | undefined> = {};
const usageL = new Set<() => void>();
export function useLiveUsage() {
  return useSyncExternalStore(
    (l) => {
      usageL.add(l);
      return () => usageL.delete(l);
    },
    () => usage
  );
}

async function readUsageFile(c: GhConfig, name: string) {
  const res = await gh(c, `/contents/${name}?ref=${encodeURIComponent(c.branch)}`);
  if (!res.ok) return false; // 404 : rien d'écrit pour l'instant
  const j = await res.json();
  if (j.sha === usageSha[name]) return false;
  usageSha[name] = j.sha;
  usageParts[name] = JSON.parse(b64decode(j.content));
  return true;
}

async function readUsage(c: GhConfig) {
  try {
    const changed = (await Promise.all(USAGE_FILES.map((n) => readUsageFile(c, n)))).some(Boolean);
    if (!changed) return;
    const services: LiveUsage['services'] = {};
    for (const n of USAGE_FILES) {
      const part = usageParts[n];
      for (const [k, v] of Object.entries(part?.services || {})) {
        if (v) services[k] = { ...v, source: n === 'usage-mac.json' ? 'mac' : 'cloud', seenAt: part!.updatedAt };
      }
    }
    usage = { updatedAt: Date.now(), services };
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
    } catch {}
    usageL.forEach((l) => l());
  } catch {}
}

// Relance tout de suite la GitHub Action (rappels + consommation IA) sans attendre l'heure suivante
export async function refreshUsage() {
  const c = getConfig();
  if (!c) throw new Error('Connecte d’abord ton repo GitHub (Réglages → Synchro GitHub).');
  const res = await gh(c, '/actions/workflows/notify.yml/dispatches', {
    method: 'POST',
    body: JSON.stringify({ ref: c.branch, inputs: { test: 'false' } })
  });
  if (res.status === 403) throw new Error("Le token n'a pas la permission Actions : Read and write.");
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
}

/* ---------- boucle de synchro ---------- */
let queue: Promise<void> = Promise.resolve();
const serial = (fn: () => Promise<void>) => (queue = queue.then(fn, fn));
let timer: ReturnType<typeof setTimeout> | null = null;
let poll: ReturnType<typeof setInterval> | null = null;
let lastPushed = -1;

function push() {
  const c = getConfig();
  if (!c) return Promise.resolve();
  return serial(async () => {
    const s = getState();
    if (s.updatedAt === lastPushed) return setStatus('synced');
    try {
      setStatus('syncing');
      await writeRemote(c, s);
      lastPushed = getState().updatedAt;
      setStatus('synced');
    } catch (e: any) {
      setStatus(navigator.onLine ? 'error' : 'offline', e.message);
    }
  });
}

export function pull() {
  const c = getConfig();
  if (!c) return Promise.resolve();
  return serial(async () => {
    try {
      setStatus('syncing');
      const remote = await readRemote(c);
      const local = getState();
      if (!remote) {
        // premier appareil : on envoie les données de départ
        if (local.updatedAt === 0) setState({ ...local, updatedAt: Date.now() }, { remote: true });
        await writeRemote(c, getState());
        lastPushed = getState().updatedAt;
      } else if (remote.updatedAt > local.updatedAt) {
        setState(mergeSubs(remote, local), { remote: true });
        lastPushed = remote.updatedAt;
      } else if (local.updatedAt > remote.updatedAt) {
        await writeRemote(c, mergeSubs(local, remote));
        lastPushed = local.updatedAt;
      }
      setStatus('synced');
    } catch (e: any) {
      setStatus(navigator.onLine ? 'error' : 'offline', e.message);
    }
    void readUsage(c);
  });
}

let started = false;
export function startSync() {
  if (!getConfig() || started) return;
  started = true;
  setLocalChangeHandler(() => {
    if (timer) clearTimeout(timer);
    setStatus('syncing');
    timer = setTimeout(push, 2500); // regroupe les modifs en un seul commit
  });
  pull();
  document.addEventListener('visibilitychange', () => {
    if (!getConfig()) return;
    if (document.visibilityState === 'visible') pull();
    else if (timer) {
      clearTimeout(timer);
      timer = null;
      push();
    }
  });
  window.addEventListener('online', () => getConfig() && pull());
  poll = setInterval(() => document.visibilityState === 'visible' && !timer && pull(), 60000);
}

export async function connect(input: { owner: string; repo: string; token: string }) {
  const owner = input.owner.trim(), repo = input.repo.trim(), token = input.token.trim();
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    cache: 'no-store'
  });
  if (res.status === 401) throw new Error('Token invalide ou expiré.');
  if (res.status === 404) throw new Error(`Repo ${owner}/${repo} introuvable (ou le token n'y a pas accès).`);
  if (!res.ok) throw new Error(`Erreur GitHub ${res.status}`);
  const j = await res.json();
  if (!j.private) throw new Error('Ce repo est public ! Utilise un repo privé pour tes données.');
  if (j.permissions && !j.permissions.push) throw new Error("Le token n'a pas le droit d'écrire (Contents : Read and write).");
  saveConfig({ owner, repo, token, branch: j.default_branch || 'main' });
  sha = null;
  lastPushed = -1;
  startSync();
  await pull();
  await queue;
  if (status === 'error') throw new Error(lastError || 'Synchro impossible');
}

export function disconnect() {
  saveConfig(null);
  setLocalChangeHandler(null);
  if (poll) clearInterval(poll);
  started = false;
  setStatus('local');
}

export const isConnected = () => Boolean(getConfig());

/* ---------- Notifications push ---------- */
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushReady = () => Boolean(getConfig() && getState().settings.vapidPublicKey);

function b64ToUint8(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentEndpoint() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription())?.endpoint || null;
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("Installe d'abord Focus sur l'écran d'accueil (Safari → Partager → Sur l'écran d'accueil) puis ouvre-le depuis l'icône.");
  if (!getConfig()) throw new Error('Connecte d’abord ton repo GitHub (synchro).');
  const key = getState().settings.vapidPublicKey;
  if (!key) throw new Error('Colle d’abord ta clé publique VAPID (voir README).');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications refusées dans les réglages de l’iPhone.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) }));
  const j = sub.toJSON() as any;
  const device = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Mac/.test(navigator.userAgent) ? 'Mac' : 'Ordi';
  update((d) => {
    d.pushSubs = (d.pushSubs || []).filter((x) => x.endpoint !== sub.endpoint);
    d.pushSubs.push({ endpoint: sub.endpoint, keys: j.keys, device, addedAt: Date.now() });
  });
  await push();
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    update((d) => {
      d.pushSubs = (d.pushSubs || []).filter((x) => x.endpoint !== sub.endpoint);
    });
    await sub.unsubscribe();
  }
}

// Lance la GitHub Action de notifs en mode test
export async function testPush() {
  const c = getConfig();
  if (!c) throw new Error('Pas connecté à GitHub.');
  if (timer) { clearTimeout(timer); timer = null; }
  await push();
  const res = await gh(c, '/actions/workflows/notify.yml/dispatches', {
    method: 'POST',
    body: JSON.stringify({ ref: c.branch, inputs: { test: 'true' } })
  });
  if (res.status === 403) throw new Error("Le token n'a pas la permission Actions : Read and write.");
  if (res.status === 404) throw new Error('Workflow notify.yml introuvable dans le repo de données.');
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
}
