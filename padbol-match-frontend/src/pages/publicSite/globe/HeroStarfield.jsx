import React, { useEffect, useRef } from 'react';
import { STARFIELD_THEME } from './globeVisualTheme';

/**
 * Fondo estelar del Hero (3 capas + nebulosa).
 * Parallax lento, independiente de la rotación del globo.
 */
export default function HeroStarfield({
  reducedMotion = false,
  compact = false,
  tablet = false,
}) {
  const canvasRef = useRef(null);
  const scrollingRef = useRef(false);
  const counts = compact
    ? STARFIELD_THEME.mobile
    : tablet
      ? STARFIELD_THEME.tablet
      : STARFIELD_THEME.desktop;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let raf = 0;
    let start = performance.now();
    let w = 0;
    let h = 0;
    let settleTimer = 0;
    // El fondo no requiere la misma densidad que el globo: limitarlo en
    // escritorio deja más tiempo al scroll y a la interacción inicial.
    const dpr = Math.min(window.devicePixelRatio || 1, compact ? 2 : 1.25);

    const hash = (n) => {
      const x = Math.sin(n * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };

    const pickTone = (seed) => {
      const tones = STARFIELD_THEME.tones;
      let t = hash(seed);
      for (let i = 0; i < tones.length; i += 1) {
        t -= tones[i].weight;
        if (t <= 0) return tones[i].rgb;
      }
      return tones[0].rgb;
    };

    const makeStars = (count, seed, sizeMin, sizeMax, alphaMin, alphaMax) => {
      const out = [];
      for (let i = 0; i < count; i += 1) {
        out.push({
          x: hash(seed + i * 3.1),
          y: hash(seed + i * 7.7 + 1.3),
          r: sizeMin + hash(seed + i * 11.2) * (sizeMax - sizeMin),
          a: alphaMin + hash(seed + i * 19.4) * (alphaMax - alphaMin),
          rgb: pickTone(seed + i * 23.7),
          phase: hash(seed + i * 31.1) * Math.PI * 2,
          twinkle: 0.35 + hash(seed + i * 41.3) * 0.9,
          glow: hash(seed + i * 53.9) > 0.72,
        });
      }
      return out;
    };

    let far = [];
    let mid = [];
    let near = [];

    const resize = () => {
      const parent = canvas.parentElement;
      w = Math.max(320, Math.floor(parent?.clientWidth || window.innerWidth));
      h = Math.max(320, Math.floor(parent?.clientHeight || window.innerHeight));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { far: fz, mid: mz, near: nz } = STARFIELD_THEME.sizes;
      far = makeStars(counts.far, 11, fz[0], fz[1], 0.28, 0.62);
      mid = makeStars(counts.mid, 41, mz[0], mz[1], 0.38, 0.78);
      near = makeStars(counts.near, 73, nz[0], nz[1], 0.48, 0.9);
    };

    const markScrolling = () => {
      if (compact) return;
      scrollingRef.current = true;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        scrollingRef.current = false;
      }, 140);
    };

    resize();
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro && canvas.parentElement) ro.observe(canvas.parentElement);
    window.addEventListener('scroll', markScrolling, { passive: true });

    const drawNebula = (t) => {
      const drift = reducedMotion ? 0 : Math.sin(t * 0.04) * 0.015;
      const g1 = ctx.createRadialGradient(
        w * (0.78 + drift),
        h * 0.38,
        10,
        w * 0.62,
        h * 0.48,
        w * 0.78,
      );
      g1.addColorStop(0, 'rgba(12, 48, 78, 0.48)');
      g1.addColorStop(0.4, 'rgba(24, 36, 72, 0.14)');
      g1.addColorStop(1, 'rgba(8, 12, 22, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      const g2 = ctx.createRadialGradient(
        w * (0.22 - drift),
        h * 0.68,
        8,
        w * 0.35,
        h * 0.55,
        w * 0.55,
      );
      g2.addColorStop(0, 'rgba(60, 14, 28, 0.18)');
      g2.addColorStop(0.5, 'rgba(16, 48, 72, 0.12)');
      g2.addColorStop(1, 'rgba(8, 12, 22, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      const g3 = ctx.createRadialGradient(w * 0.5, h * 0.15, 4, w * 0.5, h * 0.35, w * 0.45);
      g3.addColorStop(0, 'rgba(40, 110, 150, 0.12)');
      g3.addColorStop(1, 'rgba(8, 12, 22, 0)');
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, w, h);
    };

    const drawTechLines = (t) => {
      const n = STARFIELD_THEME.techLines
        ? compact
          ? STARFIELD_THEME.techLines.mobile
          : tablet
            ? STARFIELD_THEME.techLines.tablet
            : STARFIELD_THEME.techLines.desktop
        : 0;
      for (let i = 0; i < n; i += 1) {
        const y = ((hash(90 + i * 7.3) + (reducedMotion ? 0 : t * 0.003 * (0.4 + i * 0.1))) % 1) * h;
        const x0 = hash(110 + i) * w * 0.4;
        const len = w * (0.18 + hash(130 + i) * 0.35);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(60, 170, 210, ${0.06 + hash(150 + i) * 0.08})`;
        ctx.lineWidth = 0.7;
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + len, y + (hash(170 + i) - 0.5) * 8);
        ctx.stroke();
      }
    };

    const drawLayer = (stars, offsetX, offsetY, alphaScale, t) => {
      stars.forEach((s) => {
        let x = (s.x + offsetX) % 1;
        let y = (s.y + offsetY) % 1;
        if (x < 0) x += 1;
        if (y < 0) y += 1;
        const tw = reducedMotion
          ? 1
          : 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(t * s.twinkle + s.phase));
        const alpha = s.a * alphaScale * tw;
        const px = x * w;
        const py = y * h;
        if (s.glow && s.r >= 1.4) {
          ctx.beginPath();
          ctx.fillStyle = `rgba(${s.rgb}, ${alpha * 0.22})`;
          ctx.arc(px, py, s.r * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.fillStyle = `rgba(${s.rgb}, ${alpha})`;
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const paint = (now) => {
      ctx.clearRect(0, 0, w, h);
      const t = reducedMotion ? 0 : (now - start) / 1000;
      drawNebula(t);
      drawTechLines(t);

      /* Capas mucho más lentas que el globo (~48s). */
      const farOx = reducedMotion ? 0 : t * 0.0022;
      const farOy = reducedMotion ? 0 : t * 0.0007;
      const midOx = reducedMotion ? 0 : t * 0.0045;
      const midOy = reducedMotion ? 0 : t * -0.0016;
      const nearOx = reducedMotion ? 0 : t * 0.0075;
      const nearOy = reducedMotion ? 0 : t * 0.0024;

      drawLayer(far, farOx, farOy, 0.9, t);
      drawLayer(mid, midOx, midOy, 1, t);
      drawLayer(near, nearOx, nearOy, 1.05, t);
    };

    let lastPaint = 0;
    const minFrameMs = compact ? 0 : tablet ? 25 : 42;
    const tick = (now) => {
      // El fondo estelar se mueve muy lentamente; a ~24 fps en escritorio se
      // percibe igual, pero deja libre el hilo principal para el primer scroll.
      if ((!scrollingRef.current || compact) && now - lastPaint >= minFrameMs) {
        paint(now);
        lastPaint = now;
      }
      if (!reducedMotion) raf = requestAnimationFrame(tick);
    };

    if (reducedMotion) {
      paint(performance.now());
      return () => {
        if (ro) ro.disconnect();
        window.removeEventListener('scroll', markScrolling);
        window.clearTimeout(settleTimer);
      };
    }
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener('scroll', markScrolling);
      window.clearTimeout(settleTimer);
    };
  }, [reducedMotion, compact, tablet, counts.far, counts.mid, counts.near]);

  return (
    <canvas
      ref={canvasRef}
      className="ps-hero__starfield"
      aria-hidden="true"
      data-starfield="true"
      data-star-layers="3"
      data-far-count={counts.far}
      data-mid-count={counts.mid}
      data-near-count={counts.near}
      data-motion={reducedMotion ? 'static' : 'slow'}
    />
  );
}
