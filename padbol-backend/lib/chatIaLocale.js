const localeAliases = {
  af: 'af', ar: 'ar', cs: 'cs', de: 'de', el: 'el', en: 'en', es: 'es',
  fa: 'fa', fr: 'fr', he: 'he', hu: 'hu', it: 'it', nl: 'nl', pl: 'pl',
  pt: 'pt', ro: 'ro', sv: 'sv', uk: 'uk',
};

export function normalizeChatIaLocale(raw) {
  const normalized = String(raw || '').trim().replace(/_/g, '-').toLowerCase().slice(0, 24);
  if (!normalized) return 'es';
  const [language] = normalized.split('-');
  return localeAliases[language] || 'es';
}

function foldText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function chatIaInferWritingLocaleFromConversation(mensaje, historial, fallbackLocaleRaw = 'es') {
  const parts = [];
  if (Array.isArray(historial)) {
    for (const row of historial) {
      if (row && row.role === 'user' && String(row.content || '').trim()) parts.push(String(row.content).trim());
    }
  }
  if (String(mensaje || '').trim()) parts.push(String(mensaje).trim());
  const text = parts.join('\n');
  const fallbackLocale = normalizeChatIaLocale(fallbackLocaleRaw);
  if (!text.trim()) return fallbackLocale;

  const fold = foldText(text);
  const pad = ` ${fold.replace(/\s+/g, ' ')} `;
  const scores = { pt: 0, es: 0, en: 0, ro: 0 };

  if (/[ãõ]/i.test(text) || /não/i.test(text)) scores.pt += 4;
  if (/ñ|¿|¡/.test(text)) scores.es += 4;
  if (/[ăâîșțĂÂÎȘȚ]/.test(text)) scores.ro += 4;
  if (/\b(nao|voce|voces|torneio|obrigado|obrigada|quadras|disponivel|tambem|amanha)\b/.test(pad)) scores.pt += 3;
  if (/\b(manana|hoy|cuando|donde|cancha|turno|disponibilidad|quiero|gracias|sedes?|horarios)\b/.test(pad)) scores.es += 3;
  if (/\b(tomorrow|today|when|where|booking|available|slot|courts|tournament|thanks|please|what\s+time|how\s+do)\b/.test(pad)) scores.en += 3;
  if (/\b(vreau|joc|juca|maine|astazi|unde|teren|rezervare|multumesc|turneu|disponibil|clasament)\b/.test(pad)) scores.ro += 3;
  if (/\b(voce|voces)\b/.test(pad)) scores.pt += 2;
  if (/\b(the|and|with|for)\b/.test(pad)) scores.en += 1;
  if (/\b(el|la|los|las|una|por|para)\b/.test(pad)) scores.es += 1;

  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (ordered[0][1] > 0 && ordered[0][1] > ordered[1][1]) return ordered[0][0];
  return fallbackLocale;
}

export function chatIaLuxonLocaleForUi(lang) {
  const locale = normalizeChatIaLocale(lang);
  return {
    ar: 'ar-SA', fa: 'fa-IR', he: 'he-IL', pt: 'pt-BR', ro: 'ro-RO', uk: 'uk-UA',
  }[locale] || locale;
}

export function chatIaClaudeLanguageName(lang) {
  const locale = normalizeChatIaLocale(lang);
  return {
    af: 'Afrikaans', ar: 'Arabic', cs: 'Czech', de: 'German', el: 'Greek', en: 'English',
    es: 'Spanish', fa: 'Persian', fr: 'French', he: 'Hebrew', hu: 'Hungarian', it: 'Italian',
    nl: 'Dutch', pl: 'Polish', pt: 'Portuguese', ro: 'Romanian', sv: 'Swedish', uk: 'Ukrainian',
  }[locale] || 'Spanish';
}
