import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import HubDeporteSelect from '../components/HubDeporteSelect';
import { IconGeroCheck } from '../components/icons/GeroIcons';
import PartidoAbiertoCard, {
  PARTIDOS_ABIERTOS_PREVIEW_LIMIT,
  sortPartidosAbiertosPorFechaHora,
  usuarioYaEnPartido,
} from '../components/PartidoAbiertoCard';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { DEPORTES_CANCHA_SEDE_KEYS } from '../constants/deportesCanchaSede';
import { readHubDeporteFilterPersisted, writeHubDeporteFilterToSession } from '../constants/hubDeporteSession';
import {
  HUB_BOTTOM_NAV_CONTENT_GAP_PX,
  HUB_NAV_HEIGHT_PX,
  hubContentPaddingTopCss,
} from '../constants/hubLayout';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { savePartidosBuscarReturnUrl } from '../utils/reservaReturnUrl';
import { parseFetchJsonSafe } from '../utils/fetchJsonSafe';

const API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

const PARTIDOS_ABIERTOS_DEPORTE_DEFAULT = 'padbol';

function canonDeportePartidosAbiertos(raw) {
  const d = String(raw || '').trim().toLowerCase();
  return DEPORTES_CANCHA_SEDE_KEYS.includes(d) ? d : PARTIDOS_ABIERTOS_DEPORTE_DEFAULT;
}

export default function PartidosAbiertos() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAuth();
  const [partidos, setPartidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [joiningId, setJoiningId] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [updatingSolicitudId, setUpdatingSolicitudId] = useState(null);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [partidosVerTodos, setPartidosVerTodos] = useState(false);
  const hubDeporteHydratedRef = useRef(false);

  const deporteFiltro = canonDeportePartidosAbiertos(searchParams.get('deporte'));

  const setDeporteFiltro = (key) => {
    const canon = canonDeportePartidosAbiertos(key);
    const next = new URLSearchParams(searchParams);
    next.set('deporte', canon);
    setSearchParams(next, { replace: true });
    writeHubDeporteFilterToSession(canon);
  };

  useEffect(() => {
    if (hubDeporteHydratedRef.current) return;
    const d = String(searchParams.get('deporte') || '').trim().toLowerCase();
    if (DEPORTES_CANCHA_SEDE_KEYS.includes(d)) {
      writeHubDeporteFilterToSession(d);
      hubDeporteHydratedRef.current = true;
      return;
    }
    const fromSession = readHubDeporteFilterPersisted();
    const canon = canonDeportePartidosAbiertos(fromSession);
    const next = new URLSearchParams(searchParams);
    next.set('deporte', canon);
    setSearchParams(next, { replace: true });
    writeHubDeporteFilterToSession(canon);
    hubDeporteHydratedRef.current = true;
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const d = String(searchParams.get('deporte') || '').trim().toLowerCase();
    if (DEPORTES_CANCHA_SEDE_KEYS.includes(d)) return;
    setDeporteFiltro(PARTIDOS_ABIERTOS_DEPORTE_DEFAULT);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const cargar = useCallback(() => {
    setLoading(true);
    setMsg('');
    fetch(`${API_BASE}/api/partidos-abiertos`)
      .then(async (r) => {
        const { ok, data, isJson } = await parseFetchJsonSafe(r);
        if (!ok || !isJson) throw new Error(t('partidosAbiertos.loadError'));
        return data;
      })
      .then((data) => {
        setPartidos(Array.isArray(data) ? data : []);
      })
      .catch((err) => setMsg(err.message || t('partidosAbiertos.networkError')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cargarSolicitudes = useCallback(async () => {
    if (!session?.user) {
      setSolicitudes([]);
      return;
    }
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token || session.access_token;
      const res = await fetch(`${API_BASE}/api/partidos-abiertos/mis-solicitudes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { ok, data, isJson } = await parseFetchJsonSafe(res);
      if (ok && isJson && Array.isArray(data)) setSolicitudes(data);
      else setSolicitudes([]);
    } catch {
      setSolicitudes([]);
    }
  }, [session]);

  useEffect(() => {
    cargarSolicitudes();
  }, [cargarSolicitudes]);

  const partidosFiltrados = useMemo(
    () => partidos.filter((p) => String(p?.deporte || '').toLowerCase() === deporteFiltro),
    [partidos, deporteFiltro]
  );

  const partidosFiltradosOrdenados = useMemo(
    () => sortPartidosAbiertosPorFechaHora(partidosFiltrados),
    [partidosFiltrados]
  );

  const partidosVisibles = useMemo(
    () =>
      partidosVerTodos
        ? partidosFiltradosOrdenados
        : partidosFiltradosOrdenados.slice(0, PARTIDOS_ABIERTOS_PREVIEW_LIMIT),
    [partidosFiltradosOrdenados, partidosVerTodos]
  );

  useEffect(() => {
    setPartidosVerTodos(false);
  }, [deporteFiltro]);

  const pedirUnirse = async (partido) => {
    if (!session?.user) {
      const returnPath = `${location.pathname}${location.search || ''}`;
      savePartidosBuscarReturnUrl(returnPath);
      navigate(`/login?redirect=${encodeURIComponent(returnPath)}`);
      return;
    }
    if (usuarioYaEnPartido(partido, session.user.id, session.user.email)) return;
    setJoiningId(partido.id);
    setMsg('');
    setJoinSuccess(false);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token || session.access_token;
      const res = await fetch(`${API_BASE}/api/partidos-abiertos/${partido.id}/solicitudes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const { ok, data, isJson } = await parseFetchJsonSafe(res);
      if (!ok || !isJson) throw new Error((data && data.error) || t('partidosAbiertos.sendRequestError'));
      if (data?.error) throw new Error(data.error);
      setJoinSuccess(true);
      setMsg('');
    } catch (err) {
      setMsg(err.message || t('partidosAbiertos.sendRequestError'));
    } finally {
      setJoiningId(null);
    }
  };

  const resolverSolicitud = async (solicitud, estado) => {
    setUpdatingSolicitudId(solicitud.id);
    setMsg('');
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token || session.access_token;
      const res = await fetch(`${API_BASE}/api/partidos-abiertos/solicitudes/${solicitud.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado }),
      });
      const { ok, data, isJson } = await parseFetchJsonSafe(res);
      if (!ok || !isJson) throw new Error(t('partidosAbiertos.updateRequestError'));
      if (data?.error) throw new Error(data.error);
      setMsg(
        estado === 'aceptada'
          ? t('partidosAbiertos.requestAccepted')
          : t('partidosAbiertos.requestRejected')
      );
      cargar();
      await cargarSolicitudes();
    } catch (err) {
      setMsg(err.message || t('partidosAbiertos.manageRequestError'));
    } finally {
      setUpdatingSolicitudId(null);
    }
  };

  const mainBottomPad =
    navDock === 'bottom'
      ? `calc(20px + ${HUB_NAV_HEIGHT_PX}px + ${HUB_BOTTOM_NAV_CONTENT_GAP_PX}px + env(safe-area-inset-bottom, 0px))`
      : `calc(20px + env(safe-area-inset-bottom, 0px))`;

  return (
    <div
      style={{
        minHeight: '100dvh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: 'var(--bg-page)',
        color: 'var(--text-primary)',
        paddingTop: hubContentPaddingTopCss(location.pathname, navDock),
        boxSizing: 'border-box',
      }}
    >
      <AppHeader title={t('jugar.buscar')} />
      <main
        style={{
          width: '100%',
          maxWidth: 460,
          margin: '0 auto',
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 14,
          paddingBottom: mainBottomPad,
          boxSizing: 'border-box',
        }}
      >
        <HubDeporteSelect
          compact
          allowAllSports={false}
          id="partidos-abiertos-deporte"
          value={deporteFiltro}
          onChange={setDeporteFiltro}
        />

        <div style={{ marginTop: 10 }}>
        {joinSuccess ? (
          <section
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 22,
              marginBottom: 16,
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                margin: '0 auto 10px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 20px rgba(22,163,74,0.35)',
              }}
            >
              <IconGeroCheck size={30} style={{ color: '#fff' }} />
            </div>
            <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: 20, fontWeight: 700 }}>{t('partidosAbiertos.joinSuccessTitle')}</h2>
            <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 400 }}>
              {t('partidosAbiertos.joinSuccessBody')}
            </p>
            <button
              type="button"
              onClick={() => navigate('/mi-perfil')}
              style={{
                width: '100%',
                maxWidth: 280,
                padding: '14px 24px',
                borderRadius: 8,
                border: '2px solid #16A34A',
                background: 'transparent',
                color: '#16A34A',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              {t('partidosAbiertos.myMatches')}
            </button>
          </section>
        ) : null}

        {msg ? (
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
              color: 'var(--text-primary)',
              fontSize: 14,
              fontWeight: 600,
              border: '1px solid var(--border)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            {msg}
          </div>
        ) : null}

        {solicitudes.length > 0 ? (
          <section
            style={{
              background: 'var(--bg-card)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid var(--border)',
            }}
          >
            <h2 style={{ margin: '0 0 10px', color: 'var(--text-primary)', fontSize: 17, fontWeight: 700 }}>{t('partidosAbiertos.requestsTitle')}</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {solicitudes.map((s) => (
                <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>{s.jugador_nombre}</strong>
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, fontWeight: 400 }}>
                    {t('partidosAbiertos.wantsToPlayAt', {
                      venue: s.partido?.sede_nombre || t('partidosAbiertos.yourMatch'),
                    })} · {String(s.partido?.hora || '').slice(0, 5)}
                  </span>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => resolverSolicitud(s, 'aceptada')}
                      disabled={updatingSolicitudId === s.id}
                      style={{
                        flex: 1,
                        border: 'none',
                        borderRadius: 8,
                        padding: '12px 10px',
                        background: '#16A34A',
                        color: '#fff',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {t('partidosAbiertos.accept')}
                    </button>
                    <button
                      type="button"
                      onClick={() => resolverSolicitud(s, 'rechazada')}
                      disabled={updatingSolicitudId === s.id}
                      style={{
                        flex: 1,
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '12px 10px',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {t('partidosAbiertos.reject')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {loading ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 30, fontWeight: 400 }}>{t('partidosAbiertos.loadingMatches')}</p>
        ) : partidosFiltradosOrdenados.length === 0 ? (
          <section
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              borderRadius: 12,
              padding: 24,
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              border: '1px solid var(--border)',
            }}
          >
            <h2 style={{ margin: '0 0 10px', color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>
              {t('partidosAbiertos.emptyTitle')}
            </h2>
            <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 400 }}>
              {t('partidosAbiertos.emptyFilterHint')}
            </p>
            <button
              type="button"
              onClick={() => navigate('/armar-partido')}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '14px 24px',
                background: 'var(--accent)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              {t('partidosAbiertos.armarPartido')}
            </button>
          </section>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {partidosVisibles.map((p) => (
              <PartidoAbiertoCard key={p.id} partido={p} onJoin={pedirUnirse} joining={joiningId === p.id} />
            ))}
            {partidosFiltradosOrdenados.length > PARTIDOS_ABIERTOS_PREVIEW_LIMIT && !partidosVerTodos ? (
              <button
                type="button"
                className="partidos-abiertos-ver-mas"
                onClick={() => setPartidosVerTodos(true)}
              >
                {t('partidosAbiertos.seeMoreMatches')} →
              </button>
            ) : null}
          </div>
        )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
