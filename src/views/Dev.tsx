import { useState, useId } from 'react';
import {
  Bot,
  Sparkles,
  Brain,
  Mic,
  Code2,
  AlertTriangle,
  Send,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Check,
  CheckCheck,
  Zap,
  Sliders,
  DollarSign,
  Cpu,
  Pencil
} from 'lucide-react';
import { useAppState, update } from '../store';
import { useBridgeStatus, toggleAgentStep, completeAgentAction, toggleDevMode, createTestAgentAction, isLocalHost } from '../devBridge';
import type { AgentAction, AiService, AiServiceUnit } from '../types';
import { uid, haptic, fmtInt } from '../utils';
import { Sheet, Field, NumInput, toast } from '../components/ui';
import { refreshUsage, useLiveUsage, type LiveService } from '../sync';

const PRESET_APPS: { name: string; category: AiService['category']; unit: AiServiceUnit; icon: string; color: string; plan: string; defaultLimit: number }[] = [
  { name: 'Claude (Anthropic)', category: 'llm', unit: 'tokens', icon: 'brain', color: '#d97706', plan: 'Pro / Tier 2', defaultLimit: 1000000 },
  { name: 'Google Antigravity', category: 'code', unit: 'tokens', icon: 'sparkles', color: '#3b82f6', plan: 'Workspace Agentic', defaultLimit: 2000000 },
  { name: 'ElevenLabs', category: 'voice', unit: 'chars', icon: 'mic', color: '#8b5cf6', plan: 'Creator Plan', defaultLimit: 100000 },
  { name: 'OpenAI (ChatGPT / API)', category: 'llm', unit: 'tokens', icon: 'bot', color: '#10a37f', plan: 'Pay-as-you-go', defaultLimit: 2500000 },
  { name: 'Cursor AI', category: 'code', unit: 'tokens', icon: 'code', color: '#06b6d4', plan: 'Pro', defaultLimit: 500000 },
  { name: 'Perplexity AI', category: 'llm', unit: 'tokens', icon: 'zap', color: '#2563eb', plan: 'Pro Plan', defaultLimit: 600000 },
  { name: 'Groq (Llama / Mixtral)', category: 'llm', unit: 'tokens', icon: 'cpu', color: '#f97316', plan: 'Developer Tier', defaultLimit: 5000000 },
  { name: 'Mistral AI', category: 'llm', unit: 'tokens', icon: 'brain', color: '#ec4899', plan: 'Le Plateforme', defaultLimit: 1000000 }
];

const ago = (t?: number) => {
  if (!t) return 'jamais';
  const m = Math.round((Date.now() - t) / 6e4);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
};

export default function Dev() {
  const state = useAppState();
  const dev = state.dev;
  const bridgeOnline = useBridgeStatus();
  const live = useLiveUsage();
  // Services dont les vrais chiffres arrivent tout seuls (usage.json, GitHub Action horaire)
  const liveFor = (srv: AiService): LiveService | undefined => {
    const key = /eleven/i.test(srv.name) ? 'elevenlabs' : /antigravity/i.test(srv.name) ? 'antigravity' : /claude|anthropic/i.test(srv.name) ? 'claude' : null;
    return key ? live?.services?.[key] : undefined;
  };
  const refreshLive = async () => {
    haptic();
    try {
      await refreshUsage();
      toast('Actualisation lancée : les chiffres arrivent d’ici 1 à 2 min');
    } catch (e: any) {
      toast(e.message);
    }
  };

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingService, setEditingService] = useState<AiService | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showBridgeDocs, setShowBridgeDocs] = useState(false);

  // Formulaire d'ajout / modification de service
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<AiService['category']>('llm');
  const [formPlan, setFormPlan] = useState('');
  const [formUsed, setFormUsed] = useState(0);
  const [formLimit, setFormLimit] = useState<number | undefined>(undefined);
  const [formUnit, setFormUnit] = useState<AiServiceUnit>('tokens');
  const [formCost, setFormCost] = useState<number | undefined>(undefined);
  const [formBudget, setFormBudget] = useState<number | undefined>(undefined);
  const [formReset, setFormReset] = useState('');
  const [formColor, setFormColor] = useState('#3b82f6');
  const [formNotes, setFormNotes] = useState('');

  const services = dev?.services || [];
  const actions = dev?.actions || [];
  const pendingActions = actions.filter((a) => a.status === 'pending');
  const completedActions = actions.filter((a) => a.status === 'completed');
  const devOn = Boolean(dev?.devModeActive);

  // Métriques globales
  const totalTokens = services.filter((s) => s.unit === 'tokens').reduce((acc, s) => acc + s.used, 0);
  const totalSpend = services.reduce((acc, s) => acc + (s.costUsd || 0), 0);
  const totalBudget = services.reduce((acc, s) => acc + (s.budgetUsd || 0), 0);

  const openNewService = (preset?: (typeof PRESET_APPS)[number]) => {
    setEditingService(null);
    if (preset) {
      setFormName(preset.name);
      setFormCategory(preset.category);
      setFormUnit(preset.unit);
      setFormColor(preset.color);
    } else {
      setFormName('');
      setFormCategory('llm');
      setFormUnit('tokens');
      setFormColor('#3b82f6');
    }
    // champs vides : tu remplis tes vrais chiffres (forfait, quota, budget)
    setFormPlan('');
    setFormLimit(undefined);
    setFormUsed(0);
    setFormCost(undefined);
    setFormBudget(undefined);
    setFormReset('');
    setFormNotes('');
    setSheetOpen(true);
  };

  const openEditService = (s: AiService) => {
    setEditingService(s);
    setFormName(s.name);
    setFormCategory(s.category || 'llm');
    setFormUnit(s.unit);
    setFormPlan(s.plan);
    setFormUsed(s.used);
    setFormLimit(s.limit);
    setFormCost(s.costUsd);
    setFormBudget(s.budgetUsd);
    setFormReset(s.resetDate || '');
    setFormColor(s.color || '#3b82f6');
    setFormNotes(s.notes || '');
    setSheetOpen(true);
  };

  const saveService = () => {
    if (!formName.trim()) {
      toast('Veuillez entrer un nom pour l’application');
      return;
    }

    const now = Date.now();
    if (editingService) {
      update((d) => {
        const item = d.dev.services.find((x) => x.id === editingService.id);
        if (item) {
          item.name = formName.trim();
          item.category = formCategory;
          item.unit = formUnit;
          item.plan = formPlan.trim();
          item.used = formUsed;
          item.limit = formLimit;
          item.costUsd = formCost;
          item.budgetUsd = formBudget;
          item.resetDate = formReset;
          item.color = formColor;
          item.notes = formNotes.trim();
          item.updatedAt = now;
        }
      });
      toast(`Application « ${formName} » mise à jour`);
    } else {
      const newService: AiService = {
        id: uid(),
        name: formName.trim(),
        category: formCategory,
        unit: formUnit,
        plan: formPlan.trim() || 'Standard',
        used: formUsed,
        limit: formLimit,
        costUsd: formCost,
        budgetUsd: formBudget,
        resetDate: formReset,
        color: formColor,
        notes: formNotes.trim(),
        updatedAt: now
      };
      update((d) => {
        d.dev.services.push(newService);
      });
      toast(`Application « ${formName} » ajoutée`);
    }
    setSheetOpen(false);
  };

  const deleteService = (id: string, name: string) => {
    if (confirm(`Supprimer l'application « ${name} » du suivi ?`)) {
      update((d) => {
        d.dev.services = d.dev.services.filter((x) => x.id !== id);
      });
      toast(`Application « ${name} » supprimée`);
      setSheetOpen(false);
    }
  };

  const quickIncrement = (serviceId: string, delta: number) => {
    update((d) => {
      const s = d.dev.services.find((x) => x.id === serviceId);
      if (s) {
        s.used = Math.max(0, s.used + delta);
        s.updatedAt = Date.now();
      }
    });
    haptic();
    toast(`+${fmtInt(delta)} enregistrés`);
  };

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text);
    toast(msg);
    haptic();
  };

  return (
    <div className="dev-view">
      {/* En-tête de la page */}
      <div className="page-head">
        <div>
          <h1 className="page-title">Dev</h1>
          <div className="page-sub">Tes IA, leurs tokens et ce qu'elles attendent de toi.</div>
        </div>
      </div>

      {/* Carte de contrôle : Mode Agent + état du pont local */}
      <section className={'dev-hero' + (devOn ? ' on' : '')}>
        <div className="dev-hero-top">
          <span className="dev-hero-icon"><Bot size={21} strokeWidth={2.2} /></span>
          <span className="dev-hero-text">
            <span className="dev-hero-title">Mode Agent</span>
            <span className="dev-hero-status">
              <i className="dev-live-dot" />
              {devOn ? 'Actif · à l’écoute de tes IA' : 'En pause · aucune alerte'}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={devOn}
            aria-label="Mode Agent"
            className={'dev-switch' + (devOn ? ' on' : '')}
            onClick={() => {
              toggleDevMode();
              haptic();
            }}
          >
            <span className="dev-switch-knob" />
          </button>
        </div>
        <div className="dev-hero-foot">
          <span className="dev-bridge-chip">
            <i className={'status-dot' + (bridgeOnline ? ' online' : ' offline')} />
            {bridgeOnline ? 'Pont connecté' : isLocalHost() ? 'Pont arrêté' : 'Pont : Mac uniquement'}
          </span>
          <button type="button" className="dev-link-chip" onClick={() => setShowBridgeDocs(!showBridgeDocs)} aria-expanded={showBridgeDocs}>
            <Code2 size={13} /> {showBridgeDocs ? 'Masquer' : 'Connecter une IA'}
          </button>
        </div>
      </section>

      {/* Accordéon Documentation API / Webhook */}
      {showBridgeDocs && (
        <div className="card card-pad dev-docs-card">
          <div className="row-between" style={{ marginBottom: 8 }}>
            <b className="dev-docs-title">Connecter une IA</b>
            <button
              type="button"
              className="dev-ghost-chip"
              onClick={() =>
                copyToClipboard(
                  `curl -X POST http://localhost:3001/api/agent/action \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "agentName": "Google Antigravity",\n    "title": "Validation 2FA requise",\n    "reason": "Authentification nécessaire pour publier le build",\n    "steps": [\n      "Ouvrir la session GitHub",\n      "Approuver la notification sur votre téléphone",\n      "Exécuter l autorisation dans le terminal"\n    ]\n  }'`,
                  'Exemple cURL copié !'
                )
              }
            >
              <Copy size={13} /> Copier
            </button>
          </div>
          <p className="small muted" style={{ margin: '0 0 10px', lineHeight: 1.5 }}>
            Sur le Mac, lance <code className="dev-code">npm run bridge</code>. Ensuite n'importe quelle IA (Antigravity, Claude, un script…) peut t'envoyer une mission pas à pas avec un simple <code className="dev-code">POST</code> :
          </p>
          <pre className="dev-pre">
{`curl -X POST http://localhost:3001/api/agent/action \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentName": "Google Antigravity",
    "title": "Validation 2FA requise",
    "reason": "Authentification nécessaire pour publier le build",
    "steps": [
      "Ouvrir la session GitHub",
      "Approuver la notification sur votre téléphone",
      "Exécuter l autorisation dans le terminal"
    ]
  }'`}
          </pre>
          <div className="small faint" style={{ marginTop: 8 }}>
            💡 Ajoute <code className="dev-code">?wait=true</code> à l'URL : l'IA attend alors que tu valides l'action dans Focus.
          </div>
        </div>
      )}


      {/* ========================================================
          SECTION 2 : MODE DEV / AGENT (HUMAN-IN-THE-LOOP)
         ======================================================== */}
      <div className="dev-section-head">
        <span className="dev-section-title">
          Actions requises
          {pendingActions.length > 0 && <span className="dev-badge-count">{pendingActions.length}</span>}
        </span>
        {devOn && (
          <button type="button" className="dev-ghost-chip" onClick={() => createTestAgentAction('2fa')} title="Créer une action de test pour essayer l'interface">
            <Zap size={12} /> Simuler
          </button>
        )}
      </div>

      {!devOn ? (
        <div className="dev-empty">
          <span className="dev-empty-icon"><Bot size={24} /></span>
          <b className="dev-empty-title">Mode Agent en pause</b>
          <p className="dev-empty-text">Active-le pour recevoir, étape par étape, ce que tes IA ne peuvent pas faire seules.</p>
          <button
            type="button"
            className="dev-cta-on"
            onClick={() => {
              toggleDevMode(true);
              haptic();
            }}
          >
            <Zap size={15} /> Activer le mode Agent
          </button>
        </div>
      ) : pendingActions.length === 0 ? (
        <div className="dev-empty ok">
          <span className="dev-empty-icon"><CheckCheck size={24} /></span>
          <b className="dev-empty-title">Rien à faire pour l'instant</b>
          <p className="dev-empty-text">Quand une IA bloque (2FA, paiement, DNS…), ses étapes arrivent ici avec des cases à cocher.</p>
          <div className="dev-empty-actions">
            <button type="button" className="dev-ghost-chip" onClick={() => createTestAgentAction('deploy')}>Tester un cas DNS</button>
            <button type="button" className="dev-ghost-chip" onClick={() => createTestAgentAction('payment')}>Tester un paiement</button>
          </div>
        </div>
      ) : (
        <div className="stack gap-12">
          {pendingActions.map((action) => {
            const totalSteps = action.steps.length;
            const doneSteps = action.steps.filter((s) => s.done).length;
            const allDone = totalSteps > 0 && doneSteps === totalSteps;

            return (
              <div key={action.id} className="card card-pad dev-action-card">
                {/* En-tête de l'action */}
                <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                      <span className="dev-agent-pill">
                        <Sparkles size={12} /> {action.agentName}
                      </span>
                      <span className="small faint">
                        {new Date(action.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h2 className="dev-action-title">{action.title}</h2>
                  </div>

                  <span className="dev-pending-badge">Action requise</span>
                </div>

                {/* Explication / Motif du blocage de l'IA */}
                <div className="dev-reason-banner">
                  <AlertTriangle size={15} className="dev-reason-icon" />
                  <div className="small">
                    <b>Pourquoi l'IA a besoin de vous :</b> {action.reason}
                  </div>
                </div>

                {/* Checklist pas-à-pas */}
                <div className="dev-checklist">
                  <div className="row-between" style={{ marginBottom: 6 }}>
                    <span className="small muted" style={{ fontWeight: 600 }}>
                      Instructions pas à pas ({doneSteps}/{totalSteps}) :
                    </span>
                    <span className="small mono faint">
                      {Math.round((doneSteps / Math.max(1, totalSteps)) * 100)}%
                    </span>
                  </div>

                  <div className="progress" style={{ marginBottom: 12, height: 5 }}>
                    <div style={{ width: `${(doneSteps / Math.max(1, totalSteps)) * 100}%` }} />
                  </div>

                  <div className="stack gap-8">
                    {action.steps.map((step, idx) => (
                      <div
                        key={step.id}
                        className={'dev-step-item' + (step.done ? ' done' : '')}
                        onClick={() => toggleAgentStep(action.id, step.id)}
                      >
                        <button
                          type="button"
                          className={'check' + (step.done ? ' on' : '')}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAgentStep(action.id, step.id);
                          }}
                          aria-label={`Étape ${idx + 1}`}
                        >
                          {step.done && <Check size={13} strokeWidth={3} />}
                        </button>

                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className={'dev-step-title' + (step.done ? ' line-through' : '')}>
                            <span className="dev-step-num">{idx + 1}.</span> {step.title}
                          </div>
                          {step.details && <div className="dev-step-details">{step.details}</div>}
                          {step.codeSnippet && (
                            <div
                              className="dev-code-box"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(step.codeSnippet!, 'Commande copiée !');
                              }}
                            >
                              <code>{step.codeSnippet}</code>
                              <span className="dev-code-copy" title="Copier la commande">
                                <Copy size={12} />
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bouton de confirmation renvoyé à l'IA */}
                <div className="dev-action-footer row-between">
                  <span className="small muted">
                    {allDone
                      ? '✓ Toutes les étapes sont validées !'
                      : 'Cochez les étapes au fur et à mesure.'}
                  </span>

                  <button
                    type="button"
                    className={'btn btn-primary dev-submit-btn' + (allDone ? ' ready' : '')}
                    onClick={() => {
                      completeAgentAction(
                        action.id,
                        `Action validée par Ethan (${doneSteps}/${totalSteps} étapes terminées).`
                      );
                      haptic();
                      toast(`Confirmation renvoyée à ${action.agentName} !`);
                    }}
                  >
                    <Send size={15} /> Renvoyer à l'IA que l'action est terminée
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Historique des actions terminées */}
      {completedActions.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            className="row faint small"
            style={{ gap: 6, margin: '14px 0 8px', cursor: 'pointer' }}
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Historique des actions résolues ({completedActions.length})
          </button>

          {showCompleted && (
            <div className="list">
              {completedActions.map((act) => (
                <div key={act.id} className="list-item row-between">
                  <div className="row" style={{ gap: 10 }}>
                    <div className="dev-history-icon">
                      <Check size={14} />
                    </div>
                    <div>
                      <b style={{ fontSize: 13.5 }}>{act.title}</b>
                      <div className="small faint">
                        {act.agentName} · Terminé le{' '}
                        {act.completedAt
                          ? new Date(act.completedAt).toLocaleString([], {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Récemment'}
                      </div>
                    </div>
                  </div>
                  <span className="small faint">{act.steps.length} étapes</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          SECTION 1 : COURS D'UTILISATION DES TOKENS & QUOTAS IA
         ======================================================== */}
      <div className="dev-section-head" style={{ marginTop: 34 }}>
        <span className="dev-section-title">
          Tokens & quotas <span className="count">{services.length} apps</span>
        </span>
        <button type="button" className="dev-ghost-chip primary" onClick={() => openNewService()}>
          <Plus size={13} /> Ajouter
        </button>
      </div>

      {/* Synthèse globale en cartes métriques */}
      <div className="grid grid-3" style={{ marginBottom: 14 }}>
        <div className="card card-pad">
          <div className="row" style={{ gap: 6, color: 'var(--text-2)', fontSize: 12 }}>
            <Cpu size={14} /> Tokens consommés (LLM)
          </div>
          <div className="big-num" style={{ margin: '6px 0 2px' }}>
            {fmtInt(totalTokens)}
          </div>
          <div className="small faint">Tous modèles LLM confondus</div>
        </div>

        <div className="card card-pad">
          <div className="row" style={{ gap: 6, color: 'var(--text-2)', fontSize: 12 }}>
            <DollarSign size={14} /> Dépense mensuelle estimée
          </div>
          <div className="big-num" style={{ margin: '6px 0 2px' }}>
            {totalSpend.toFixed(2)} $
          </div>
          <div className="small faint">
            Budget alloué : {totalBudget > 0 ? `${totalBudget} $` : 'Non plafonné'}
          </div>
        </div>

        <div className="card card-pad">
          <div className="row" style={{ gap: 6, color: 'var(--text-2)', fontSize: 12 }}>
            <Sliders size={14} /> Services connectés
          </div>
          <div className="big-num" style={{ margin: '6px 0 2px' }}>
            {services.length}
          </div>
          <div className="small faint">
            {services.filter((s) => s.category === 'llm').length} LLMs ·{' '}
            {services.filter((s) => s.category === 'voice').length} Voix ·{' '}
            {services.filter((s) => s.category === 'code').length} Code
          </div>
        </div>
      </div>

      {/* Grille des applications IA */}
      <div className="grid grid-2">
        {services.map((srv) => {
          const lv = liveFor(srv);
          const isLive = Boolean(lv && lv.used != null);
          const isPercent = isLive && lv!.unit === 'percent';
          const macAge = lv?.source === 'mac' ? Date.now() - (lv.seenAt || lv.fetchedAt || 0) : 0;
          const used = isLive ? lv!.used! : srv.used;
          const limit = isLive ? lv!.limit ?? undefined : srv.limit;
          const unit = isLive ? (lv!.unit as AiServiceUnit) || 'credits' : srv.unit;
          const plan = isLive && lv!.plan ? lv!.plan.charAt(0).toUpperCase() + lv!.plan.slice(1) : srv.plan;
          const resetLabel = isLive && lv!.resetAt
            ? new Date(lv!.resetAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
            : srv.resetDate;
          const hasLimit = Boolean(limit && limit > 0);
          const ratio = hasLimit ? Math.min(1, used / (limit || 1)) : 0;
          const pct = Math.round(ratio * 100);
          const isNearLimit = hasLimit && pct >= 85;

          const unitLabel =
            unit === 'tokens'
              ? 'tokens'
              : unit === 'chars'
              ? 'caractères'
              : unit === 'credits'
              ? 'crédits'
              : '$';

          return (
            <div key={srv.id} className="card card-pad dev-service-card">
              <div className="row-between" style={{ marginBottom: 8 }}>
                <div className="row" style={{ gap: 10 }}>
                  <div
                    className="dev-service-badge"
                    style={{ backgroundColor: `${srv.color || '#3b82f6'}22`, color: srv.color || '#3b82f6' }}
                  >
                    {srv.category === 'voice' ? (
                      <Mic size={18} />
                    ) : srv.category === 'code' ? (
                      <Code2 size={18} />
                    ) : (
                      <Brain size={18} />
                    )}
                  </div>
                  <div>
                    <h3 className="dev-service-name">{srv.name}</h3>
                    <div className="small faint">{plan || 'Forfait standard'}</div>
                  </div>
                </div>

                <div className="row" style={{ gap: 4 }}>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => openEditService(srv)}
                    title="Modifier l'application"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>

              {/* Jauge d'utilisation */}
              <div className="dev-gauge-box">
                <div className="row-between small" style={{ marginBottom: 4 }}>
                  {isPercent ? (
                    <span className="mono">
                      <b>{used} %</b> <span className="faint">du quota utilisé</span>
                    </span>
                  ) : (
                  <span className="mono">
                    <b>{fmtInt(used)}</b>{' '}
                    <span className="faint">
                      {hasLimit ? `/ ${fmtInt(limit!)} ${unitLabel}` : unitLabel}
                    </span>
                  </span>
                  )}
                  {hasLimit && !isPercent && (
                    <span className={'mono small' + (isNearLimit ? ' danger-text' : ' faint')}>
                      {pct}%
                    </span>
                  )}
                </div>

                <div className="progress" style={{ height: 6 }}>
                  <div
                    style={{
                      width: hasLimit ? `${pct}%` : '100%',
                      backgroundColor: isNearLimit ? 'var(--danger)' : srv.color || 'var(--text)'
                    }}
                  />
                </div>
              </div>

              {/* Détails financiers & reset */}
              <div className="row-between small" style={{ marginTop: 10 }}>
                <div className="row" style={{ gap: 4 }}>
                  <span className="faint">Coût :</span>
                  <b>{srv.costUsd != null ? `${srv.costUsd.toFixed(2)} $` : 'Inclus'}</b>
                  {srv.budgetUsd ? <span className="faint">/ {srv.budgetUsd} $</span> : null}
                </div>

                {resetLabel && (
                  <span className="dev-reset-pill small faint">
                    Reset : {resetLabel}
                  </span>
                )}
              </div>

              {srv.notes && <p className="dev-service-notes">{srv.notes}</p>}

              {lv?.details && lv.details.length > 0 && (
                <div className="dev-live-details">
                  {lv.details.map((d) => (
                    <div key={d.label} className="row-between small">
                      <span className="faint ellipsis">{d.label}</span>
                      <span className="mono">{d.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {lv ? (
                <div className="dev-live row-between small" style={{ marginTop: 12 }}>
                  <span className="row" style={{ gap: 6, minWidth: 0 }}>
                    <span className={'status-dot' + (lv.error ? ' error' : macAge > 3 * 36e5 ? '' : ' online')} />
                    <span className={lv.error ? 'danger-text ellipsis' : 'faint ellipsis'}>
                      {lv.error
                        ? `Synchro auto : ${lv.error}`
                        : lv.source === 'mac'
                        ? `Depuis ton Mac · ${ago(lv.seenAt || lv.fetchedAt)}`
                        : 'Synchro auto · chaque heure'}
                    </span>
                  </span>
                  {lv.source !== 'mac' && (
                    <button type="button" className="btn btn-ghost small dev-chip-btn" onClick={refreshLive}>
                      <RefreshCw size={11} /> Actualiser
                    </button>
                  )}
                </div>
              ) : (
              /* Raccourcis d'incrément rapide */
              <div className="dev-quick-inc row" style={{ marginTop: 12 }}>
                <span className="small faint" style={{ marginRight: 4 }}>
                  Ajouter :
                </span>
                <button
                  type="button"
                  className="btn btn-ghost small dev-chip-btn"
                  onClick={() => quickIncrement(srv.id, 1000)}
                >
                  +1k
                </button>
                <button
                  type="button"
                  className="btn btn-ghost small dev-chip-btn"
                  onClick={() => quickIncrement(srv.id, 10000)}
                >
                  +10k
                </button>
                <button
                  type="button"
                  className="btn btn-ghost small dev-chip-btn"
                  onClick={() => quickIncrement(srv.id, 50000)}
                >
                  +50k
                </button>
              </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Sheet : Ajouter ou Modifier un Service IA */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingService ? `Modifier ${editingService.name}` : 'Ajouter une application IA'}
      >
        <div className="stack gap-12" style={{ padding: '8px 0 16px' }}>
          {!editingService && (
            <div>
              <label className="small faint" style={{ display: 'block', marginBottom: 6 }}>
                Choisis une app ou remplis à la main
              </label>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {PRESET_APPS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="btn btn-ghost small dev-preset-pill"
                    onClick={() => openNewService(p)}
                  >
                    <span className="dev-preset-dot" style={{ backgroundColor: p.color }} />
                    {p.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Field label="Nom de l'application">
            <input
              className="input"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Ex: Claude (Anthropic), Google Antigravity..."
              autoFocus
            />
          </Field>

          <div className="grid grid-2">
            <Field label="Catégorie">
              <select
                className="input"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as AiService['category'])}
              >
                <option value="llm">LLM</option>
                <option value="code">Code & agents</option>
                <option value="voice">Voix</option>
                <option value="image">Images</option>
                <option value="other">Autre</option>
              </select>
            </Field>

            <Field label="Unité">
              <select
                className="input"
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value as AiServiceUnit)}
              >
                <option value="tokens">Tokens</option>
                <option value="chars">Caractères</option>
                <option value="credits">Crédits</option>
                <option value="usd">USD ($)</option>
              </select>
            </Field>
          </div>

          <Field label="Forfait / Plan">
            <input
              className="input"
              value={formPlan}
              onChange={(e) => setFormPlan(e.target.value)}
              placeholder="Ex: Pro, Tier 2, Pay-as-you-go..."
            />
          </Field>

          <div className="grid grid-2">
            <Field label="Consommation actuelle">
              <NumInput
                value={formUsed}
                onChange={setFormUsed}
                placeholder="Ex : 250000"
              />
            </Field>

            <Field label="Quota mensuel">
              <NumInput
                value={formLimit ?? null}
                onChange={(n) => setFormLimit(n > 0 ? n : undefined)}
                placeholder="Ex : 1000000"
              />
            </Field>
          </div>

          <div className="grid grid-2">
            <Field label="Dépense actuelle ($)">
              <NumInput
                value={formCost ?? null}
                onChange={(n) => setFormCost(n >= 0 ? n : undefined)}
                placeholder="Ex : 12,50"
              />
            </Field>

            <Field label="Budget mensuel ($)">
              <NumInput
                value={formBudget ?? null}
                onChange={(n) => setFormBudget(n > 0 ? n : undefined)}
                placeholder="Ex : 30"
              />
            </Field>
          </div>

          <Field label="Remise à zéro du quota">
            <input
              type="date"
              className="input"
              value={formReset}
              onChange={(e) => setFormReset(e.target.value)}
            />
          </Field>

          <Field label="Modèles utilisés">
            <textarea
              className="input"
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Ex : Opus 5.5, Sonnet 5.5"
            />
          </Field>

          {/* Téléphone : « Enregistrer » en grand, puis Annuler / Supprimer côte à côte. Ordi : sur une ligne. */}
          <div className="dev-form-foot">
            <button type="button" className="btn btn-primary btn-lg dev-form-save" onClick={saveService}>
              {editingService ? 'Enregistrer' : 'Ajouter l’application'}
            </button>
            <button type="button" className="btn btn-ghost dev-form-cancel" onClick={() => setSheetOpen(false)}>
              Annuler
            </button>
            {editingService && (
              <button
                type="button"
                className="btn btn-ghost btn-danger dev-form-del"
                onClick={() => deleteService(editingService.id, editingService.name)}
              >
                <Trash2 size={14} /> Supprimer
              </button>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
