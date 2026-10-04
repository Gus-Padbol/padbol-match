import React, { useCallback, useEffect, useState } from 'react';
import { whatsappAdminApi } from '../utils/whatsappAdminApi';
import './AdminWhatsappSection.css';

const SEND_DISABLED_NOTE = 'Respuesta registrada — envío desactivado';

function InboxView({ accessToken, permissions }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [sedes, setSedes] = useState([]);
  const [manual, setManual] = useState({ name: '', email: '', phone: '', origin: 'in_person', subject: '', body: '', sede_id: '' });

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

  useEffect(() => {
    if (!permissions?.canAudit || typeof whatsappAdminApi.sedes !== 'function') return;
    whatsappAdminApi.sedes(accessToken).then((data) => setSedes(Array.isArray(data) ? data : (data?.sedes || []))).catch(() => setSedes([]));
  }, [accessToken, permissions?.canAudit]);

  const itemId = (item) => item.id || item.event_id;
  const itemTitle = (item) => item.contact?.nombre || item.contact?.email_normalized || item.contact?.phone_normalized || item.from_wa_id || item.contact_ref || 'Contacto protegido';
  const itemBody = (item) => item.inbound_body || item.text_body || item.subject || item.event_type || 'Evento CRM';
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

  async function submitManual(event) {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      await whatsappAdminApi.createManual(accessToken, { ...manual, sede_id: permissions?.canAudit ? manual.sede_id : undefined });
      setManual({ name: '', email: '', phone: '', origin: 'in_person', subject: '', body: '', sede_id: '' });
      setNotice('Contacto registrado en la sede, sin enviar comunicaciones.'); await load();
    } catch (e) { setNotice(e?.message || 'No se pudo registrar el contacto'); }
    finally { setBusy(false); }
  }

  async function assignSelectedSede(sedeId) {
    if (!selected || !sedeId) return;
    setBusy(true); setNotice(null);
    try { await whatsappAdminApi.assignSede(accessToken, selected.id, sedeId); setNotice('Sede asignada.'); await load(); }
    catch (e) { setNotice(e?.message || 'No se pudo asignar la sede'); }
    finally { setBusy(false); }
  }

  if (loading) return <p>{"Cargando bandeja…"}</p>;
  if (error) return <p style={{ color: '#e33030' }}>{error}</p>;
  return (
    <div>
      <form onSubmit={submitManual} style={{ display: 'grid', gap: 8, marginBottom: 18, padding: 12, border: '1px solid #ddd', borderRadius: 10 }}>
        <strong>Agregar contacto recibido por la sede</strong>
        <input aria-label="Nombre del contacto" placeholder="Nombre" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input aria-label="Correo del contacto" placeholder="Correo" type="email" value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} /><input aria-label="Teléfono del contacto" placeholder="Teléfono" value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} /></div>
        <select aria-label="Origen del contacto" value={manual.origin} onChange={(e) => setManual({ ...manual, origin: e.target.value })}><option value="in_person">Presencial</option><option value="phone">Teléfono</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="other">Otro</option></select>
        {permissions?.canAudit ? <select aria-label="Sede canónica" required value={manual.sede_id} onChange={(e) => setManual({ ...manual, sede_id: e.target.value })}><option value="">Elegir sede</option>{sedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre || sede.nombre_club || `Sede ${sede.id}`}</option>)}</select> : null}
        <input aria-label="Asunto" placeholder="Asunto" value={manual.subject} onChange={(e) => setManual({ ...manual, subject: e.target.value })} />
        <textarea aria-label="Detalle" placeholder="Detalle" rows={2} value={manual.body} onChange={(e) => setManual({ ...manual, body: e.target.value })} />
        <button type="submit" disabled={busy || (!manual.email && !manual.phone)}>Guardar contacto</button>
      </form>
      {items.length === 0 ? <p>{"No hay consultas."}</p> : <ul style={{ listStyle: 'none', padding: 0 }}>
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
      </ul>}

      {selected && (
        <div style={{ marginTop: 12, borderTop: '1px solid #ccc', paddingTop: 12 }}>
          <p><strong>Contacto:</strong> {itemTitle(selected)}</p>
          <p>{itemBody(selected)}</p>
          <p><strong>Origen:</strong> {selected.origin || 'No informado'} · <strong>Sede:</strong> {selected.sede_id || 'Sin asignar'}</p>
          {permissions?.canAudit ? <select aria-label="Asignar conversación a sede" value={selected.sede_id || ''} onChange={(e) => void assignSelectedSede(e.target.value)}><option value="">Sin asignar</option>{sedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre || sede.nombre_club || `Sede ${sede.id}`}</option>)}</select> : null}
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
    if (perms.canOperate || perms.canAudit) return <InboxView accessToken={accessToken} permissions={perms} />;
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
