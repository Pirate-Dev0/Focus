import iconUrl from './assets/icon.svg';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { CalendarCheck, FolderKanban, HeartPulse, Plus, Settings as SettingsIcon, Wallet as WalletIcon, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useAppState } from './store';
import { useRoute, go, parsePath, tabOf, depthOf, TABS, type TabName } from './router';
import { startSync, useSyncStatus } from './sync';
import { primeKeyboard, Toaster } from './components/ui';
import { QuickAdd } from './components/QuickAdd';
import { openTasksFor, today } from './utils';
import Dashboard from './views/Dashboard';
import Life from './views/Life';
import Wallet from './views/Wallet';
import Projects from './views/Projects';
import Board from './views/Board';
import Settings from './views/Settings';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function useTheme() {
  const theme = useAppState().settings.theme;
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0b0b0c' : '#fbfbfb'));
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

const NAV: { name: TabName; label: string; short: string; icon: typeof CalendarCheck }[] = [
  { name: 'home', label: "Aujourd'hui", short: "Aujourd'hui", icon: CalendarCheck },
  { name: 'life', label: 'Life', short: 'Life', icon: HeartPulse },
  { name: 'wallet', label: 'Portefeuille', short: 'Portefeuille', icon: WalletIcon },
  { name: 'projects', label: 'Projets', short: 'Projets', icon: FolderKanban }
];

export function SyncBadge({ compact }: { compact?: boolean }) {
  const s = useSyncStatus();
  if (s === 'local') return null;
  // sur l'accueil iPhone on ne montre rien quand tout va bien : moins de bruit
  if (compact && s === 'synced') return null;
  const Icon = s === 'syncing' ? Loader2 : s === 'synced' ? Cloud : CloudOff;
  const label = s === 'syncing' ? 'Synchro…' : s === 'synced' ? 'Synchronisé' : s === 'offline' ? 'Hors ligne' : 'Erreur de synchro';
  return (
    <span className={'row small sync-badge' + (s === 'error' ? ' danger-text' : ' faint')} style={{ gap: 6 }} title={label}>
      <Icon size={13} className={s === 'syncing' ? 'spin' : ''} /> {(!compact || s !== 'syncing') && <span>{label}</span>}
    </span>
  );
}

function Page({ path }: { path: string }) {
  const r = parsePath(path);
  switch (r.name) {
    case 'life': return <Life tab={r.param} />;
    case 'wallet': return <Wallet tab={r.param} />;
    case 'projects': return <Projects />;
    case 'project': return <Board id={r.param!} />;
    case 'settings': return <Settings />;
    default: return <Dashboard />;
  }
}

export default function App() {
  useTheme();
  const s = useAppState();
  const { path } = useRoute();
  const activeTab = tabOf(path);
  const [quick, setQuick] = useState(false);

  // Chaque onglet reste monté et garde sa dernière page : on revient exactement où on était.
  const [paths, setPaths] = useState<Record<TabName, string>>(() => ({ home: 'home', life: 'life', wallet: 'wallet', projects: 'projects', [activeTab]: path }));
  const [visited, setVisited] = useState<TabName[]>([activeTab]);
  const tabPaths = { ...paths, [activeTab]: path };
  if (paths[activeTab] !== path) setPaths(tabPaths);
  if (!visited.includes(activeTab)) setVisited([...visited, activeTab]);

  // Sens de l'animation : on « entre » dans un projet / les réglages, ou on en « revient ».
  const prevPath = useRef(path);
  const anim = useRef<Record<string, string>>({});
  if (prevPath.current !== path) {
    if (tabOf(prevPath.current) === activeTab) {
      const d = depthOf(path) - depthOf(prevPath.current);
      anim.current[path] = d > 0 ? 'push' : d < 0 ? 'pop' : '';
    } else anim.current[path] = '';
    prevPath.current = path;
  }

  // Position de défilement mémorisée par page
  const scrolls = useRef<Record<string, number>>({});
  const shown = useRef(path);
  useEffect(() => {
    const onScroll = () => (scrolls.current[shown.current] = window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useLayoutEffect(() => {
    if (shown.current === path) return;
    shown.current = path;
    window.scrollTo(0, scrolls.current[path] || 0);
  }, [path]);

  useEffect(() => {
    startSync();
  }, []);

  const tapTab = (t: TabName) => {
    if (t !== activeTab) return go(tabPaths[t]);
    // onglet déjà actif : on revient à sa racine, puis on remonte en haut (comme sur iOS)
    if (depthOf(path) > 0) go(t);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openQuick = () => {
    primeKeyboard();
    setQuick(true);
  };

  // Raccourcis clavier sur ordi
  const tapRef = useRef(tapTab);
  tapRef.current = tapTab;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable]') || document.querySelector('.sheet')) return;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || ((e.key === 'c' || e.key === 'n') && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        setQuick(true);
      }
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i >= 0 && !e.metaKey && !e.ctrlKey) tapRef.current(TABS[i]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const todayCount = openTasksFor(s.tasks, today()).length;
  const navActive = parsePath(path).name === 'settings' ? 'settings' : activeTab;

  return (
    <div className="app">
      <div className="statusbar-veil" aria-hidden="true" />

      <aside className="sidebar">
        <div className="brand"><img src={iconUrl} alt="" /> Focus</div>
        <button className="nav-item" onClick={() => setQuick(true)}>
          <Plus size={16} /> Ajout rapide <kbd>C</kbd>
        </button>
        <div className="nav-sep" />
        {NAV.map((n, i) => (
          <button key={n.name} className={'nav-item' + (navActive === n.name ? ' active' : '')} onClick={() => tapTab(n.name)}>
            <n.icon size={16} /> {n.label}
            {n.name === 'home' && todayCount > 0 && <span className="nav-count">{todayCount}</span>}
            <kbd>{i + 1}</kbd>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: '0 10px 8px' }}><SyncBadge /></div>
        <button className={'nav-item' + (navActive === 'settings' ? ' active' : '')} onClick={() => go('settings')}>
          <SettingsIcon size={16} /> Réglages
        </button>
      </aside>

      <main className="main">
        {TABS.filter((t) => visited.includes(t)).map((t) => (
          <div key={t} className="container" hidden={t !== activeTab}>
            <div key={tabPaths[t]} className={'page' + (t === activeTab && anim.current[tabPaths[t]] ? ' page-' + anim.current[tabPaths[t]] : '')}>
              <Page path={tabPaths[t]} />
            </div>
          </div>
        ))}
      </main>

      {/* Barre d'onglets façon iOS : une capsule en verre flottante + le bouton « + » à part */}
      <nav className="tabbar">
        <div className="tabbar-pill" style={{ '--i': TABS.indexOf(activeTab) } as CSSProperties}>
          <span className="tab-lens" aria-hidden="true" />
          {NAV.map((n) => <TabButton key={n.name} n={n} active={activeTab === n.name} badge={n.name === 'home' ? todayCount : 0} onTap={() => tapTab(n.name)} />)}
        </div>
        <button className="tab-plus" onClick={openQuick} aria-label="Ajout rapide">
          <Plus size={26} strokeWidth={2.4} />
        </button>
      </nav>

      <QuickAdd open={quick} onClose={() => setQuick(false)} defaultProject={parsePath(path).name === 'project' ? parsePath(path).param : undefined} defaultDue={activeTab === 'home' ? today() : undefined} />
      <Toaster />
    </div>
  );
}

function TabButton({ n, active, badge = 0, onTap }: { n: (typeof NAV)[number]; active: boolean; badge?: number; onTap: () => void }) {
  return (
    <button className={'tab' + (active ? ' active' : '')} onClick={onTap} aria-current={active ? 'page' : undefined}>
      <span className="tab-icon">
        <n.icon size={23} strokeWidth={active ? 2.2 : 1.8} />
        {badge > 0 && <span className="tab-badge">{badge > 9 ? '9+' : badge}</span>}
      </span>
      <span className="tab-label">{n.short}</span>
    </button>
  );
}
