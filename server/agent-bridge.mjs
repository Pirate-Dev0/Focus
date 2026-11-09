// agent-bridge.mjs — Pont local HTTP / Webhook pour le Mode Dev / Agent de Focus
// Écoute les requêtes des IA (Claude, Antigravity, scripts) et les transmet en direct au navigateur.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ACTIONS_FILE = path.join(__dirname, 'agent-actions.json');
const PORT = Number(process.env.PORT || 3001);

let sseClients = new Set();
let waitingResponses = new Map(); // actionId -> Array of res

let state = {
  devModeActive: true,
  actions: []
};

// Charger l'état sauvegardé si existant
try {
  if (fs.existsSync(ACTIONS_FILE)) {
    const raw = fs.readFileSync(ACTIONS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.actions)) {
      state = parsed;
    }
  }
} catch (e) {
  console.warn('[Bridge] Impossible de lire agent-actions.json, état neuf utilisé:', e.message);
}

function saveState() {
  try {
    fs.writeFileSync(ACTIONS_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Bridge] Erreur écriture agent-actions.json:', e.message);
  }
}

function broadcastSSE(type, data) {
  const payload = `data: ${JSON.stringify({ type, data, timestamp: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload trop volumineux (> 1MB)'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('JSON invalide'));
      }
    });
    req.on('error', reject);
  });
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. SSE Stream
  if (req.method === 'GET' && pathname === '/api/agent/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify({ type: 'init', data: state })}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // 2. Statut
  if (req.method === 'GET' && (pathname === '/api/agent/status' || pathname === '/health')) {
    const pendingCount = state.actions.filter(a => a.status === 'pending').length;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      devModeActive: state.devModeActive,
      pendingCount,
      totalCount: state.actions.length,
      port: PORT
    }));
  }

  // 3. Liste des actions
  if (req.method === 'GET' && pathname === '/api/agent/actions') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(state));
  }

  // 4. Créer une nouvelle action (envoyée par une IA)
  if (req.method === 'POST' && pathname === '/api/agent/action') {
    try {
      const data = await parseJsonBody(req);
      if (!data.title) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Le champ title est requis' }));
      }

      // Normaliser les étapes
      const rawSteps = Array.isArray(data.steps) ? data.steps : [];
      const steps = rawSteps.map((s, idx) => {
        if (typeof s === 'string') {
          return { id: `step-${Date.now()}-${idx}`, title: s, done: false };
        }
        return {
          id: s.id || `step-${Date.now()}-${idx}`,
          title: s.title || `Étape ${idx + 1}`,
          details: s.details || '',
          codeSnippet: s.codeSnippet || '',
          done: Boolean(s.done)
        };
      });

      const newAction = {
        id: data.id || `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        agentName: data.agentName || 'Agent IA',
        title: data.title,
        reason: data.reason || "L'agent IA requiert une intervention manuelle.",
        steps,
        status: 'pending',
        createdAt: Date.now()
      };

      state.actions.unshift(newAction);
      saveState();
      broadcastSSE('action_created', newAction);

      // Si le client IA souhaite attendre la complétion (Long-polling)
      if (url.searchParams.get('wait') === 'true') {
        const timeoutMs = Number(url.searchParams.get('timeout') || 300000); // 5 min max
        const timer = setTimeout(() => {
          const list = waitingResponses.get(newAction.id) || [];
          const idx = list.indexOf(res);
          if (idx !== -1) list.splice(idx, 1);
          if (!res.writableEnded) {
            res.writeHead(408, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Timeout attente validation utilisateur', actionId: newAction.id }));
          }
        }, timeoutMs);

        if (!waitingResponses.has(newAction.id)) waitingResponses.set(newAction.id, []);
        waitingResponses.get(newAction.id).push({ res, timer });
        return;
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, action: newAction }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // 5. Compléter une action
  const completeMatch = pathname.match(/^\/api\/agent\/action\/([^/]+)\/complete$/);
  if (req.method === 'POST' && completeMatch) {
    const actionId = completeMatch[1];
    const data = await parseJsonBody(req);
    const action = state.actions.find(a => a.id === actionId);
    if (!action) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Action non trouvée' }));
    }

    action.status = 'completed';
    action.completedAt = Date.now();
    action.responsePayload = data.responsePayload || 'Action manuelle confirmée par Ethan.';
    action.steps.forEach(s => (s.done = true));

    saveState();
    broadcastSSE('action_completed', action);

    // Débloquer les clients IA en attente (long polling)
    if (waitingResponses.has(actionId)) {
      const waiters = waitingResponses.get(actionId) || [];
      for (const { res: wRes, timer } of waiters) {
        clearTimeout(timer);
        if (!wRes.writableEnded) {
          wRes.writeHead(200, { 'Content-Type': 'application/json' });
          wRes.end(JSON.stringify({ ok: true, completed: true, action }));
        }
      }
      waitingResponses.delete(actionId);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, action }));
  }

  // 6. Basculer l'état d'une étape
  const stepMatch = pathname.match(/^\/api\/agent\/action\/([^/]+)\/step$/);
  if (req.method === 'POST' && stepMatch) {
    const actionId = stepMatch[1];
    const data = await parseJsonBody(req);
    const action = state.actions.find(a => a.id === actionId);
    if (!action) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Action non trouvée' }));
    }

    const step = action.steps.find(s => s.id === data.stepId);
    if (step) {
      step.done = data.done !== undefined ? Boolean(data.done) : !step.done;
      saveState();
      broadcastSSE('action_updated', action);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, action }));
  }

  // 7. Basculer le Mode Dev
  if (req.method === 'POST' && pathname === '/api/agent/dev-mode') {
    const data = await parseJsonBody(req);
    if (data.active !== undefined) {
      state.devModeActive = Boolean(data.active);
      saveState();
      broadcastSSE('dev_mode', { devModeActive: state.devModeActive });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, devModeActive: state.devModeActive }));
  }

  // Route introuvable
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint non trouvé' }));
});

// Envoi d'un heartbeat SSE toutes les 25 secondes
setInterval(() => {
  broadcastSSE('ping', { time: Date.now() });
}, 25000);

server.listen(PORT, () => {
  console.log(`[Focus Bridge] Serveur local actif sur http://localhost:${PORT}`);
  console.log(`[Focus Bridge] Prêt à recevoir des actions IA sur POST http://localhost:${PORT}/api/agent/action`);
});
