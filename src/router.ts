import { useSyncExternalStore } from 'react';

const sub = (l: () => void) => {
  window.addEventListener('hashchange', l);
  return () => window.removeEventListener('hashchange', l);
};
export function useRoute() {
  const h = useSyncExternalStore(sub, () => window.location.hash);
  const parts = h.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { name: parts[0] || 'home', param: parts[1], sub: parts[2] };
}
export function go(path: string) {
  window.location.hash = '/' + path.replace(/^\//, '');
  window.scrollTo({ top: 0 });
}
