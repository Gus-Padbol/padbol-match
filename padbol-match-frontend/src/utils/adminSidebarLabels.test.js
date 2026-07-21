/**
 * MEJ-02 (QA 15): el sidebar del panel admin no debe usar emojis en sus ítems.
 * Guarda contra regresiones tanto en las labels hardcodeadas del JSX como en
 * las claves admin.tabs de todos los idiomas.
 */
const fs = require('fs');
const path = require('path');

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{FE0F}]/u;

const LOCALES = ['es', 'en', 'it', 'ro', 'de', 'fr', 'pt', 'ar'];

describe('MEJ-02 — sidebar admin sin emojis', () => {
  it.each(LOCALES)('admin.tabs de %s no contiene emojis', (locale) => {
    const raw = fs.readFileSync(
      path.join(__dirname, `../i18n/locales/${locale}.json`),
      'utf8',
    );
    const tabs = JSON.parse(raw)?.admin?.tabs || {};
    expect(Object.keys(tabs).length).toBeGreaterThan(0);
    for (const [key, label] of Object.entries(tabs)) {
      expect({ key, hasEmoji: EMOJI_RE.test(label) }).toEqual({ key, hasEmoji: false });
      expect(label).toBe(label.trim());
    }
  });

  it('AdminDashboard.jsx no define labels de tabs con emojis', () => {
    const jsx = fs.readFileSync(
      path.join(__dirname, '../pages/AdminDashboard.jsx'),
      'utf8',
    );
    // Solo objetos de tab del sidebar/strip: `{ id: 'xxx', label: ... }`.
    const labelValues = [
      ...jsx.matchAll(/\{\s*id:\s*'[a-z_]+',\s*label:\s*(?:'([^']*)'|t\('[^']*'(?:,\s*'([^']*)')?\))/g),
    ]
      .map((m) => m[1] ?? m[2])
      .filter(Boolean);
    expect(labelValues.length).toBeGreaterThan(0);
    for (const label of labelValues) {
      expect({ label, hasEmoji: EMOJI_RE.test(label) }).toEqual({ label, hasEmoji: false });
    }
  });
});
