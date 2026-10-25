import React, {useEffect, useRef, useState} from 'react';

// Only the advisor's own note is dictated, never the client's call.
export default function CommercialDictation({onText, onListeningChange}) {
  const recognition = useRef(null), wanted = useRef(false), restart = useRef(null);
  const callbacks = useRef({onText, onListeningChange});
  callbacks.current = {onText, onListeningChange};
  const [listening, setListening] = useState(false), [interim, setInterim] = useState(''), [error, setError] = useState('');
  const pending = useRef('');
  const available = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  useEffect(() => () => {
    wanted.current = false; clearTimeout(restart.current);
    if (recognition.current) {
      recognition.current.onresult = null; recognition.current.onend = null; recognition.current.onerror = null;
      recognition.current.abort();
    }
  }, []);
  function finish(message = '') {
    wanted.current = false; clearTimeout(restart.current);
    setListening(false); callbacks.current.onListeningChange?.(false);
    if (message) {
      if (pending.current) { callbacks.current.onText(pending.current); pending.current = ''; setInterim(''); }
      setError(message);
    }
  }
  function begin() {
    if (!wanted.current) return;
    const Engine = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      const session = new Engine(); recognition.current = session;
      const completed = new Set();
      session.lang = 'es'; session.continuous = true; session.interimResults = true;
      session.onresult = event => {
        if (recognition.current !== session) return;
        const finals = [], draft = [];
        Array.from(event.results || []).forEach((result, index) => {
          const text = String(result[0]?.transcript || '').trim();
          if (result.isFinal && !completed.has(index)) { completed.add(index); if (text) finals.push(text); }
          else if (!result.isFinal && text) draft.push(text);
        });
        pending.current = draft.join(' '); setInterim(pending.current);
        if (finals.length) callbacks.current.onText(finals.join(' '));
      };
      session.onerror = event => {
        if (recognition.current !== session || event.error === 'no-speech') return;
        finish(['not-allowed','service-not-allowed','audio-capture'].includes(event.error)
          ? 'No se pudo acceder al micrófono. Revisa el permiso del navegador o escribe el resumen.'
          : 'Se interrumpió el dictado. El texto recibido se conserva; puedes continuar dictando o escribir.');
      };
      session.onend = () => {
        if (recognition.current !== session) return;
        recognition.current = null;
        // Preserve the last visible draft if the browser ends before finalizing it.
        if (pending.current) { callbacks.current.onText(pending.current); pending.current = ''; setInterim(''); }
        if (wanted.current) restart.current = setTimeout(begin, 300);
        else finish();
      };
      session.start();
    } catch { finish('No se pudo iniciar el dictado. Puedes intentarlo otra vez o escribir el resumen.'); }
  }
  function toggle() {
    if (wanted.current) {
      wanted.current = false; clearTimeout(restart.current);
      if (recognition.current) { try { recognition.current.stop(); } catch { finish('El dictado terminó. Revisa el resumen antes de guardar.'); } }
      else finish();
      return;
    }
    setError(''); wanted.current = true; setListening(true); callbacks.current.onListeningChange?.(true); begin();
  }
  if (!available) return <p>Puedes escribir o usar el dictado de tu dispositivo.</p>;
  return <div className="commercial-dictation-control">
    <button type="button" aria-pressed={listening} onClick={toggle}>{listening ? 'Terminar dictado' : 'Dictar resumen'}</button>
    {listening && <p role="status">Escuchando… Puedes hacer pausas. Pulsa «Terminar dictado» cuando acabes.</p>}
    {interim && <p className="commercial-dictation-draft" aria-live="polite">{interim}</p>}
    {error && <p role="alert">{error}</p>}
    <details><summary>Sobre el dictado</summary><p>Solo dicta tu resumen después de la llamada. El navegador puede enviar el audio a su proveedor para transcribirlo. Revisa el texto antes de guardar.</p></details>
  </div>;
}
