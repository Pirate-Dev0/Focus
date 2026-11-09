import iconUrl from './assets/icon.svg';
import { useEffect, useState } from 'react';
import { FolderKanban, Home, Plus, Settings as SettingsIcon, Sprout, Wallet as WalletIcon, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useAppState } from './store';
import { useRoute, go } from './router';
import { startSync, useSyncStatus } from './sync';
import { Toaster } from './components/ui';
import { QuickAdd } from './components/QuickAdd';
import Dashboard from './views/Dashboard';
import Life from './views/Life';
import Wallet from './views/Wallet';
import Projects from './views/Projects';
import Board from './views/Board';
import Settings from './views/Settings';

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

const NAV = [
  { name: 'home', label: 'Accueil', icon: Home },
  { name: 'life', label: 'Life', icon: Sprout },
  { name: 'wallet', label: 'Portefeuille', icon: WalletIcon },
  { name: 'projects', label: 'Projets', icon: FolderKanban }
];

export function SyncBadge() {
  const s = useSyncStatus();
  if (s === 'local') return null;
  const Icon = s === 'syncing' ? Loader2 : s === 'synced' ? Cloud : CloudOff;
  const label = s === 'syncing' ? 'Synchro…' : s === 'synced' ? 'Synchronisé' : s === 'offline' ? 'Hors ligne' : 'Erreur de synchro';
  return (
    <span className="row faint small" style={{ gap: 6 }} title={label}>
      <Icon size={13} className={s === 'syncing' ? 'spin' : ''} /> <span>{label}</span>
    </span>
  );
}

export default function App() {
  useTheme();
  const route = useRoute();
  const [quick, setQuick] = useState(false);
  useEffect(() => {
    startSync();
  }, []);

  // Raccourcis clavier sur ordi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable]')) return;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === 'c' || e.key === 'n') {
        e.preventDefault();
        setQuick(true);
      }
      if (e.key === '1') go('home');
      if (e.key === '2') go('life');
      if (e.key === '3') go('wallet');
      if (e.key === '4') go('projects');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const active = route.name === 'project' ? 'projects' : route.name;
  let view;
  switch (route.name) {
    case 'life': view = <Life tab={route.param} />; break;
    case 'wallet': view = <Wallet tab={route.param} />; break;
    case 'projects': view = <Projects />; break;
    case 'project': view = <Board id={route.param!} />; break;
    case 'settings': view = <Settings />; break;
    default: view = <Dashboard />;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><img src={iconUrl} alt="" /> Focus</div>
        <button className="nav-item" onClick={() => setQuick(true)}>
          <Plus size={16} /> Ajout rapide <kbd>C</kbd>
        </button>
        <div className="nav-sep" />
        {NAV.map((n, i) => (
          <button key={n.name} className={'nav-item' + (active === n.name ? ' active' : '')} onClick={() => go(n.name)}>
            <n.icon size={16} /> {n.label} <kbd>{i + 1}</kbd>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: '0 10px 8px' }}><SyncBadge /></div>
        <button className={'nav-item' + (active === 'settings' ? ' active' : '')} onClick={() => go('settings')}>
          <SettingsIcon size={16} /> Réglages
        </button>
      </aside>

      <main className="main">
        <div className="container fade-in" key={route.name + (route.param || '')}>{view}</div>
      </main>

      <nav className="tabbar">
        {NAV.slice(0, 2).map((n) => (
          <button key={n.name} className={'tab' + (active === n.name ? ' active' : '')} onClick={() => go(n.name)}>
            <n.icon size={21} strokeWidth={active === n.name ? 2.2 : 1.8} />
            {n.label}
          </button>
        ))}
        <button className="tab-plus" onClick={() => setQuick(true)} aria-label="Ajout rapide">
          <Plus size={24} strokeWidth={2.4} />
        </button>
        {NAV.slice(2).map((n) => (
          <button key={n.name} className={'tab' + (active === n.name ? ' active' : '')} onClick={() => go(n.name)}>
            <n.icon size={21} strokeWidth={active === n.name ? 2.2 : 1.8} />
            {n.label}
          </button>
        ))}
      </nav>

      <QuickAdd open={quick} onClose={() => setQuick(false)} defaultProject={route.name === 'project' ? route.param : undefined} />
      <Toaster />
    </div>
  );
}
