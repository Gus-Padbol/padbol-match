import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

function fechaNotifLabel(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function JugadorNotificationsBell({ compact = false }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const wrapRef = useRef(null);

  const unreadCount = useMemo(() => items.filter((n) => !n.leida).length, [items]);

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || session?.access_token || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [session?.access_token]);

  const fetchItems = useCallback(async ({ silent = false } = {}) => {
    if (!session?.user) {
      setItems([]);
      return;
    }
    if (!silent) setLoading(true);
    setMsg('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/api/notificaciones`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar notificaciones');
      const rows = Array.isArray(data) ? data : [];
      setItems(rows);
      return rows;
    } catch (err) {
      if (!silent) setMsg(err.message || 'Error de red');
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  }, [authHeaders, session?.user]);

  const markRead = useCallback(async (ids = []) => {
    if (!session?.user) return;
    const normalized = ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    if (!normalized.length) return;
    setItems((prev) => prev.map((n) => (normalized.includes(Number(n.id)) ? { ...n, leida: true } : n)));
    try {
      const headers = await authHeaders();
      await fetch(`${API_BASE}/api/notificaciones/leer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ ids: normalized }),
      });
    } catch {
      /* el polling corrige estado si falla */
    }
  }, [authHeaders, session?.user]);

  useEffect(() => {
    fetchItems({ silent: true });
    const id = setInterval(() => fetchItems({ silent: true }), 30000);
    return () => clearInterval(id);
  }, [fetchItems]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (ev) => {
      if (!wrapRef.current?.contains(ev.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const handleToggle = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      const freshItems = await fetchItems();
      const unreadIds = (freshItems || items).filter((n) => !n.leida).map((n) => n.id);
      if (unreadIds.length) void markRead(unreadIds);
    }
  };

  const handleItem = async (n) => {
    if (!n.leida) await markRead([n.id]);
    setOpen(false);
    const link = String(n.link || '').trim();
    if (link) navigate(link);
  };

  if (!session?.user) return null;

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Notificaciones: ${unreadCount} no leídas`}
        title="Notificaciones"
        style={{
          position: 'relative',
          width: compact ? 30 : 34,
          height: compact ? 30 : 34,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.1)',
          color: '#e2e8f0',
          fontSize: compact ? 15 : 16,
          lineHeight: 1,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        🔔
        {unreadCount > 0 ? (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: '#ef4444',
              color: '#fff',
              border: '2px solid #0f172a',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 900,
              boxSizing: 'border-box',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notificaciones"
          style={{
            position: 'absolute',
            top: 'calc(100% + 9px)',
            right: 0,
            width: 'min(340px, calc(100vw - 24px))',
            maxHeight: '430px',
            overflowY: 'auto',
            background: '#fff',
            color: '#0f172a',
            borderRadius: 14,
            boxShadow: '0 20px 45px rgba(15,23,42,0.28)',
            border: '1px solid #e2e8f0',
            zIndex: 15000,
            textAlign: 'left',
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <strong style={{ fontSize: 14 }}>Notificaciones</strong>
            <button
              type="button"
              onClick={() => markRead(items.filter((n) => !n.leida).map((n) => n.id))}
              style={{ border: 'none', background: 'transparent', color: '#4f46e5', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
            >
              Marcar leídas
            </button>
          </div>
          {loading ? (
            <p style={{ margin: 0, padding: 14, color: '#64748b', fontSize: 13 }}>Cargando...</p>
          ) : msg ? (
            <p style={{ margin: 0, padding: 14, color: '#991b1b', fontSize: 13 }}>{msg}</p>
          ) : items.length === 0 ? (
            <p style={{ margin: 0, padding: 14, color: '#64748b', fontSize: 13 }}>Sin notificaciones por ahora.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8, padding: 10 }}>
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleItem(n)}
                  style={{
                    textAlign: 'left',
                    border: '1px solid #e2e8f0',
                    borderLeft: n.leida ? '4px solid #cbd5e1' : '4px solid #667eea',
                    borderRadius: 10,
                    padding: 10,
                    background: n.leida ? '#f8fafc' : '#eef2ff',
                    cursor: 'pointer',
                  }}
                >
                  <strong style={{ display: 'block', color: '#0f172a', fontSize: 13 }}>{n.titulo}</strong>
                  <span style={{ display: 'block', color: '#475569', fontSize: 12, lineHeight: 1.4, marginTop: 4 }}>
                    {n.mensaje}
                  </span>
                  <span style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginTop: 6 }}>
                    {fechaNotifLabel(n.created_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
