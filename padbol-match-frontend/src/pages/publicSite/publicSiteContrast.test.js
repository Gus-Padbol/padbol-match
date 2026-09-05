/**
 * Regresión de contraste de la web pública (/plataforma).
 *
 * Protege contra:
 * - títulos que hereden el color oscuro global de App.css (h1/h2/h3 #1a1a1a)
 *   sobre el fondo oscuro de la web pública;
 * - la experiencia activa sin variable de contraste (--ps-accent-readable);
 * - acentos de experiencia que, aclarados, no lleguen a contraste AA.
 *
 * JSDOM no aplica los .css de CRA, así que se auditan las reglas como texto
 * y el contraste se calcula con la fórmula WCAG.
 */

const fs = require('fs');
const path = require('path');

const {
  PUBLIC_SITE_EXPERIENCE_LIST,
} = require('../../constants/publicSiteExperiences');

const css = fs.readFileSync(path.join(__dirname, 'publicSite.css'), 'utf8');

/* ── utilidades WCAG ── */

const channel = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/* Réplica de color-mix(in srgb, accent 60%, #fff) usada en el CSS. */
const mixWithWhite = (hex, weight) => {
  const h = hex.replace('#', '');
  const mix = (i) =>
    Math.round(parseInt(h.slice(i, i + 2), 16) * weight + 255 * (1 - weight));
  return [0, 2, 4]
    .map((i) => mix(i).toString(16).padStart(2, '0'))
    .join('');
};

const EXPERIENCES_SECTION_BG = '0a0f1c'; /* --ps-bg-2 */
const ACCENT_MIX_WEIGHT = 0.6; /* 60% acento + 40% blanco */

describe('contraste de títulos de la web pública', () => {
  it('los headings quedan blindados contra el color oscuro global de App.css', () => {
    /* Scope .public-site h1..h6 con color claro: sin él, h2/h3 heredan #1a1a1a. */
    const scoped = css.match(
      /\.public-site h1,\s*\.public-site h2,\s*\.public-site h3,\s*\.public-site h4,\s*\.public-site h5,\s*\.public-site h6 \{[^}]*color: var\(--ps-heading\);[^}]*\}/,
    );
    expect(scoped).not.toBeNull();
  });

  it('define variables de heading claras (sin tonos oscuros ni opacidad)', () => {
    expect(css).toMatch(/--ps-heading: var\(--ps-text\);/);
    expect(css).toMatch(/--ps-heading-muted: var\(--ps-text-2\);/);
    /* --ps-text debe seguir siendo un blanco legible sobre --ps-bg. */
    const psText = css.match(/--ps-text: #([0-9a-f]{6});/i);
    expect(psText).not.toBeNull();
    expect(contrast(psText[1], '05070d')).toBeGreaterThanOrEqual(4.5);
  });

  it('el título de la experiencia activa usa la variante legible del acento', () => {
    const rule = css.match(/\.ps-exp-stage__copy h3 \{[^}]*\}/);
    expect(rule).not.toBeNull();
    /* Fallback claro + variante legible: nunca hereda el #1a1a1a global. */
    expect(rule[0]).toMatch(/color: var\(--ps-heading\);/);
    expect(rule[0]).toMatch(/color: var\(--ps-accent-readable, var\(--ps-heading\)\);/);
    /* La sección define la variable derivada del acento de la experiencia. */
    expect(css).toMatch(
      /--ps-accent-readable: color-mix\(in srgb, var\(--exp-accent, var\(--ps-accent\)\) 60%, #fff\);/,
    );
  });

  it('los cinco acentos aclarados cumplen AA sobre el fondo de la sección', () => {
    expect(PUBLIC_SITE_EXPERIENCE_LIST).toHaveLength(5);
    PUBLIC_SITE_EXPERIENCE_LIST.forEach((exp) => {
      const readable = mixWithWhite(exp.accent, ACCENT_MIX_WEIGHT);
      const ratio = contrast(readable, EXPERIENCES_SECTION_BG);
      /* Texto grande exige 3:1; se pide 4.5:1 (AA texto normal) como margen. */
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('ningún título de la web pública usa colores oscuros hardcodeados', () => {
    /* Reglas de heading dentro de publicSite.css con color casi negro
       (se descartan los comentarios y la sección clara "Quiénes somos"). */
    const cssSinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const headingRules = cssSinComentarios.match(/[^{}]*h[1-6][^{}]*\{[^}]*\}/g) || [];
    headingRules.forEach((rule) => {
      if (rule.includes('.ps-section--about')) return;
      expect(rule).not.toMatch(/color:\s*#(0[0-9a-f]{2}|1[0-9a-f]{2}|2[0-9a-f]{2})[0-9a-f]{3}\b/i);
      expect(rule).not.toMatch(/color:\s*(black|#000)/i);
    });
  });

  it('el título oscuro de Quiénes somos contrasta con su fondo claro', () => {
    const background = css.match(/\.ps-section--about\s*\{[^}]*background:\s*#([0-9a-f]{6})/i);
    const heading = css.match(/\.ps-section--about h2,[^{}]*\{[^}]*color:\s*#([0-9a-f]{6})/i);
    expect(background).not.toBeNull();
    expect(heading).not.toBeNull();
    expect(contrast(background[1], heading[1])).toBeGreaterThanOrEqual(4.5);
  });
});
