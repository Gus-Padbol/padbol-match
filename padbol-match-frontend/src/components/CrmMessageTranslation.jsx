import React, { useMemo, useState } from 'react';
import './CrmMessageTranslation.css';

const LANGUAGE_WORDS = {
  en: ['the','and','to','of','in','is','we','you','for','with','hello','hi','interested','would','like','price','court','need','project','our','your','please','thanks','thank','from','this','that'],
  de: ['der','die','das','und','ist','wir','sie','für','mit','ein','eine','nicht','bitte','preis','anlage','interesse','haben','sind','auch','oder','von','zu','den','dem'],
  fr: ['le','la','les','et','est','nous','vous','pour','avec','un','une','pas','bonjour','merci','prix','projet','notre','votre','dans','sur','des','du','être','avoir'],
  ro: ['și','este','suntem','pentru','cu','un','o','nu','bună','mulțumesc','preț','proiect','noastră','dvs','sunt','avem','sau','din','la','în','pe'],
  pt: ['o','a','os','as','e','de','que','em','um','uma','para','com','não','olá','obrigado','preço','projeto','nosso','sua','seu','por','dos','das'],
  es: ['el','la','los','las','de','que','y','en','un','una','para','con','por','no','es','hola','gracias','necesito','quiero','sobre','cancha','precio','nuestro','su','del','al','pero','más','cómo'],
};

const MARKERS = [
  [/[ăâîșț]/i, 'ro'],
  [/[ß]/i, 'de'],
  [/[ãõ]/i, 'pt'],
  [/[äöü]/i, 'de'],
];

function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFC');
}

/** Lightweight on-device hint. It never translates; it only decides whether to offer the action. */
export function detectLikelyLanguage(text) {
  const value = normalize(text);
  if (!value.trim()) return null;
  const words = value.split(/[^a-zà-ÿăâîșț]+/i).filter(Boolean);
  const scores = Object.fromEntries(Object.keys(LANGUAGE_WORDS).map(key => [key, 0]));
  for (const word of words) {
    for (const [language, list] of Object.entries(LANGUAGE_WORDS)) {
      if (list.includes(word)) scores[language] += 1;
    }
  }
  for (const [pattern, language] of MARKERS) if (pattern.test(value)) scores[language] += 1;
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [best, score] = ranked[0] || [null, 0];
  const second = ranked[1]?.[1] || 0;
  if (!best || score < 2 || score === second) return null;
  return best;
}

export function shouldOfferTranslation(text) {
  const language = detectLikelyLanguage(text);
  return Boolean(language && language !== 'es');
}

function TranslationIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5.1 3h2.1l1 3h4.7V3h2v3h4v2h-1.5c-.5 2.8-1.8 5-3.8 6.8 1 .7 2.1 1.2 3.3 1.7l-.8 1.9a13 13 0 0 1-4.2-2.2 13 13 0 0 1-4.2 2.2l-.8-1.9c1.2-.5 2.3-1 3.3-1.7-2-1.8-3.3-4-3.8-6.8H5.1V8h4.2l-.7-2.1H5.1V3Zm2.5 5c.4 1.9 1.2 3.4 2.4 4.6 1.2-1.2 2-2.7 2.4-4.6H7.6ZM14 21l3.5-9h2L23 21h-2.1l-.7-2h-3.4l-.7 2H14Zm3.2-3.8h2.6L18.5 14l-1.3 3.2Z"/></svg>;
}

export default function CrmMessageTranslation({ api, text, messageId, channel, caseId, className = '' }) {
  const [translation, setTranslation] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const offer = useMemo(() => shouldOfferTranslation(text), [text]);
  const shown = translation && !showOriginal ? translation : text;

  async function translate() {
    if (loading || !api?.translateMessage) return;
    setLoading(true); setError('');
    try {
      const result = await api.translateMessage({ text, messageId, channel, caseId });
      if (!result?.translation) throw Object.assign(Error('La traducción llegó vacía.'), { code: 'TRANSLATION_EMPTY_RESPONSE' });
      setTranslation(result.translation);
      setShowOriginal(false);
    } catch (failure) {
      setError(failure?.userMessage || failure?.message || 'No se pudo traducir. Intentá de nuevo.');
    } finally { setLoading(false); }
  }

  if (!offer && !translation) {
    return <p translate="no" className={`notranslate ${className}`}>{text}</p>;
  }

  return <div className={`crm-translation ${className}`}>
    <p translate={translation && !showOriginal ? 'yes' : 'no'} className={translation && !showOriginal ? 'crm-translation__text crm-translation__text--translated' : `notranslate crm-translation__text`} style={{ whiteSpace: 'pre-wrap' }}>{shown}</p>
    <div className="crm-translation__controls">
      {!translation ? <button type="button" className="crm-translation__action" onClick={translate} disabled={loading}>
        <TranslationIcon /><span>{loading ? 'Traduciendo…' : 'Traducir al español'}</span>
      </button> : <button type="button" className="crm-translation__action" onClick={() => setShowOriginal(value => !value)}>
        <TranslationIcon /><span>{showOriginal ? 'Ver traducción' : 'Ver original'}</span>
      </button>}
      {translation && <span className="crm-translation__hint">Traducción automática · el original no se modifica</span>}
    </div>
    {error && <p className="crm-translation__error" role="alert">{error}</p>}
  </div>;
}
