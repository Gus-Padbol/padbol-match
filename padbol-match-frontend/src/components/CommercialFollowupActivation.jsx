import React, {useEffect,useState} from 'react';

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
  useEffect(()=>{let current=true;setReadiness(null);if(channel==='whatsapp'&&api.getFollowupReadiness)api.getFollowupReadiness(caseId,channel,language).then(result=>{if(current)setReadiness(result);}).catch(()=>{if(current)setReadiness({ready:false,reason:'No se pudo comprobar la disponibilidad del seguimiento. Actualiza la ficha antes de activarlo.'});});else if(channel==='whatsapp')setReadiness({ready:false,reason:'La disponibilidad del seguimiento todavía no está confirmada.'});return()=>{current=false;};},[api,caseId,channel,language]);

  if (channel !== 'whatsapp') return null;

  async function start(event) {
    event.preventDefault();
    if (busy || readiness?.ready!==true || !consent || evidence.trim().length < 3) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.startFollowup(caseId, channel, {consent: true, evidence: evidence.trim(), language});
      setNotice('Seguimiento activado. Se detendrá si la persona responde.');
      onChanged?.();
    } catch (err) {
      setError(err.userMessage || 'No se pudo activar el seguimiento. Verifica el consentimiento y las plantillas antes de reintentar.');
    } finally { setBusy(false); }
  }

  async function cancel() {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.cancelFollowup(caseId, channel);
      setNotice('Seguimiento detenido.');
      onChanged?.();
    } catch {
      setError('No se pudo detener el seguimiento. Actualiza la consulta antes de reintentar.');
    } finally { setBusy(false); }
  }

  return <section aria-label="Seguimiento comercial">
    <h3>Seguimiento por WhatsApp</h3>
    <p>Hasta tres mensajes: a los 2, 5 y 8 días de activarlo. No son los avisos de tu agenda. Requiere plantillas aprobadas; si el cliente responde, la secuencia se detiene.</p>
    {!readiness?<p role="status">Comprobando plantillas y disponibilidad de envío…</p>:readiness.ready?<p>Plantillas y envío verificados para el idioma seleccionado.</p>:<p role="status">{readiness.reason||'El seguimiento aún no está disponible: faltan plantillas aprobadas o habilitar el envío.'}</p>}
    {active ? <><p>{readiness?.ready?'El seguimiento está activo. Si la persona responde, se detiene para evitar mensajes fuera de contexto.':'Hay un seguimiento registrado; no se enviarán mensajes mientras la disponibilidad no esté confirmada.'}</p><button type="button" disabled={busy} onClick={cancel}>Detener seguimiento</button></> : <form onSubmit={start}>
      <p>Actívalo sólo cuando ya terminaste la atención y la persona autorizó recibir mensajes de seguimiento.</p>
      <label><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> Confirmo que autorizó el seguimiento por WhatsApp.</label>
      <label>Cómo lo autorizó <textarea maxLength={1000} value={evidence} onChange={event => setEvidence(event.target.value)} placeholder="Ej.: confirmó por WhatsApp que desea recibir novedades" /></label>
      <label>Idioma <select value={language} onChange={event => {setReadiness(null);setLanguage(event.target.value);}}><option value="es">Español</option><option value="en">English</option></select></label>
      <button type="submit" disabled={busy || readiness?.ready!==true || !consent || evidence.trim().length < 3}>Activar seguimiento</button>
    </form>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
