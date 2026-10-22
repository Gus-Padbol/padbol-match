import React, {useEffect, useRef, useState} from 'react';

// Dictation captures only the advisor's later note, never the call.
export default function CommercialDictation({onText, onListeningChange}) {
  const recognition = useRef(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const available = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  useEffect(() => () => { if (recognition.current) { recognition.current.onresult = null; recognition.current.onend = null; recognition.current.onerror = null; recognition.current.abort(); } }, []);
  function toggle() {
    if (listening) { recognition.current?.stop(); return; }
    const Engine = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Engine) return;
    setError('');
    try {
      const session = new Engine(); recognition.current = session;
      session.lang = 'es'; session.continuous = false; session.interimResults = false;
      session.onresult = event => {
        const text = Array.from(event.results || []).filter(result => result.isFinal).map(result => result[0]?.transcript || '').join(' ').trim();
        if (text) onText(text);
      };
      session.onerror = () => { setError('No se pudo dictar. Puedes escribir el resumen.'); setListening(false); onListeningChange?.(false); };
      session.onend = () => { setListening(false); onListeningChange?.(false); recognition.current = null; };
      session.start(); setListening(true); onListeningChange?.(true);
    } catch { setError('No se pudo iniciar el dictado. Puedes escribir el resumen.'); setListening(false); onListeningChange?.(false); }
  }
  if (!available) return <p>Puedes escribir o usar el dictado de tu dispositivo.</p>;
  return <div><p>Dicta tu nota después de la llamada. El navegador puede enviar el audio a su proveedor para transcribirlo. Revisa el texto antes de guardarlo.</p>
    <button type="button" onClick={toggle}>{listening ? 'Detener dictado' : 'Dictar nota'}</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
