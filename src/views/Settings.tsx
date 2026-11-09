import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bell, ChevronRight, Download, Github, LogOut, Moon, Sun, Monitor, Upload, Smartphone, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { go } from '../router';
import { HomeSheet } from './Dashboard';
import { getState, migrate, setState, update, useAppState } from '../store';
import { Field, NumInput, Segmented, toast } from '../components/ui';
import { connect, currentEndpoint, disablePush, disconnect, enablePush, getConfig, pull, pushReady, syncInfo, testPush, useSyncStatus } from '../sync';
import { SyncBadge } from '../App';

export default function Settings() {
  const s = useAppState();
  const status = useSyncStatus();
  const cfg = getConfig();
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('focus-data');
  const [token, setToken] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [homeSheet, setHomeSheet] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
  const notifOn = Boolean(endpoint && (s.pushSubs || []).some((x) => x.endpoint === endpoint));

  useEffect(() => {
    currentEndpoint().then(setEndpoint);
  }, [s.pushSubs?.length]);

  const doConnect = async () => {
    setBusy(true);
    setErr(null);
    try {
      await connect({ owner, repo, token });
      setToken('');
      toast('Synchro GitHub activée');
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const toggleNotif = async () => {
    setBusy(true);
    try {
      if (notifOn) { await disablePush(); toast('Notifications désactivées'); }
      else { await enablePush(); toast('Notifications activées'); }
      setEndpoint(await currentEndpoint());
    } catch (e: any) {
      alert(e.message || String(e));
    }
    setBusy(false);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `focus-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const importJson = async (f: File) => {
    try {
      const data = migrate(JSON.parse(await f.text()));
      if (!confirm('Remplacer toutes les données actuelles par ce fichier ?')) return;
      setState({ ...data, updatedAt: Date.now() });
      toast('Sauvegarde restaurée');
    } catch {
      alert('Fichier invalide');
    }
  };

  const last = syncInfo().lastSync;

  return (
    <>
      <button className="btn btn-ghost back-btn hide-desktop" onClick={() => go('home')}><ArrowLeft size={17} /> Aujourd'hui</button>
      <div className="page-head">
        <div>
          <h1 className="page-title">Réglages</h1>
          <div className="page-sub"><SyncBadge /></div>
        </div>
      </div>

      <div className="section-title"><span>Toi</span></div>
      <div className="card card-pad">
        <Field label="Prénom"><input className="input" value={s.settings.name} onChange={(e) => update((d) => { d.settings.name = e.target.value; })} /></Field>
        <Field label="Thème">
          <Segmented full value={s.settings.theme} onChange={(v) => update((d) => { d.settings.theme = v; })} options={[
            { value: 'system', label: <><Monitor size={14} /> Auto</> },
            { value: 'light', label: <><Sun size={14} /> Clair</> },
            { value: 'dark', label: <><Moon size={14} /> Sombre</> }
          ]} />
        </Field>
        <button className="list-item card-click" style={{ border: '1px solid var(--border)', borderRadius: 10, marginTop: 4 }} onClick={() => setHomeSheet(true)}>
          <SlidersHorizontal size={16} />
          <span className="grow" style={{ fontWeight: 500 }}>Personnaliser l'accueil</span>
          <ChevronRight size={16} className="faint" />
        </button>
      </div>
      <HomeSheet open={homeSheet} onClose={() => setHomeSheet(false)} />

      <div className="section-title"><span>Synchro GitHub</span></div>
      <div className="card card-pad">
        {cfg ? (
          <>
            <div className="row-between" style={{ marginBottom: 10 }}>
              <div className="row"><Github size={16} /><span style={{ fontWeight: 500 }}>{cfg.owner}/{cfg.repo}</span></div>
              <button className="icon-btn" onClick={() => pull()} aria-label="Synchroniser"><RefreshCw size={15} className={status === 'syncing' ? 'spin' : ''} /></button>
            </div>
            <p className="faint small" style={{ marginTop: 0 }}>
              {status === 'error' ? `Erreur : ${syncInfo().lastError}` : last ? `Dernière synchro : ${new Date(last).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Synchronisation…'}
              {' '}· tes données sont dans <code>data.json</code>, chaque modif = un commit.
            </p>
            <button className="btn btn-ghost btn-danger" onClick={() => { if (confirm('Déconnecter cet appareil ? Les données restent sur GitHub.')) disconnect(); }}><LogOut size={14} /> Déconnecter cet appareil</button>
          </>
        ) : (
          <>
            <p className="muted small" style={{ marginTop: 0 }}>Tes données vont dans un repo GitHub <b>privé</b> pour être les mêmes sur ton iPhone et ton ordi. À faire une fois par appareil (voir README).</p>
            <div className="field-row">
              <Field label="Pseudo GitHub"><input className="input" autoCapitalize="none" autoCorrect="off" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="ethan" /></Field>
              <Field label="Repo privé"><input className="input" autoCapitalize="none" autoCorrect="off" value={repo} onChange={(e) => setRepo(e.target.value)} /></Field>
            </div>
            <Field label="Token (fine-grained)"><input className="input" type="password" autoCapitalize="none" autoCorrect="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" /></Field>
            {err && <p className="small" style={{ color: 'var(--danger)', marginTop: -4 }}>{err}</p>}
            <button className="btn btn-primary btn-block btn-lg" disabled={busy || !owner || !repo || !token} onClick={doConnect}>{busy ? 'Connexion…' : 'Connecter'}</button>
          </>
        )}
      </div>

      <div className="section-title"><span>Notifications</span></div>
      <div className="card card-pad">
        {!standalone && (
          <div className="row small muted" style={{ marginBottom: 12, alignItems: 'flex-start' }}>
            <Smartphone size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Sur iPhone, les notifications marchent seulement une fois Focus ajouté à l'écran d'accueil : dans Safari, Partager → « Sur l'écran d'accueil », puis ouvre Focus depuis l'icône.</span>
          </div>
        )}
        <Field label="Clé publique VAPID (une seule fois, synchronisée)">
          <input className="input" autoCapitalize="none" autoCorrect="off" value={s.settings.vapidPublicKey || ''} onChange={(e) => update((d) => { d.settings.vapidPublicKey = e.target.value.trim(); })} placeholder="B…" />
        </Field>
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div className="row"><Bell size={16} /><span style={{ fontWeight: 500 }}>Rappels sur cet appareil</span></div>
          <button className={'btn' + (notifOn ? '' : ' btn-primary')} disabled={busy || !pushReady()} onClick={toggleNotif} style={{ opacity: pushReady() ? 1 : 0.4 }}>
            {notifOn ? 'Désactiver' : 'Activer'}
          </button>
        </div>
        <div className="field-row">
          <Field label="Rappel habitudes (heure)"><NumInput value={s.settings.notifyHabitsHour} onChange={(n) => update((d) => { d.settings.notifyHabitsHour = Math.max(6, Math.min(23, Math.round(n))); })} /></Field>
          <Field label="Rappel deadlines (heure)"><NumInput value={s.settings.notifyDeadlinesHour} onChange={(n) => update((d) => { d.settings.notifyDeadlinesHour = Math.max(6, Math.min(23, Math.round(n))); })} /></Field>
        </div>
        <p className="faint small" style={{ margin: 0 }}>Le soir : les habitudes pas encore cochées. Le matin : les tâches du jour, en retard, et les deadlines de projet à 3 jours. Envoyé par une GitHub Action (peut arriver avec quelques minutes de retard).</p>
        {(s.pushSubs || []).length > 0 && <p className="faint small" style={{ marginBottom: 0 }}>Appareils abonnés : {(s.pushSubs || []).map((x) => x.device).join(', ')}</p>}
        {notifOn && <button className="btn" style={{ marginTop: 12 }} disabled={busy} onClick={() => { setBusy(true); testPush().then(() => toast('Test lancé, la notif arrive d’ici ~1 min')).catch((e) => alert(e.message)).finally(() => setBusy(false)); }}>Envoyer une notif de test</button>}
      </div>

      <div className="section-title"><span>Sauvegarde</span></div>
      <div className="card card-pad">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn" onClick={exportJson}><Download size={14} /> Exporter</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={14} /> Restaurer</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        </div>
        <p className="faint small" style={{ marginBottom: 0 }}>{cfg ? 'Avec GitHub, tout l’historique de tes données est déjà dans les commits du repo.' : 'Mode local : les données restent sur cet appareil.'}</p>
      </div>
      <p className="faint small" style={{ textAlign: 'center', marginTop: 28 }}>Focus · fait maison, une nuit de novembre 2026</p>
    </>
  );
}
