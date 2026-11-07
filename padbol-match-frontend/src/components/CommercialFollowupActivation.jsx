import React, {useEffect,useRef,useState} from 'react';

// Seguimiento comercial: sólo se solicita cuando el asesor cerró su parte del
// proceso. La autorización real y las plantillas se comprueban en el servidor.
export default function CommercialFollowupActivation({caseId, channel, api, active = false, onChanged}) {
  const [consent, setConsent] = useState(false);
  const [evidence, setEvidence] = useState('');
  const [language, setLanguage] = useState('es');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [readiness,setReadiness]=useState(null);
  const generation=useRef(0);
  useEffect(()=>{generation.current+=1;setBusy(false);setNotice('');setError('');return()=>{generation.current+=1;};},[caseId,channel,language]);
  useEffect(()=>{let current=true;setReadiness(null);if(channel==='whatsapp'&&api.getFollowupReadiness)api.getFollowupReadiness(caseId,channel,language).then(result=>{if(current)setReadiness({...result,caseId,channel,requestedLanguage:language});}).catch(()=>{if(current)setReadiness({ready:false,reason:'No se pudo comprobar la disponibilidad del seguimiento. Actualiza la ficha antes de activarlo.'});});else if(channel==='whatsapp')setReadiness({ready:false,reason:'La disponibilidad del seguimiento todavía no está confirmada.'});return()=>{current=false;};},[api,caseId,channel,language]);

  // Bind readiness to the exact case/channel/language that was checked.
  const readyForActivation = readiness?.ready === true
    && readiness?.caseId === caseId && readiness?.channel === channel
    && readiness?.requestedLanguage === language && readiness?.language === language
    && typeof readiness?.templateKey === 'string' && readiness.templateKey.trim().length >= 3;
  useEffect(()=>{setConsent(false);setEvidence('');setNotice('');setError('');},[caseId,channel]);

  if (channel !== 'whatsapp') return null;

  async function start(event) {
    event.preventDefault();
    if (busy || !readyForActivation || !consent || evidence.trim().length < 3) return;
    const gen = ++generation.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.startFollowup(caseId, channel, {consent, consentEvidence: evidence.trim(), language, templateKey: readiness.templateKey});
      if (gen !== generation.current) return;
      // Contrato real: el adaptador devuelve el objeto directo (sin wrapper).
      // Un 2xx incompleto NO se declara activo.
      if (!result || result.status !== 'active' || !result.id || !result.conversationId
        || result.language !== language || result.templateKey !== readiness.templateKey) {
        setError('El servidor no confirmó el seguimiento (respuesta incompleta). Actualiza la consulta antes de reintentar.');
        return;
      }
      setNotice('Seguimiento activado. Se detendrá si la persona responde.');
      onChanged?.();
    } catch (err) {
      if (gen !== generation.current) return;
      setError(err.userMessage || 'No se pudo activar el seguimiento. Verifica el consentimiento y las plantillas antes de reintentar.');
    } finally { if (gen === generation.current) setBusy(false); }
  }

  async function cancel() {
    if (busy) return;
    const gen = ++generation.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.cancelFollowup(caseId, channel);
      if (gen !== generation.current) return;
      // cancel exige id; sin id el SQL lanza y NO se inventa idempotencia.
      if (!result || result.status !== 'cancelled' || !result.id) {
        setError('El servidor no confirmó la detención. Actualiza la consulta antes de reintentar.');
        return;
      }
      setNotice('Seguimiento detenido.');
      onChanged?.();
    } catch {
      if (gen !== generation.current) return;
      setError('No se pudo detener el seguimiento. Actualiza la consulta antes de reintentar.');
    } finally { if (gen === generation.current) setBusy(false); }
  }

  return <section aria-label="Seguimiento comercial">
    <h3>Seguimiento por WhatsApp</h3>
    <p>Hasta tres mensajes: a los 2, 5 y 8 días de activarlo. No son los avisos de tu agenda. Requiere plantillas aprobadas; si el cliente responde, la secuencia se detiene.</p>
    {!readiness?<p role="status">Comprobando plantillas y disponibilidad de envío…</p>:readyForActivation?<p>Plantillas y envío verificados para el idioma seleccionado.</p>:<p role="status">{(readiness.ready!==true && readiness.reason)||'El seguimiento aún no está disponible: faltan plantillas aprobadas o un plan verificado para este idioma.'}</p>}
    {active ? <><p>{readyForActivation?'El seguimiento está activo. Si la persona responde, se detiene para evitar mensajes fuera de contexto.':'Hay un seguimiento registrado; no se enviarán mensajes mientras la disponibilidad no esté confirmada.'}</p><button type="button" disabled={busy} onClick={cancel}>Detener seguimiento</button></> : <form onSubmit={start}>
      <p>Actívalo sólo cuando ya terminaste la atención y la persona autorizó recibir mensajes de seguimiento.</p>
      <label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> Confirmo que autorizó el seguimiento por WhatsApp.</label>
      <label>Cómo lo autorizó <textarea maxLength={1000} value={evidence} onChange={event => setEvidence(event.target.value)} placeholder="Ej.: confirmó por WhatsApp que desea recibir novedades" /></label>
      <label>Idioma <select value={language} onChange={event => {setReadiness(null);setLanguage(event.target.value);}}><option value="es">Español</option><option value="en">English</option></select></label>
      <button type="submit" disabled={busy || !readyForActivation || !consent || evidence.trim().length < 3}>Activar seguimiento</button>
    </form>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
