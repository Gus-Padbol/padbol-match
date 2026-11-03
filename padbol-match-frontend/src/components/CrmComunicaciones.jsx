import React, {useEffect, useState} from 'react';
import {crmAdminApi} from '../utils/crmAdminApi';

// Historial de correo del lead. Reutiliza /inbox/:id/email-history: no crea datos.
const ETIQUETA = {
  sent: 'Aceptado por el proveedor',
  delivered: 'Entregado',
  bounced: 'Rebotado',
  failed: 'Fallido',
  complained: 'Marcado como spam',
  pending: 'Pendiente',
  queued: 'En cola',
};
const FALLO = new Set(['bounced', 'failed', 'complained']);

export default function CrmComunicaciones({token, conversationId}) {
  const [estado, setEstado] = useState({cargando: false, error: '', mensajes: [], truncado: false});

  useEffect(() => {
    let activo = true;
    if (!token || !conversationId) return undefined;
    setEstado((s) => ({...s, cargando: true, error: ''}));
    crmAdminApi.emailHistory(token, conversationId)
      .then((data) => {
        if (!activo) return;
        setEstado({cargando: false, error: '', mensajes: Array.isArray(data?.messages) ? data.messages : [], truncado: Boolean(data?.truncated)});
      })
      .catch((e) => { if (activo) setEstado({cargando: false, error: e?.message || 'No se pudo cargar el historial de correo.', mensajes: [], truncado: false}); });
    return () => { activo = false; };
  }, [token, conversationId]);

  if (!conversationId) return null;
  return (
    <section className="crm-comunicaciones" style={{marginTop: 16}}>
      <h4 style={{margin: '0 0 8px'}}>Comunicaciones</h4>
      {estado.cargando && <p role="status">Cargando correos…</p>}
      {estado.error && <p role="alert" style={{color: '#dc2626'}}>{estado.error}</p>}
      {!estado.cargando && !estado.error && estado.mensajes.length === 0 && <p>Sin correos registrados para este lead.</p>}
      {estado.mensajes.map((m) => {
        const salida = m.direction === 'outbound';
        const estadoReal = m.deliveryStatus || m.status || '';
        const fallo = FALLO.has(String(estadoReal).toLowerCase());
        return (
          <article key={m.id} style={{borderLeft: `3px solid ${salida ? '#2563eb' : '#16a34a'}`, padding: '6px 8px', marginBottom: 8, background: fallo ? 'rgba(220,38,38,.08)' : 'transparent'}}>
            <header style={{display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, opacity: .8}}>
              <strong>{salida ? 'Enviado' : 'Recibido'}</strong>
              <time dateTime={m.at || undefined}>{(m.at || '').slice(0, 16).replace('T', ' ')}</time>
              {salida && <span>{ETIQUETA[String(estadoReal).toLowerCase()] || estadoReal || 'sin estado'}</span>}
            </header>
            {fallo && <p role="alert" style={{color: '#dc2626', margin: '4px 0', fontSize: 13}}>
              Este correo no se entregó{estadoReal ? ` (${ETIQUETA[String(estadoReal).toLowerCase()] || estadoReal})` : ''}. Revisá el contacto antes de reintentar.
            </p>}
            <p style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '4px 0'}}>{m.body}</p>
          </article>
        );
      })}
      {estado.truncado && <small>Se muestran los 200 mensajes más recientes.</small>}
    </section>
  );
}
