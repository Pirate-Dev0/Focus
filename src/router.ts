import { useSyncExternalStore } from 'react';

const sub = (l: () => void) => {
  window.addEventListener('hashchange', l);
  return () => window.removeEventListener('hashchange', l);
};

export const pathOf = (hash: string) => hash.replace(/^#\/?/, '').split('/').filter(Boolean).join('/') || 'home';

export function parsePath(path: string) {
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || 'home', param: parts[1], sub: parts[2] };
}

export function useRoute() {
  const h = useSyncExternalStore(sub, () => window.location.hash);
  const path = pathOf(h);
  return { path, ...parsePath(path) };
}

// Les onglets de navigation (sidebar ordi & barre du bas mobile)
export type TabName = 'home' | 'life' | 'wallet' | 'projects' | 'dev';
export const TABS: TabName[] = ['home', 'life', 'wallet', 'projects', 'dev'];
export function tabOf(path: string): TabName {
  const n = parsePath(path).name;
  if (n === 'project') return 'projects';
  if (n === 'life' || n === 'wallet' || n === 'projects' || n === 'dev') return n;
  return 'home';
}
// profondeur de navigation, pour savoir si on « entre » (glisse depuis la droite) ou si on « revient »
export const depthOf = (path: string) => (['project', 'settings'].includes(parsePath(path).name) ? 1 : 0);

// Le défilement est géré par le shell (App) : chaque page retrouve sa position.
export function go(path: string) {
  const next = '#/' + path.replace(/^\//, '');
  if (window.location.hash !== next) window.location.hash = next;
}
