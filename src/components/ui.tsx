import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check as CheckIcon, X } from 'lucide-react';
import type { Priority, Status } from '../types';
import { clamp } from '../utils';

/* ---------- Sheet (bas d'écran sur iPhone, modale sur ordi) ---------- */
export function Sheet({ open, onClose, title, children, full, actions }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; full?: boolean; actions?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={'sheet' + (full ? ' full' : '')} role="dialog">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <div className="row" style={{ gap: 4 }}>
            {actions}
            <button className="icon-btn" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>,
    document.body
  );
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

/* ---------- Toast ---------- */
let toastMsg: string | null = null;
const toastL = new Set<() => void>();
let toastTimer: ReturnType<typeof setTimeout>;
export function toast(msg: string) {
  toastMsg = msg;
  toastL.forEach((l) => l());
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMsg = null;
    toastL.forEach((l) => l());
  }, 2200);
}
export function Toaster() {
  const msg = useSyncExternalStore(
    (l) => {
      toastL.add(l);
      return () => toastL.delete(l);
    },
    () => toastMsg
  );
  return msg ? <div className="toast">{msg}</div> : null;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children}
    </div>
  );
}
