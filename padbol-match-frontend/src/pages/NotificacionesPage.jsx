import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import { hubContentPaddingTopCss, hubMainPaddingBottomCss } from '../constants/hubLayout';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

function tipoEtiqueta(t, tipo) {
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

export default function NotificacionesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || session?.access_token || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [session?.access_token]);

  const fetchItems = useCallback(async () => {
    if (!session?.user) {
      setItems([]);
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/api/notificaciones`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudieron cargar notificaciones');
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setMsg(err.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, session?.user]);

  const markRead = useCallback(
    async (ids = []) => {
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
        /* ignore */
      }
    },
    [authHeaders, session?.user],
  );

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const uid = String(session?.user?.id || '').trim();
    if (!uid) return undefined;
    const channel = supabase
      .channel(`notificaciones-page:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notificaciones', filter: `user_id=eq.${uid}` },
        () => {
          void fetchItems();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.user?.id, fetchItems]);

  const unreadIds = useMemo(() => items.filter((n) => !n.leida).map((n) => n.id), [items]);

  const onItem = async (n) => {
    if (!n.leida) await markRead([n.id]);
    const link = String(n.link || '').trim();
    if (link) navigate(link);
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg-page)',
        paddingTop: hubContentPaddingTopCss(location.pathname, navDock),
        paddingBottom: hubMainPaddingBottomCss(location.pathname, navDock),
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title={t('nav.notificaciones')} />
      <main style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '16px 16px 24px', boxSizing: 'border-box' }}>
        {!session?.user ? (
          <section
            style={{
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 20,
              background: 'var(--bg-card)',
              boxShadow: 'var(--pm-shadow-card, 0 2px 8px rgba(0,0,0,0.08))',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 15, fontWeight: 400 }}>
              Iniciá sesión para ver tus avisos.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login?redirect=/notificaciones')}
              style={{
                padding: '14px 24px',
                borderRadius: 8,
                border: 'none',
                background: '#E11B22',
                color: '#fff',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              Ingresar
            </button>
          </section>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{t('notificaciones.titulo')}</h1>
              {unreadIds.length ? (
                <button
                  type="button"
                  onClick={() => markRead(unreadIds)}
                  style={{
                    border: '2px solid #E11B22',
                    background: 'transparent',
                    color: '#E11B22',
                    fontWeight: 600,
                    fontSize: 13,
                    padding: '8px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  Marcar leídas
                </button>
              ) : null}
            </div>
            {loading ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 24 }}>Cargando…</p>
            ) : msg ? (
              <p style={{ color: 'var(--accent)', fontWeight: 600 }}>{msg}</p>
            ) : items.length === 0 ? (
              <section
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 24,
                  background: 'var(--bg-card)',
                  boxShadow: 'var(--pm-shadow-card, 0 2px 8px rgba(0,0,0,0.08))',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                }}
              >
                {t('notificaciones.vacio')}
              </section>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void onItem(n)}
                    style={{
                      textAlign: 'left',
                      border: '1px solid var(--border)',
                      borderLeft: n.leida ? '4px solid var(--border)' : '4px solid var(--accent)',
                      borderRadius: 12,
                      padding: 16,
                      background: n.leida ? 'var(--bg-card)' : 'rgba(225, 27, 34, 0.12)',
                      boxShadow: 'var(--pm-shadow-card, 0 2px 8px rgba(0,0,0,0.06))',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--accent)',
                        background: 'rgba(225,27,34,0.12)',
                        padding: '3px 8px',
                        borderRadius: 6,
                        marginBottom: 8,
                      }}
                    >
                      {tipoEtiqueta(t, n.tipo)}
                    </span>
                    <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: 15, fontWeight: 700 }}>
                      {n.titulo}
                    </strong>
                    <span
                      style={{
                        display: 'block',
                        color: 'var(--text-secondary)',
                        fontSize: 14,
                        lineHeight: 1.45,
                        marginTop: 6,
                        fontWeight: 400,
                      }}
                    >
                      {n.mensaje}
                    </span>
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginTop: 8 }}>
                      {fechaNotifLabel(n.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
