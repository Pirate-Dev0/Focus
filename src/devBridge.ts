// devBridge.ts — Client de synchronisation avec le pont local HTTP/SSE du Mode Dev

import { useEffect, useState, useSyncExternalStore } from 'react';
import { getState, update } from './store';
import type { AgentAction, AgentStep, AiService } from './types';
import { uid } from './utils';

const BRIDGE_URL = 'http://localhost:3001';

/** Vrai quand l'app est servie depuis le Mac lui-même (npm run dev / preview) */
export function isLocalHost() {
  return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
}

let bridgeOnline = false;
const listeners = new Set<() => void>();

function setBridgeOnline(val: boolean) {
  if (bridgeOnline !== val) {
    bridgeOnline = val;
    listeners.forEach((l) => l());
  }
}

export function useBridgeStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => bridgeOnline
  );
}

// Écoute SSE pour recevoir en temps réel les actions envoyées par les IA
export function startBridgeListener() {
  let eventSource: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout>;

  // Le pont tourne sur le Mac (npm run bridge) : inutile de le chercher depuis le site en ligne ou le téléphone
  if (!isLocalHost()) return () => {};

  const connect = () => {
    try {
      eventSource = new EventSource(`${BRIDGE_URL}/api/agent/events`);

      eventSource.onopen = () => {
        setBridgeOnline(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'init' && payload.data?.actions) {
            // Fusionner les actions distantes
            update((d) => {
              const serverActions: AgentAction[] = payload.data.actions;
              if (serverActions.length > 0) {
                // Garder les actions existantes et fusionner avec celles du serveur
                const map = new Map(d.dev.actions.map((a) => [a.id, a]));
                for (const sAct of serverActions) {
                  map.set(sAct.id, sAct);
                }
                d.dev.actions = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
              }
              if (payload.data.devModeActive !== undefined) {
                d.dev.devModeActive = payload.data.devModeActive;
              }
            });
          } else if (payload.type === 'action_created' && payload.data) {
            update((d) => {
              const action: AgentAction = payload.data;
              if (!d.dev.actions.some((a) => a.id === action.id)) {
                d.dev.actions.unshift(action);
              }
            });
          } else if ((payload.type === 'action_updated' || payload.type === 'action_completed') && payload.data) {
            update((d) => {
              const updatedAction: AgentAction = payload.data;
              const idx = d.dev.actions.findIndex((a) => a.id === updatedAction.id);
              if (idx !== -1) {
                d.dev.actions[idx] = updatedAction;
              } else {
                d.dev.actions.unshift(updatedAction);
              }
            });
          } else if (payload.type === 'dev_mode' && payload.data) {
            update((d) => {
              d.dev.devModeActive = payload.data.devModeActive;
            });
          }
        } catch (e) {
          console.warn('[Bridge SSE] Erreur traitement message:', e);
        }
      };

      eventSource.onerror = () => {
        setBridgeOnline(false);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        clearTimeout(retryTimer);
        retryTimer = setTimeout(connect, 4000);
      };
    } catch {
      setBridgeOnline(false);
      clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, 4000);
    }
  };

  connect();

  return () => {
    clearTimeout(retryTimer);
    if (eventSource) eventSource.close();
  };
}

// Basculer l'état d'une étape (synchro locale + serveur si dispo)
export async function toggleAgentStep(actionId: string, stepId: string) {
  let isDone = false;
  update((d) => {
    const act = d.dev.actions.find((a) => a.id === actionId);
    if (!act) return;
    const st = act.steps.find((s) => s.id === stepId);
    if (!st) return;
    st.done = !st.done;
    isDone = st.done;
  });

  if (bridgeOnline) {
    try {
      await fetch(`${BRIDGE_URL}/api/agent/action/${actionId}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, done: isDone })
      });
    } catch (e) {
      console.warn('[Bridge] Erreur maj étape sur le pont:', e);
    }
  }
}

// Valider et renvoyer à l'IA que l'action est terminée
export async function completeAgentAction(actionId: string, responseFeedback?: string) {
  const completedAt = Date.now();
  const feedback = responseFeedback || 'Action manuelle complétée avec succès par Ethan.';

  update((d) => {
    const act = d.dev.actions.find((a) => a.id === actionId);
    if (!act) return;
    act.status = 'completed';
    act.completedAt = completedAt;
    act.responsePayload = feedback;
    act.steps.forEach((s) => (s.done = true));
  });

  if (bridgeOnline) {
    try {
      await fetch(`${BRIDGE_URL}/api/agent/action/${actionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responsePayload: feedback })
      });
    } catch (e) {
      console.warn('[Bridge] Erreur complétion sur le pont:', e);
    }
  }
}

// Basculer le mode Dev
export async function toggleDevMode(active?: boolean) {
  let next = false;
  update((d) => {
    next = active !== undefined ? active : !d.dev.devModeActive;
    d.dev.devModeActive = next;
  });

  if (bridgeOnline) {
    try {
      await fetch(`${BRIDGE_URL}/api/agent/dev-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next })
      });
    } catch (e) {
      console.warn('[Bridge] Erreur toggle dev mode:', e);
    }
  }
}

// Créer une action de test (pour tester l'UI sans script externe)
export function createTestAgentAction(preset?: '2fa' | 'deploy' | 'payment') {
  const now = Date.now();
  let sample: Omit<AgentAction, 'id' | 'createdAt'>;

  if (preset === 'deploy') {
    sample = {
      agentName: 'Claude (Agent)',
      title: 'Validation manuelle du DNS & Domaine Vercel',
      reason: "L'IA a terminé le code mais requiert la mise à jour des entrées DNS A et CNAME sur votre registrar externe.",
      status: 'pending',
      steps: [
        { id: uid(), title: 'Se connecter sur le registrar du nom de domaine', details: 'Ex: Cloudflare, Namecheap ou OVH', done: false },
        { id: uid(), title: 'Ajouter l’enregistrement CNAME vers cname.vercel-dns.com', codeSnippet: 'CNAME @ cname.vercel-dns.com', done: false },
        { id: uid(), title: 'Vérifier la propagation avec dig ou dans la console Vercel', codeSnippet: 'dig +short yourdomain.com', done: false }
      ]
    };
  } else if (preset === 'payment') {
    sample = {
      agentName: 'Google Antigravity',
      title: 'Validation carte de crédit / Facturation Stripe',
      reason: "L'agent autonome a configuré le webhook Stripe mais l'approbation 3D-Secure de la carte bancaire nécessite votre smartphone.",
      status: 'pending',
      steps: [
        { id: uid(), title: 'Ouvrir le lien de paiement 3D-Secure généré', details: 'Vérifier le montant de 0,00 € pour la validation', done: false },
        { id: uid(), title: 'Valider la notification dans l’application de votre banque', done: false }
      ]
    };
  } else {
    sample = {
      agentName: 'Google Antigravity',
      title: 'Action requise : Autorisation 2FA / Session Terminal',
      reason: "L'agent a besoin d'une clé API ou d'une validation d'empreinte sur votre machine pour continuer l'exécution.",
      status: 'pending',
      steps: [
        { id: uid(), title: 'Ouvrir la session du terminal local', done: true },
        { id: uid(), title: 'Autoriser la clé de sécurité biométrique (Touch ID)', details: 'Touchez le capteur Touch ID', done: false },
        { id: uid(), title: 'Exécuter la synchronisation', codeSnippet: 'git push origin main', done: false }
      ]
    };
  }

  const newAction: AgentAction = {
    ...sample,
    id: `act-${now}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now
  };

  update((d) => {
    d.dev.actions.unshift(newAction);
  });

  if (bridgeOnline) {
    fetch(`${BRIDGE_URL}/api/agent/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAction)
    }).catch(() => {});
  }
}
