/**
 * Regresión: los chats y mensajes conversacionales de Padbol Match no deben
 * mostrar emojis (bienvenida, placeholders, chips/botones, franjas, estados,
 * mensajes automáticos), ni las cinco experiencias del sitio público.
 * Cubre i18n (chatbot.*, publicSite.*), fallbacks hardcodeados y componentes.
 */
const fs = require('fs');
const path = require('path');

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{23E9}-\u{23FA}\u{2B50}\u{2705}\u{274C}\u{2764}\u{FE0F}]/u;

const LOCALES = ['es', 'en', 'pt', 'fr', 'de', 'it', 'ro', 'ar'];
const EXPERIENCES = ['signature', 'stadium', 'express', 'arena', 'quantum'];

function collectEmojiStrings(value, prefix, out) {
  if (typeof value === 'string') {
    if (EMOJI_RE.test(value)) out.push(`${prefix} = ${value}`);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      collectEmojiStrings(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

function readLocale(locale) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, `../i18n/locales/${locale}.json`), 'utf8'),
  );
}

function readSrc(relPath) {
  return fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
}

describe('chats y mensajes conversacionales sin emojis', () => {
  it.each(LOCALES)('claves chatbot.* de %s sin emojis', (locale) => {
    const chatbot = readLocale(locale).chatbot || {};
    expect(Object.keys(chatbot).length).toBeGreaterThan(0);
    expect(collectEmojiStrings(chatbot, 'chatbot', [])).toEqual([]);
  });

  it.each(LOCALES)('claves publicSite.* (experiencias y comunidad) de %s sin emojis', (locale) => {
    const publicSite = readLocale(locale).publicSite || {};
    expect(collectEmojiStrings(publicSite, 'publicSite', [])).toEqual([]);
  });

  it('las cinco experiencias existen en es y no tienen emojis en título ni texto', () => {
    const items = readLocale('es').publicSite?.experiences?.items || {};
    for (const exp of EXPERIENCES) {
      expect(items[exp]).toBeTruthy();
      expect(collectEmojiStrings(items[exp], `experiences.${exp}`, [])).toEqual([]);
    }
  });

  it.each([
    'components/ChatbotIA.jsx',
    'components/ChatbotIASafe.jsx',
  ])('componente conversacional %s sin emojis (incluye fallbacks hardcodeados)', (rel) => {
    const src = readSrc(rel);
    const hits = src
      .split('\n')
      .map((line, i) => (EMOJI_RE.test(line) ? `${i + 1}: ${line.trim()}` : null))
      .filter(Boolean);
    expect(hits).toEqual([]);
  });

  it.each([
    'pages/publicSite/sections/ExperiencesSection.jsx',
    'pages/publicSite/sections/CommunitySection.jsx',
    'constants/publicSiteExperiences.js',
    'content/publicSiteContent.js',
  ])('experiencias/comunidad del sitio público: %s sin emojis', (rel) => {
    expect(EMOJI_RE.test(readSrc(rel))).toBe(false);
  });

  it.each([
    'pages/ArmarPartido.jsx',
    'pages/PartidosAbiertos.jsx',
    'components/PartidoAbiertoCard.jsx',
  ])('superficies de comunidad: %s sin emojis', (rel) => {
    const hits = readSrc(rel)
      .split('\n')
      .map((line, i) => (EMOJI_RE.test(line) ? `${i + 1}: ${line.trim()}` : null))
      .filter(Boolean);
    expect(hits).toEqual([]);
  });
});
