// iPhone (surtout en app installée) : quand on tape dans un champ, iOS « recentre » parfois la page
// tout seul et se trompe de cible — la page file vers le bas et le champ sort de l'écran.
// Règle simple : si le champ est entièrement visible au moment où on tape, la frappe ne doit pas
// faire bouger la page. On mémorise la position juste avant la frappe et on la remet si iOS la déplace.
// On ne touche jamais à un défilement fait au doigt, ni à l'ouverture du clavier (focus).

const HOLD_MS = 700;

export function startTypingGuard() {
  if (!window.matchMedia('(pointer: coarse)').matches) return () => {};
  const vv = window.visualViewport;
  let saved: number | null = null;
  let until = 0;
  let touching = false;
  let timers: number[] = [];

  const pageTop = () => (vv ? vv.pageTop : window.scrollY);
  const fullyVisible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const top = vv ? vv.offsetTop : 0;
    const height = vv ? vv.height : window.innerHeight;
    return r.top >= top && r.bottom <= top + height;
  };
  const release = () => {
    saved = null;
    timers.forEach(clearTimeout);
    timers = [];
  };
  const restore = () => {
    if (saved === null || touching) return;
    if (performance.now() > until) return release();
    if (Math.abs(pageTop() - saved) > 1) window.scrollTo(0, saved);
  };

  const onBeforeInput = (e: Event) => {
    const el = e.target;
    if (touching || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    release();
    // Entrée = validation : la page a le droit de bouger (ex. suivre le champ après un ajout)
    if ((e as InputEvent).inputType === 'insertLineBreak') return;
    if (!fullyVisible(el)) return; // champ caché (sous le clavier…) : on laisse iOS le ramener
    saved = pageTop();
    until = performance.now() + HOLD_MS;
    // filet de sécurité si iOS anime son défilement sans prévenir
    timers = [60, 200, 400, HOLD_MS - 20].map((ms) => window.setTimeout(restore, ms));
  };
  const onTouchStart = () => { touching = true; release(); };
  const onTouchEnd = (e: TouchEvent) => { touching = e.touches.length > 0; };

  document.addEventListener('beforeinput', onBeforeInput, true);
  document.addEventListener('focusout', release, true);
  document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
  document.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });
  window.addEventListener('scroll', restore, { passive: true });
  vv?.addEventListener('scroll', restore);

  return () => {
    release();
    document.removeEventListener('beforeinput', onBeforeInput, true);
    document.removeEventListener('focusout', release, true);
    document.removeEventListener('touchstart', onTouchStart, true);
    document.removeEventListener('touchend', onTouchEnd, true);
    document.removeEventListener('touchcancel', onTouchEnd, true);
    window.removeEventListener('scroll', restore);
    vv?.removeEventListener('scroll', restore);
  };
}
