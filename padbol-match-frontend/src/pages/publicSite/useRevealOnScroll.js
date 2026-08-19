import { useEffect } from 'react';

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Sistema de revelado compartido para la web pública.
 * - Un solo IntersectionObserver para todos los `[data-ps-reveal]`.
 * - El contenido es visible por defecto: solo se oculta cuando JS armó
 *   el efecto (`ps-reveal-armed`), garantizando lectura sin animaciones.
 * - Activación única; stagger con `data-ps-reveal-order`.
 * - Con `prefers-reduced-motion` no se arma nada.
 */
export default function useRevealOnScroll(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const targets = Array.from(root.querySelectorAll('[data-ps-reveal]'));
    if (!targets.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const order = Number(el.getAttribute('data-ps-reveal-order') || 0);
          el.style.setProperty('--ps-reveal-delay', `${Math.min(order, 8) * 90}ms`);
          el.style.willChange = 'opacity, transform';
          el.classList.add('ps-reveal-in');
          const releaseLayer = () => {
            el.style.willChange = '';
          };
          el.addEventListener('transitionend', releaseLayer, { once: true });
          observer.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );

    targets.forEach((el) => {
      el.classList.add('ps-reveal-armed');
      observer.observe(el);
    });

    return () => {
      observer.disconnect();
      targets.forEach((el) => {
        el.classList.remove('ps-reveal-armed');
        el.style.willChange = '';
      });
    };
  }, [rootRef]);
}
