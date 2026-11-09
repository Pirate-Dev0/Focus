// usage-mac.mjs — consommation réelle de Claude Code et d'Antigravity, lue sur ce Mac
// et envoyée dans le repo de données (usage-mac.json) pour la page Dev de Focus.
//
//   npm run usage            → une mesure + envoi
//   npm run usage:watch      → une mesure toutes les 30 min (laisse le Terminal ouvert)
//   npm run usage:install    → lancement automatique en arrière-plan (toutes les 30 min, même après un redémarrage)
//   npm run usage:uninstall  → arrête le lancement automatique
//
// Rien de privé n'est envoyé : seulement des totaux de tokens et des pourcentages de quota
// (pas de noms de projets, pas de contenu de conversation).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.FOCUS_DATA_DIR || path.resolve(__dirname, '../../focus-data');
const FILE = path.join(DATA_DIR, 'usage-mac.json');
const NO_PUSH = process.argv.includes('--no-push') || process.env.FOCUS_NO_PUSH === '1';
const INTERVAL_MIN = 30;
const LABEL = 'fr.focus.usage';
const PLIST = path.join(os.homedir(), 'Library/LaunchAgents', `${LABEL}.plist`);

const log = (...a) => console.log(`[usage ${new Date().toLocaleTimeString('fr-FR')}]`, ...a);

/* ---------- Claude Code : journaux locaux ---------- */
function claudeDirs() {
  const dirs = [];
  if (process.env.CLAUDE_CONFIG_DIR) dirs.push(...process.env.CLAUDE_CONFIG_DIR.split(',').map((d) => path.join(d.trim(), 'projects')));
  dirs.push(path.join(os.homedir(), '.claude', 'projects'), path.join(os.homedir(), '.config', 'claude', 'projects'));
  return [...new Set(dirs)].filter((d) => fs.existsSync(d));
}

function* jsonlFiles(dir, since) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* jsonlFiles(p, since);
    else if (e.name.endsWith('.jsonl')) {
      try {
        if (fs.statSync(p).mtimeMs >= since) yield p;
      } catch {}
    }
  }
}

const parisDay = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(t);

function claudeCode() {
  const dirs = claudeDirs();
  if (!dirs.length) return null;
  const now = Date.now();
  const today = parisDay(now);
  const month = today.slice(0, 7);
  const since = Math.min(now - 7 * 864e5, new Date(month + '-01T00:00:00').getTime()) - 864e5;
  const seen = new Set();
  const z = () => ({ io: 0, cacheWrite: 0, cacheRead: 0 });
  const tot = { h5: z(), today: z(), d7: z(), month: z() };
  const models = {};
  let last = 0;

  for (const dir of dirs) {
    for (const f of jsonlFiles(dir, since)) {
      let text;
      try {
        text = fs.readFileSync(f, 'utf8');
      } catch {
        continue;
      }
      for (const line of text.split('\n')) {
        if (!line.includes('"usage"')) continue;
        let e;
        try {
          e = JSON.parse(line);
        } catch {
          continue;
        }
        const u = e?.message?.usage;
        if (!u || !e.timestamp) continue;
        const key = `${e.message.id || ''}:${e.requestId || ''}`;
        if (key !== ':' && seen.has(key)) continue; // un même message est écrit plusieurs fois pendant le streaming
        seen.add(key);
        const t = Date.parse(e.timestamp);
        if (!Number.isFinite(t) || t < since) continue;
        const io = (u.input_tokens || 0) + (u.output_tokens || 0);
        const cw = u.cache_creation_input_tokens || 0;
        const cr = u.cache_read_input_tokens || 0;
        const add = (b) => { b.io += io; b.cacheWrite += cw; b.cacheRead += cr; };
        if (t >= now - 5 * 36e5) add(tot.h5);
        if (parisDay(t) === today) add(tot.today);
        if (t >= now - 7 * 864e5) {
          add(tot.d7);
          const m = String(e.message.model || 'autre').replace(/^claude-/, '').replace(/-\d{8}$/, '');
          if (m !== '<synthetic>') models[m] = (models[m] || 0) + io;
        }
        if (parisDay(t).startsWith(month)) add(tot.month);
        last = Math.max(last, t);
      }
    }
  }

  const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M` : n >= 1e3 ? `${Math.round(n / 1e3).toLocaleString('fr-FR')} k` : String(n));
  const topModels = Object.entries(models).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return {
    plan: 'Claude Code · 7 derniers jours',
    used: tot.d7.io,
    limit: null,
    unit: 'tokens',
    lastActivity: last || null,
    totals: tot,
    details: [
      { label: '5 dernières heures', value: fmt(tot.h5.io) },
      { label: "Aujourd'hui", value: fmt(tot.today.io) },
      { label: 'Ce mois-ci', value: fmt(tot.month.io) },
      { label: 'Cache lu (7 j)', value: fmt(tot.d7.cacheRead) },
      ...topModels.map(([m, n]) => ({ label: m, value: fmt(n) }))
    ]
  };
}

/* ---------- Antigravity : serveur local de l'app (seulement quand elle est ouverte) ---------- */
function sh(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 });
  } catch {
    return '';
  }
}

function post(port, method, csrf) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ metadata: { ideName: 'antigravity', extensionName: 'antigravity', locale: 'fr' } });
    const req = https.request(
      {
        hostname: '127.0.0.1',
        port,
        path: `/exa.language_server_pb.LanguageServerService/${method}`,
        method: 'POST',
        rejectUnauthorized: false, // certificat auto-signé du serveur local
        timeout: 4000,
        headers: {
          'Content-Type': 'application/json',
          'Connect-Protocol-Version': '1',
          'Content-Length': Buffer.byteLength(body),
          ...(csrf ? { 'X-Codeium-Csrf-Token': csrf } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return resolve(null);
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => req.destroy());
    req.end(body);
  });
}

// cherche partout les objets { label, quotaInfo: { remainingFraction, resetTime } }
function collectQuotas(node, out = new Map()) {
  if (Array.isArray(node)) node.forEach((x) => collectQuotas(x, out));
  else if (node && typeof node === 'object') {
    if (node.quotaInfo && typeof node.quotaInfo === 'object') {
      const label = node.label || node.modelOrAlias?.model || node.model || 'Modèle';
      const rf = node.quotaInfo.remainingFraction;
      out.set(label, { label, remaining: Math.round((typeof rf === 'number' ? rf : 1) * 100), resetTime: node.quotaInfo.resetTime || null });
    }
    for (const v of Object.values(node)) if (v && typeof v === 'object') collectQuotas(v, out);
  }
  return out;
}

async function antigravity() {
  const ps = sh('ps', ['-ax', '-o', 'pid=,command=']);
  const lines = ps.split('\n').filter((l) => /language_server/i.test(l) && /antigravity/i.test(l));
  if (!lines.length) return { running: false };
  for (const line of lines) {
    const pid = line.trim().split(/\s+/)[0];
    const csrf = line.match(/--csrf_token[= ]([\w-]+)/)?.[1] || '';
    const ext = Number(line.match(/--extension_server_port[= ](\d+)/)?.[1]);
    const ports = new Set();
    if (ext) [ext + 1, ext + 2, ext - 1, ext].forEach((p) => ports.add(p));
    for (const l of sh('lsof', ['-nP', '-a', '-p', pid, '-iTCP', '-sTCP:LISTEN']).split('\n')) {
      const m = l.match(/:(\d+) \(LISTEN\)/);
      if (m) ports.add(Number(m[1]));
    }
    for (const port of ports) {
      const status = (await post(port, 'GetUserStatus', csrf)) || (await post(port, 'RetrieveUserQuotaSummary', csrf));
      if (!status) continue;
      const quotas = [...collectQuotas(status).values()];
      if (!quotas.length) continue;
      const u = status.userStatus || status;
      const tier = u.userTier?.name || u.planStatus?.planInfo?.planName || u.planInfo?.planName || null;
      const minRemaining = Math.min(...quotas.map((q) => q.remaining));
      const fmtReset = (r) => {
        if (!r) return '';
        const ms = Date.parse(r) - Date.now();
        if (!Number.isFinite(ms) || ms <= 0) return '';
        const h = Math.floor(ms / 36e5);
        return h >= 24 ? ` · reset ${Math.round(h / 24)} j` : h >= 1 ? ` · reset ${h} h` : ` · reset ${Math.max(1, Math.round(ms / 6e4))} min`;
      };
      return {
        running: true,
        plan: tier ? `Antigravity · ${tier}` : 'Antigravity',
        used: 100 - minRemaining,
        limit: 100,
        unit: 'percent',
        models: quotas,
        details: quotas.sort((a, b) => a.remaining - b.remaining).slice(0, 6).map((q) => ({ label: q.label, value: `${q.remaining} % restant${fmtReset(q.resetTime)}` }))
      };
    }
  }
  return { running: true, error: 'serveur local introuvable' };
}

/* ---------- écriture + envoi ---------- */
const core = (x) => JSON.stringify(x ?? null, (k, v) => (['fetchedAt', 'updatedAt', 'details'].includes(k) ? undefined : v));

function git(...args) {
  return execFileSync('git', ['-C', DATA_DIR, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
}

export async function measure() {
  if (!fs.existsSync(path.join(DATA_DIR, '.git'))) throw new Error(`Repo de données introuvable : ${DATA_DIR} (règle FOCUS_DATA_DIR)`);
  if (!NO_PUSH) {
    try {
      git('pull', '--rebase', '--autostash', '-q');
    } catch (e) {
      log('git pull impossible :', String(e.stderr || e.message).trim());
    }
  }
  const prev = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  const services = { ...(prev.services || {}) };
  const now = Date.now();

  const cl = claudeCode();
  if (cl) {
    if (core(cl) !== core(services.claude)) services.claude = { ...cl, fetchedAt: now };
    log(`Claude Code : ${cl.used.toLocaleString('fr-FR')} tokens sur 7 jours`);
  } else log('Claude Code : aucun journal trouvé (~/.claude/projects)');

  const ag = await antigravity();
  if (ag.running && !ag.error) {
    if (core(ag) !== core(services.antigravity)) services.antigravity = { ...ag, fetchedAt: now };
    log(`Antigravity : ${ag.used} % utilisé (modèle le plus entamé)`);
  } else if (ag.error) log('Antigravity :', ag.error);
  else log("Antigravity : app fermée, quota gardé de la dernière mesure");

  const changed = core(services) !== core(prev.services || {});
  if (!changed && prev.updatedAt && now - prev.updatedAt < 6 * 36e5) return log('Rien de nouveau');
  fs.writeFileSync(FILE, JSON.stringify({ updatedAt: now, device: os.hostname().replace(/\.local$/, ''), services }, null, 2) + '\n');
  if (NO_PUSH) return log('usage-mac.json écrit (sans envoi)');
  try {
    git('add', 'usage-mac.json');
    git('-c', 'user.name=focus-mac', '-c', 'user.email=focus-mac@users.noreply.github.com', 'commit', '-q', '-m', `usage-mac: ${new Date().toISOString().slice(0, 16)}`);
    git('push', '-q');
    log('Envoyé dans focus-data ✓');
  } catch (e) {
    log('Envoi impossible :', String(e.stderr || e.message).trim());
  }
}

/* ---------- lancement automatique (launchd) ---------- */
function install() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array>
    <string>${process.execPath}</string>
    <string>${fileURLToPath(import.meta.url)}</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>FOCUS_DATA_DIR</key><string>${DATA_DIR}</string>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StartInterval</key><integer>${INTERVAL_MIN * 60}</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${path.join(os.homedir(), 'Library/Logs/focus-usage.log')}</string>
  <key>StandardErrorPath</key><string>${path.join(os.homedir(), 'Library/Logs/focus-usage.log')}</string>
</dict></plist>
`;
  fs.mkdirSync(path.dirname(PLIST), { recursive: true });
  fs.writeFileSync(PLIST, xml);
  sh('launchctl', ['unload', PLIST]);
  execFileSync('launchctl', ['load', PLIST]);
  console.log(`✓ Installé : mesure toutes les ${INTERVAL_MIN} min, journal dans ~/Library/Logs/focus-usage.log`);
  console.log("  Si macOS demande l'accès au dossier Bureau pour « node », accepte (le repo focus-data y est rangé).");
}

function uninstall() {
  sh('launchctl', ['unload', PLIST]);
  try {
    fs.unlinkSync(PLIST);
  } catch {}
  console.log('✓ Lancement automatique arrêté');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === 'install') install();
  else if (arg === 'uninstall') uninstall();
  else if (arg === 'watch') {
    const run = () => measure().catch((e) => log('Erreur :', e.message));
    await run();
    setInterval(run, INTERVAL_MIN * 6e4);
  } else await measure().catch((e) => { log('Erreur :', e.message); process.exitCode = 1; });
}
