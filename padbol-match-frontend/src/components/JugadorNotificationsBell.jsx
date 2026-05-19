import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

function tipoEtiquetaNotif(t, tipo) {
  const map = {
    partido_solicitud: t('notificaciones.tipo.partido'),
    partido_solicitud_aceptada: t('notificaciones.tipo.partido'),
    partido_solicitud_rechazada: t('notificaciones.tipo.partido'),
    torneo_inscripcion_confirmada: t('notificaciones.tipo.torneo'),
    resultado_partido: t('notificaciones.tipo.torneo'),
    ranking_actualizado: t('ranking.titulo'),
    reserva_confirmada: t('notificaciones.tipo.reserva'),
    recordatorio_reserva: t('notificaciones.tipo.reserva'),
    invitacion_torneo_dupla: t('notificaciones.tipo.torneo'),
    general: t('notificaciones.tipo.aviso'),
  };
  return map[tipo] || t('notificaciones.tipo.aviso');
}

function fechaNotifLabel(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function JugadorNotificationsBell({ compact = false, headerLight = false }) {
  const { t } = useTranslation();
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

  /** Supabase Realtime: nuevo aviso o cambio de `leida` sin esperar al polling de 30s. */
  useEffect(() => {
    const uid = String(session?.user?.id || '').trim();
    if (!uid) return undefined;
    const channel = supabase
      .channel(`notificaciones-jugador:${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificaciones',
          filter: `user_id=eq.${uid}`,
        },
        () => {
          fetchItems({ silent: true });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.user?.id, fetchItems]);

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
      await fetchItems();
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
        title={t('nav.notificaciones')}
        style={{
          position: 'relative',
          width: compact ? 30 : 34,
          height: compact ? 30 : 34,
          borderRadius: '50%',
          border: headerLight ? '1px solid #E0E0E0' : 'none',
          background: headerLight ? '#F5F5F5' : 'rgba(255,255,255,0.1)',
          color: headerLight ? '#0F0F0F' : '#e2e8f0',
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
              border: headerLight ? '2px solid #fff' : '2px solid #0f172a',
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
          aria-label={t('nav.notificaciones')}
          style={{
            position: 'absolute',
            top: 'calc(100% + 9px)',
            right: 0,
            width: 'min(340px, calc(100vw - 24px))',
            maxHeight: '430px',
            overflowY: 'auto',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            borderRadius: 14,
            boxShadow: '0 20px 45px rgba(15,23,42,0.28)',
            border: '1px solid var(--border)',
            zIndex: 15000,
            textAlign: 'left',
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <strong style={{ fontSize: 14 }}>Notificaciones</strong>
            <button
              type="button"
              onClick={() => markRead(items.filter((n) => !n.leida).map((n) => n.id))}
              style={{ border: 'none', background: 'transparent', color: '#b91c1c', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
            >
              Marcar leídas
            </button>
          </div>
          {loading ? (
            <p style={{ margin: 0, padding: 14, color: 'var(--text-secondary)', fontSize: 13 }}>Cargando...</p>
          ) : msg ? (
            <p style={{ margin: 0, padding: 14, color: '#991b1b', fontSize: 13 }}>{msg}</p>
          ) : items.length === 0 ? (
            <p style={{ margin: 0, padding: 14, color: 'var(--text-secondary)', fontSize: 13 }}>Sin notificaciones por ahora.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8, padding: 10 }}>
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleItem(n)}
                  style={{
                    textAlign: 'left',
                    border: '1px solid var(--border)',
                    borderLeft: n.leida ? '4px solid var(--border)' : '4px solid var(--accent)',
                    borderRadius: 10,
                    padding: 10,
                    background: n.leida ? 'var(--pm-color-muted-bg)' : 'rgba(99, 102, 241, 0.12)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#b91c1c',
                      background: 'rgba(99, 102, 241, 0.2)',
                      padding: '2px 7px',
                      borderRadius: 6,
                      marginBottom: 6,
                    }}
                  >
                    {tipoEtiquetaNotif(t, n.tipo)}
                  </span>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: 13 }}>{n.titulo}</strong>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.4, marginTop: 4 }}>
                    {n.mensaje}
                  </span>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 11, marginTop: 6 }}>
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
