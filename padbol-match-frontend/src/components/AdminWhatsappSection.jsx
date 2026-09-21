import React, { useCallback, useEffect, useState } from 'react';
import { whatsappAdminApi } from '../utils/whatsappAdminApi';

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

  const selected = items.find((item) => item.id === selectedId) || null;

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
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setSelectedId(item.id)}
              style={{ textAlign: 'left', width: '100%', marginBottom: 4 }}
            >
              <strong>{item.from_wa_id}</strong> · {String(item.text_body || '').slice(0, 80)}
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div style={{ marginTop: 12, borderTop: '1px solid #ccc', paddingTop: 12 }}>
          <p><strong>De:</strong> {selected.from_wa_id}</p>
          <p>{selected.text_body}</p>
          <textarea
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
        </div>
      )}
    </div>
  );
}

function AuditView({ accessToken }) {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await whatsappAdminApi.audit(accessToken);
        if (active) setAudit(data);
      } catch (e) {
        if (active) setError(e?.message || 'No se pudo cargar la auditoría');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [accessToken]);

  if (loading) return <p>{"Cargando auditoría…"}</p>;
  if (error) return <p style={{ color: '#e33030' }}>{error}</p>;

  const count = (arr) => (Array.isArray(arr) ? arr.length : 0);
  return (
    <div>
      <p><strong>Entrantes:</strong> {count(audit?.inbound)}</p>
      <p><strong>Salientes:</strong> {count(audit?.outbox)}</p>
      <p><strong>Clasificaciones:</strong> {count(audit?.classifications)}</p>
      <p><strong>Operadores:</strong> {count(audit?.operators)}</p>
      <p><strong>Configuración:</strong> {count(audit?.config)}</p>
      {audit?.outbox?.map((o) => (
        <p key={o.id} style={{ fontSize: 13 }}>
          {o.status}{o.last_error ? ` · ${o.last_error}` : ''} · {o.to_wa_id} · {String(o.text_body || '').slice(0, 60)}
        </p>
      ))}
    </div>
  );
}

export default function AdminWhatsappSection({ accessToken }) {
  const [perms, setPerms] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const p = await whatsappAdminApi.permissions(accessToken);
        if (active) setPerms(p);
      } catch (e) {
        if (active) setError(e?.status === 403 ? 'No tienes acceso a WhatsApp.' : (e?.message || 'Error de permisos'));
      }
    })();
    return () => { active = false; };
  }, [accessToken]);

  if (error) return <p style={{ color: '#e33030' }}>{error}</p>;
  if (!perms) return <p>{"Cargando…"}</p>;

  if (perms.canOperate) return <InboxView accessToken={accessToken} />;
  if (perms.canAudit) return <AuditView accessToken={accessToken} />;
  return <p>{"No tienes acceso a esta sección."}</p>;
}
