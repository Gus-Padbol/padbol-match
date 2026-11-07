import React, {useEffect, useRef, useState} from 'react';

// Only the advisor's own note is dictated, never the client's call.
export default function CommercialDictation({onText, onListeningChange}) {
  const recognition = useRef(null), wanted = useRef(false), restart = useRef(null);
  const callbacks = useRef({onText, onListeningChange});
  callbacks.current = {onText, onListeningChange};
  const [listening, setListening] = useState(false), [interim, setInterim] = useState(''), [error, setError] = useState('');
  const pending = useRef(''), transientFailures = useRef(0);
  const [reconnecting, setReconnecting] = useState(false);
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
    setListening(false); setReconnecting(false); callbacks.current.onListeningChange?.(false);
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
        transientFailures.current = 0; setReconnecting(false);
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
        if (recognition.current !== session || event.error === 'no-speech' || (event.error === 'aborted' && !wanted.current)) return;
        if (wanted.current && ['network','aborted'].includes(event.error) && transientFailures.current < 3) {
          transientFailures.current += 1;
          setReconnecting(true);
          return;
        }
        // Diagnostico: mostramos el codigo real del navegador en lugar de suponer permisos.
        try { console.warn('[dictado] error de reconocimiento:', event.error, event.message || ''); } catch { /* noop */ }
        const code = String(event.error || 'desconocido');
        if (code === 'network') {
          finish('El servicio de dictado del navegador no responde (network). Chrome usa el servicio de Google y puede estar bloqueado por la red. Prueba con Safari o usa el dictado del teclado (Fn dos veces). Tu texto se conserva.');
        } else if (code === 'audio-capture') {
          finish('El navegador no encuentra el micrófono (audio-capture). Verifica que ninguna otra aplicación lo esté usando. Tu texto se conserva.');
        } else if (code === 'not-allowed' || code === 'service-not-allowed') {
          finish('El navegador bloqueó el reconocimiento de voz (' + code + '). No es solo el permiso del micrófono: Chrome además necesita permiso para el servicio de voz. Tu texto se conserva.');
        } else {
          finish('Se interrumpió el dictado (' + code + '). El texto recibido se conserva; puedes seguir dictando o escribir.');
        }
      };
      session.onend = () => {
        if (recognition.current !== session) return;
        recognition.current = null;
        // Preserve the last visible draft if the browser ends before finalizing it.
        if (pending.current) { callbacks.current.onText(pending.current); pending.current = ''; setInterim(''); }
        if (wanted.current) restart.current = setTimeout(begin, Math.max(300, transientFailures.current * 500));
        else finish();
      };
      session.start();
    } catch { finish('No se pudo iniciar el dictado. Puedes intentarlo otra vez o escribir el resumen.'); }
  }
  // Safari (iPhone incluido) exige que el permiso de micrófono se conceda antes
  // de iniciar el reconocimiento; sin esto el motor falla con "not-allowed".
  async function ensureMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (e) {
      const name = e?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        finish('El navegador bloqueó el micrófono. En iPhone: Ajustes → Safari → Micrófono → Permitir, y recarga el CRM. En Chrome: toca el candado de la barra y habilita Micrófono.');
      } else if (name === 'NotFoundError') {
        finish('No se encontró un micrófono en este dispositivo. Puedes escribir el resumen o usar el dictado del teclado.');
      } else {
        finish('No se pudo acceder al micrófono. Puedes escribir el resumen o usar el dictado del teclado.');
      }
      return false;
    }
  }
  function toggle() {
    if (wanted.current) {
      wanted.current = false; clearTimeout(restart.current);
      if (recognition.current) { try { recognition.current.stop(); } catch { finish('El dictado terminó. Revisa el resumen antes de guardar.'); } }
      else finish();
      return;
    }
    setError(''); transientFailures.current = 0; setReconnecting(false);
    ensureMicrophone().then(ok => {
      if (!ok) { wanted.current = false; setListening(false); callbacks.current.onListeningChange?.(false); return; }
      wanted.current = true; setListening(true); callbacks.current.onListeningChange?.(true); begin();
    });
  }
  if (!available) return <p>Puedes escribir o usar el dictado de tu dispositivo.</p>;
  return <div className="commercial-dictation-control">
    <button type="button" aria-pressed={listening} onClick={toggle}>{listening ? 'Terminar dictado' : 'Dictar resumen'}</button>
    {listening && <p role="status">{reconnecting ? 'Reconectando el micrófono… El texto se conserva.' : 'Escuchando… Puedes hacer pausas. Pulsa «Terminar dictado» cuando acabes.'}</p>}
    {interim && <p className="commercial-dictation-draft" aria-live="polite">{interim}</p>}
    {error && <p role="alert">{error}</p>}
    <details><summary>Sobre el dictado</summary><p>Solo dicta tu resumen después de la llamada. El navegador puede enviar el audio a su proveedor para transcribirlo. Revisa el texto antes de guardar.</p></details>
  </div>;
}
