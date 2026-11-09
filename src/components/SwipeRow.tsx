import { useEffect, useRef, type ReactNode } from 'react';
import { haptic } from '../utils';

/* Ligne qu'on fait glisser, comme dans Mail / Things :
   → vers la droite = action principale (ex. terminer), ← vers la gauche = action secondaire (ex. demain).
   Pas de re-render pendant le geste : tout passe par le DOM pour rester à 60 i/s. */
const THRESHOLD = 80;

export function SwipeRow({
  children,
  onRight,
  onLeft,
  right,
  left
}: {
  children: ReactNode;
  onRight?: () => void;
  onLeft?: () => void;
  right?: ReactNode; // contenu révélé en glissant vers la droite
  left?: ReactNode; // contenu révélé en glissant vers la gauche
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const cb = useRef({ onRight, onLeft });
  cb.current = { onRight, onLeft };
  const swallow = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    const c = content.current;
    if (!el || !c) return;
    let x0 = 0, y0 = 0, dx = 0;
    let mode: 'idle' | 'maybe' | 'x' = 'idle';
    let armed = false;

    const set = (x: number, animate: boolean) => {
      c.style.transition = animate ? 'transform .26s cubic-bezier(.2,.9,.25,1)' : 'none';
      c.style.transform = x ? `translateX(${x}px)` : '';
      el.classList.toggle('sw-right', x > 0);
      el.classList.toggle('sw-left', x < 0);
    };
    const start = (e: TouchEvent) => {
      mode = 'idle';
      if (e.touches.length !== 1) return;
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      dx = 0;
      armed = false;
      mode = 'maybe';
    };
    const move = (e: TouchEvent) => {
      if (mode === 'idle') return;
      const x = e.touches[0].clientX - x0;
      const y = e.touches[0].clientY - y0;
      if (mode === 'maybe') {
        if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
        // on ne prend la main que si le geste est franchement horizontal : le scroll vertical reste prioritaire
        if (Math.abs(x) < Math.abs(y) * 1.2) { mode = 'idle'; return; }
        mode = 'x';
        el.classList.add('swiping');
      }
      e.preventDefault();
      const can = x > 0 ? cb.current.onRight : cb.current.onLeft;
      let d = can ? x : x / 5;
      const lim = el.offsetWidth * 0.55;
      if (Math.abs(d) > lim) d = Math.sign(d) * (lim + (Math.abs(d) - lim) * 0.2);
      dx = d;
      set(dx, false);
      const nowArmed = !!can && Math.abs(dx) > THRESHOLD;
      if (nowArmed !== armed) {
        armed = nowArmed;
        el.classList.toggle('armed', armed);
      }
    };
    const end = () => {
      if (mode !== 'x') { mode = 'idle'; return; }
      mode = 'idle';
      swallow.current = true;
      setTimeout(() => (swallow.current = false), 400);
      el.classList.remove('swiping', 'armed');
      const action = armed ? (dx > 0 ? cb.current.onRight : cb.current.onLeft) : undefined;
      if (action) {
        haptic();
        try { localStorage.setItem('focus.swipeLearned', '1'); } catch {}
        set(Math.sign(dx) * el.offsetWidth, true);
        setTimeout(() => {
          action();
          // si la ligne est toujours là (elle n'a pas quitté la liste), on la remet en place
          requestAnimationFrame(() => set(0, false));
        }, 200);
      } else {
        set(0, true);
      }
      armed = false;
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
  }, []);

  return (
    <div
      ref={wrap}
      className="swipe"
      onClickCapture={(e) => {
        if (swallow.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {onRight && <div className="swipe-bg swipe-bg-right">{right}</div>}
      {onLeft && <div className="swipe-bg swipe-bg-left">{left}</div>}
      <div ref={content} className="swipe-content">{children}</div>
    </div>
  );
}
