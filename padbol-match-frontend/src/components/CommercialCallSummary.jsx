import React, { useState } from 'react';
import CommercialDictation from './CommercialDictation';

// El servidor debe verificar el requisito también para cambios por otras vías.
export default function CommercialCallSummary({caseId, channel, callId: existingCallId, api, onSaved}) {
  const [callId, setCallId] = useState(existingCallId || null);
  const [situation, setSituation] = useState('');
  const [discussion, setDiscussion] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [startUncertain, setStartUncertain] = useState(false);
  const valid = [situation, discussion, details].every(value => value.trim().length >= 3);
  async function startCall() {
    if (busy || callId || startUncertain || !['form','whatsapp'].includes(channel)) return;
    setBusy(true); setError('');
    try { const result = await api.startCall(caseId, channel); if (!result?.id) throw new Error('CALL_ID_MISSING'); setCallId(result.id); }
    catch { setStartUncertain(true); setError('No se pudo registrar la videollamada. Actualiza la consulta antes de volver a intentar.'); }
    finally { setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (!valid || busy || dictating || !callId || !['form', 'whatsapp'].includes(channel)) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      const result = await api.completeCall(caseId, callId, {channel, situation:situation.trim(), discussed:discussion.trim(), distinguishing:details.trim()});
      setSaved(true); onSaved?.(result);
    } catch { setError('No se pudo confirmar que se guardó el resumen. Actualiza la consulta antes de continuar.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Resumen de videollamada">
    <h3>Resumen de videollamada</h3>
    <p>Antes de llamar desde tu dispositivo, registra la videollamada aquí. Al terminar, completa el resumen para poder avanzar o cerrar la consulta.</p>
    {!callId && <button type="button" disabled={busy || startUncertain} onClick={startCall}>Registrar videollamada</button>}
    {callId && !saved && <p role="status">Resumen pendiente</p>}
    {callId && !saved && <form onSubmit={submit}>
      <label>Situación del cliente <textarea required maxLength={2000} value={situation} onChange={e=>{setSituation(e.target.value);setSaved(false);}} /></label>
      <CommercialDictation onListeningChange={setDictating} onText={text => { setDiscussion(current => [current.trim(), text].filter(Boolean).join(' ').slice(0,2000)); setSaved(false); }} />
      <label>Qué se habló <textarea required maxLength={2000} value={discussion} onChange={e=>{setDiscussion(e.target.value);setSaved(false);}} /></label>
      <label>Detalles importantes <textarea required maxLength={2000} value={details} onChange={e=>{setDetails(e.target.value);setSaved(false);}} /></label>
      <button type="submit" disabled={!valid || busy || dictating || !callId || !['form','whatsapp'].includes(channel)}>Guardar resumen</button>
    </form>}
    {saved && <p role="status">Resumen guardado. Ya puedes continuar con el próximo paso.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
