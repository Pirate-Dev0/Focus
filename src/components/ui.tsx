import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check as CheckIcon, X } from 'lucide-react';
import type { Priority, Status } from '../types';
import { clamp, haptic } from '../utils';

/* ---------- Sheet (bas d'écran sur iPhone, modale sur ordi) ----------
   - se ferme en glissant vers le bas (depuis la poignée, l'en-tête, ou le contenu quand il est tout en haut)
   - anime aussi sa sortie, même quand c'est le parent qui la ferme */
let lockCount = 0;
function lockScroll(on: boolean) {
  lockCount = Math.max(0, lockCount + (on ? 1 : -1));
  document.documentElement.classList.toggle('scroll-locked', lockCount > 0);
}
const isDesktop = () => window.matchMedia('(min-width: 900px)').matches;

export function Sheet({ open, onClose, title, children, full, actions, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; full?: boolean; actions?: ReactNode; footer?: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const internal = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // garde le dernier contenu pour l'animation de sortie
  const last = useRef({ title, children, actions, footer });
  if (open) last.current = { title, children, actions, footer };
  const sheetRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  if (open && !mounted) setMounted(true);
  if (open && closing && !internal.current) setClosing(false);
  if (!open && mounted && !closing) setClosing(true);

  const requestClose = useCallback(() => {
    internal.current = true;
    setClosing(true);
  }, []);

  useEffect(() => {
    if (!closing) return;
    const el = sheetRef.current;
    if (el) { el.style.transform = ''; el.style.transition = ''; }
    if (backRef.current) backRef.current.style.opacity = '';
    const t = setTimeout(() => {
      setClosing(false);
      setMounted(false);
      if (internal.current) {
        internal.current = false;
        onCloseRef.current();
      }
    }, 210);
    return () => clearTimeout(t);
  }, [closing]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose();
    window.addEventListener('keydown', onKey);
    lockScroll(true);
    return () => {
      window.removeEventListener('keydown', onKey);
      lockScroll(false);
    };
  }, [mounted, requestClose]);

  // glisser vers le bas pour fermer (iPhone)
  useEffect(() => {
    const el = sheetRef.current;
    const body = bodyRef.current;
    if (!mounted || !el || !body || isDesktop()) return;
    let y0 = 0, x0 = 0, t0 = 0, dy = 0;
    let mode: 'idle' | 'maybe' | 'drag' = 'idle';
    const start = (e: TouchEvent) => {
      mode = 'idle';
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement;
      const inBody = body.contains(target);
      if (inBody && (body.scrollTop > 0 || target.closest('input, textarea, select, [data-nodrag]'))) return;
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; t0 = performance.now(); dy = 0;
      mode = 'maybe';
    };
    const move = (e: TouchEvent) => {
      if (mode === 'idle') return;
      const y = e.touches[0].clientY - y0, x = e.touches[0].clientX - x0;
      if (mode === 'maybe') {
        if (Math.abs(y) < 7 && Math.abs(x) < 7) return;
        if (y <= 0 || Math.abs(x) > Math.abs(y)) { mode = 'idle'; return; }
        mode = 'drag';
        el.style.transition = 'none';
        if (backRef.current) backRef.current.style.transition = 'none';
      }
      e.preventDefault();
      dy = Math.max(0, y);
      el.style.transform = `translateY(${dy}px)`;
      if (backRef.current) backRef.current.style.opacity = String(Math.max(0, 1 - dy / Math.max(320, el.offsetHeight)));
    };
    const end = () => {
      if (mode !== 'drag') { mode = 'idle'; return; }
      mode = 'idle';
      const v = dy / Math.max(1, performance.now() - t0);
      if (backRef.current) backRef.current.style.transition = '';
      if (dy > Math.min(150, el.offsetHeight * 0.28) || (v > 0.55 && dy > 30)) {
        el.style.transition = '';
        requestClose();
      } else {
        el.style.transition = 'transform .28s cubic-bezier(.2,.9,.25,1)';
        el.style.transform = 'translateY(0)';
        if (backRef.current) backRef.current.style.opacity = '';
      }
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [mounted, requestClose]);

  if (!mounted) return null;
  const c = open ? { title, children, actions, footer } : last.current;
  return createPortal(
    <SheetCtx.Provider value={requestClose}>
      <div ref={backRef} className={'sheet-backdrop' + (closing ? ' closing' : '')} onClick={requestClose} />
      <div ref={sheetRef} className={'sheet' + (full ? ' full' : '') + (closing ? ' closing' : '')} role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h3>{c.title}</h3>
          <div className="row" style={{ gap: 4 }}>
            {c.actions}
            <button className="icon-btn" onClick={requestClose} aria-label="Fermer"><X size={18} /></button>
          </div>
        </div>
        <div ref={bodyRef} className={'sheet-body' + (c.footer ? ' has-foot' : '')}>{c.children}</div>
        {c.footer && <div className="sheet-foot">{c.footer}</div>}
      </div>
    </SheetCtx.Provider>,
    document.body
  );
}
// Permet à un bouton dans la fenêtre de la fermer avec l'animation : const close = useSheetClose();
const SheetCtx = createContext<() => void>(() => {});
export const useSheetClose = () => useContext(SheetCtx);

// iOS n'ouvre le clavier que si le focus arrive pendant le tap. On donne le focus tout de suite à un champ
// invisible ; le vrai champ le récupère dès que la fenêtre est affichée et le clavier reste ouvert.
export function primeKeyboard() {
  try {
    const el = document.createElement('input');
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
    el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;pointer-events:none';
    document.body.appendChild(el);
    el.focus({ preventScroll: true });
    setTimeout(() => el.remove(), 1200);
  } catch {}
}

export function Progress({ value, max, height = 4 }: { value: number; max: number | null; height?: number }) {
  const pct = max ? clamp(value / max) * 100 : 0;
  return (
    <div className="progress" style={{ height }}>
      <div style={{ width: pct + '%' }} />
    </div>
  );
}

export function Sparkline({ data, width = 120, height = 32, fill = true }: { data: number[]; width?: number; height?: number; fill?: boolean }) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      {fill && <path d={`${d} L${width} ${height} L0 ${height} Z`} fill="currentColor" opacity={0.07} />}
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.5} fill="currentColor" />
    </svg>
  );
}

/* Icônes de statut façon Linear */
export function StatusIcon({ status, size = 15 }: { status: Status; size?: number }) {
  const c = 'currentColor';
  if (status === 'done')
    return (
      <svg width={size} height={size} viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill={c} /><path d="M5 8.2 7 10.2 11 6" stroke="var(--bg-elev)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    );
  if (status === 'doing')
    return (
      <svg width={size} height={size} viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.3" stroke={c} strokeWidth="1.5" fill="none" /><path d="M8 4a4 4 0 0 1 0 8z" fill={c} /></svg>
    );
  if (status === 'blocked')
    return (
      <svg width={size} height={size} viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.3" stroke="var(--danger)" strokeWidth="1.5" fill="none" /><path d="M5.5 10.5l5-5" stroke="var(--danger)" strokeWidth="1.5" strokeLinecap="round" /></svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.3" stroke={c} strokeWidth="1.5" fill="none" strokeDasharray="2.2 2.2" opacity=".7" /></svg>
  );
}

export function PriorityIcon({ p, size = 14 }: { p: Priority; size?: number }) {
  if (p === 'p0')
    return (
      <svg width={size} height={size} viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="3.5" fill="var(--danger)" /><path d="M8 4.5v4.2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /><circle cx="8" cy="11.2" r="1" fill="#fff" /></svg>
    );
  if (p === 'none')
    return (
      <svg width={size} height={size} viewBox="0 0 16 16"><path d="M3 8h1.5M7.25 8h1.5M11.5 8H13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".5" /></svg>
    );
  const lvl = p === 'p1' ? 3 : p === 'p2' ? 2 : 1;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={2.5 + i * 4} y={10 - i * 3} width="3" height={4 + i * 3} rx="1" fill="currentColor" opacity={i < lvl ? 1 : 0.25} />
      ))}
    </svg>
  );
}

export function Check({ on, onClick, square }: { on: boolean; onClick?: () => void; square?: boolean }) {
  return (
    <button
      className={'check' + (on ? ' on' : '') + (square ? ' square' : '')}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      aria-pressed={on}
    >
      {on && <CheckIcon size={13} strokeWidth={3} />}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, full }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; full?: boolean }) {
  return (
    <div className={'seg' + (full ? ' full' : '')}>
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* Rangée de chips qui défile : l'élément choisi est toujours visible à l'ouverture */
export function ChipScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const on = el?.querySelector('.solid') as HTMLElement | null;
    if (el && on && (on.offsetLeft + on.offsetWidth > el.clientWidth + el.scrollLeft || on.offsetLeft < el.scrollLeft)) el.scrollLeft = on.offsetLeft - 16;
  });
  return <div ref={ref} className="chip-scroll" data-nodrag>{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

/* Champ numérique qui accepte la virgule */
export function NumInput({ value, onChange, placeholder, className = 'input', autoFocus, step }: { value: number | undefined | null; onChange: (n: number) => void; placeholder?: string; className?: string; autoFocus?: boolean; step?: string }) {
  const [txt, setTxt] = useState(value == null || Number.isNaN(value) ? '' : String(value).replace('.', ','));
  useEffect(() => {
    const parsed = parseFloat(txt.replace(',', '.'));
    if ((value ?? NaN) !== parsed && !(value == null && txt === '')) setTxt(value == null ? '' : String(value).replace('.', ','));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className={className}
      inputMode="decimal"
      placeholder={placeholder}
      autoFocus={autoFocus}
      step={step}
      value={txt}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.,-]/g, '');
        setTxt(t);
        const n = parseFloat(t.replace(',', '.'));
        onChange(Number.isNaN(n) ? 0 : n);
      }}
    />
  );
}

/* ---------- Toast (avec bouton « Annuler » optionnel) ---------- */
type ToastData = { id: number; msg: string; action?: { label: string; run: () => void } };
let toastData: ToastData | null = null;
const toastL = new Set<() => void>();
let toastTimer: ReturnType<typeof setTimeout>;
const emitToast = (d: ToastData | null) => {
  toastData = d;
  toastL.forEach((l) => l());
};
export function toast(msg: string, action?: { label: string; run: () => void }) {
  emitToast({ id: Date.now(), msg, action });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => emitToast(null), action ? 4000 : 2200);
}
export function Toaster() {
  const t = useSyncExternalStore(
    (l) => {
      toastL.add(l);
      return () => toastL.delete(l);
    },
    () => toastData
  );
  if (!t) return null;
  return (
    <div className="toast" key={t.id} role="status">
      <span className="grow">{t.msg}</span>
      {t.action && (
        <button
          className="toast-action"
          onClick={() => {
            t.action!.run();
            haptic();
            clearTimeout(toastTimer);
            emitToast(null);
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children}
    </div>
  );
}
