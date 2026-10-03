import React, { useCallback, useEffect, useState } from 'react';
import { whatsappAdminApi } from '../utils/whatsappAdminApi';
import './AdminWhatsappSection.css';

const SEND_DISABLED_NOTE = 'Respuesta registrada — envío desactivado';

function InboxView({ accessToken }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await whatsappAdminApi.inbox(accessToken);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la bandeja');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const itemId = (item) => item.id || item.event_id;
  const itemTitle = (item) => item.from_wa_id || item.contact_ref || 'Contacto protegido';
  const itemBody = (item) => item.text_body || item.event_type || 'Evento CRM';
  const selected = items.find((item) => itemId(item) === selectedId) || null;

  async function submitReply() {
    if (!selected || busy || !replyText.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      await whatsappAdminApi.reply(accessToken, selected.id, replyText.trim());
      setNotice(SEND_DISABLED_NOTE);
      setReplyText('');
      await load();
    } catch (e) {
      setNotice(e?.message || 'No se pudo registrar la respuesta');
    } finally {
      setBusy(false);
    }
  }

  async function submitHandoff() {
    if (!selected || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await whatsappAdminApi.handoff(accessToken, selected.id);
      setNotice('Consulta derivada a una persona.');
      await load();
    } catch (e) {
      setNotice(e?.message || 'No se pudo derivar');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>{"Cargando bandeja…"}</p>;
  if (error) return <p style={{ color: '#e33030' }}>{error}</p>;
  if (items.length === 0) return <p>{"No hay consultas."}</p>;

  return (
    <div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map((item) => (
          <li key={itemId(item)}>
            <button
              type="button"
              onClick={() => setSelectedId(itemId(item))}
              style={{ textAlign: 'left', width: '100%', marginBottom: 4 }}
            >
              <strong>{itemTitle(item)}</strong> · {String(itemBody(item)).slice(0, 80)}
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div style={{ marginTop: 12, borderTop: '1px solid #ccc', paddingTop: 12 }}>
          <p><strong>Contacto:</strong> {itemTitle(selected)}</p>
          <p>{itemBody(selected)}</p>
          {selected.registration_id ? <p><strong>Inscripción:</strong> {selected.registration_id}</p> : null}
          {selected.session_id ? <p><strong>Jornada:</strong> {selected.session_id}</p> : null}
          {selected.from_wa_id ? <><textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Escribe la respuesta…"
            rows={3}
            style={{ width: '100%' }}
          />
          <div style={{ marginTop: 8 }}>
            <button type="button" disabled={busy || !replyText.trim()} onClick={submitReply}>
              {busy ? 'Enviando…' : 'Registrar respuesta'}
            </button>
            <button type="button" disabled={busy} onClick={submitHandoff} style={{ marginLeft: 8 }}>
              Derivar a una persona
            </button>
          </div>
          {notice ? <p>{notice}</p> : null}
          </> : null}
        </div>
      )}
    </div>
  );
}

export default function AdminWhatsappSection({ accessToken, onBack }) {
  const [perms, setPerms] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const p = await whatsappAdminApi.permissions(accessToken);
        if (active) setPerms(p);
      } catch (e) {
        if (!active) return;
        if (e?.status === 403) setError({ kind: 'forbidden', message: 'No tienes acceso a Atención / CRM.' });
        else if (e?.status === 404) setError({ kind: 'backend-route', message: 'La bandeja todavía no está conectada en esta preview.' });
        else setError({ kind: 'network', message: e?.message || 'No se pudo conectar con Atención / CRM.' });
      }
    })();
    return () => { active = false; };
  }, [accessToken]);

  const workspaceBody = (() => {
    if (error) {
      return (
        <section className="admin-crm-state" role="status">
          <span className="admin-crm-state__icon" aria-hidden>!</span>
          <div>
            <h2>{error.kind === 'backend-route' ? 'Bandeja no conectada' : 'No pudimos abrir la bandeja'}</h2>
            <p>{error.message}</p>
            {error.kind === 'backend-route' ? (
              <p className="admin-crm-state__detail">
                El panel está listo, pero el backend de esta preview aún no publica las rutas de CRM.
              </p>
            ) : null}
          </div>
        </section>
      );
    }
    if (!perms) return <section className="admin-crm-state"><p>{"Cargando bandeja…"}</p></section>;
    if (perms.canOperate || perms.canAudit) return <InboxView accessToken={accessToken} />;
    return <section className="admin-crm-state"><p>No tienes acceso a esta sección.</p></section>;
  })();

  return (
    <section className="admin-crm-workspace" aria-label="Atención y CRM">
      <header className="admin-crm-header">
        <div>
          <button type="button" className="admin-crm-back" onClick={onBack}>← Volver al panel</button>
          <p className="admin-crm-eyebrow">SUPER ADMIN · OPERACIONES</p>
          <h1>Atención / CRM</h1>
          <p>Consultas, contactos, historial y seguimiento en un único espacio de trabajo.</p>
        </div>
        <span className={`admin-crm-connection${error ? ' admin-crm-connection--offline' : ''}`}>
          {error ? 'Conexión pendiente' : 'Conectado'}
        </span>
      </header>

      <div className="admin-crm-summary" aria-label="Resumen de atención">
        <article><span>Pendientes</span><strong>—</strong><small>Consultas por revisar</small></article>
        <article><span>En seguimiento</span><strong>—</strong><small>Contactos activos</small></article>
        <article><span>Resueltas</span><strong>—</strong><small>Últimos 30 días</small></article>
        <article><span>Notificaciones</span><strong>—</strong><small>Programadas y enviadas</small></article>
      </div>

      <div className="admin-crm-layout">
        <nav className="admin-crm-sections" aria-label="Secciones de Atención y CRM">
          <button type="button" className="is-active">Bandeja</button>
          <button type="button" disabled>Ficha del contacto</button>
          <button type="button" disabled>Historial y reportes</button>
          <button type="button" disabled>Notificaciones</button>
        </nav>
        <main className="admin-crm-main">{workspaceBody}</main>
      </div>
    </section>
  );
}
