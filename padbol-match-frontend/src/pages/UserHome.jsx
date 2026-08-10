import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import {
  HUB_APP_HEADER_HEIGHT_PX,
  hubHubScrollPaddingBottomCss,
  hubInstagramColumnWrapStyle,
  hubUserHomeChromeSpacerHeightCss,
} from '../constants/hubLayout';
import { useAuth } from '../context/AuthContext';
import { useHubNavLayout } from '../context/HubNavLayoutContext';
import { nombreSaludoParaHub } from '../utils/displayName';
import PwaInstallButtonWithModal from '../components/PwaInstallButtonWithModal';
import { PERFIL_CHANGE_EVENT } from '../utils/jugadorPerfil';
import { isPwaStandalone } from '../utils/isPwaStandalone';
import useUserRole from '../hooks/useUserRole';
import { useHubSponsors } from '../hooks/useHubSponsors';
import HubTercerTiempoSponsor from '../components/HubTercerTiempoSponsor';
import HubDeporteSelect from '../components/HubDeporteSelect';
import { DEPORTES_CANCHA_SEDE_KEYS, DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import {
  readHubDeporteFilterPersisted,
  resolveHubDeporteElegido,
  writeHubDeporteFilterToSession,
} from '../constants/hubDeporteSession';
import { hubCardPhotoFallback, hubCardPhotoPorDeporte } from '../constants/hubFotosPorDeporte';
import SportIcon, { SPORT_ICON_COLOR_ON_DARK } from '../components/common/SportIcon';
import { pickHubDeporteRow, dedupeHubDeporteConfigRows, hubDeporteRowImagenUrl } from '../utils/hubDeporteConfig';
import { HUB_INICIO_CARD_IDS, deporteHubInicioDesdeRow } from '../constants/hubInicioCards';
import HubThemeSettingsButton from '../components/HubThemeSettingsButton';
import LanguageSwitcher from '../components/LanguageSwitcher';
import './UserHome.css';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { usePadbolLangVersion } from '../hooks/usePadbolLang';
import { intentarNavegarHubConPerfilJugadorMinimo } from '../utils/perfilJugadorMinimo';

/**
 * Hub principal (cards + deporte + PWA…).
 *
 * ANTES DE COMMIT si tocás este archivo: /hub con y sin sesión — selector «Elegir deporte» siempre visible,
 * cards y bloque inferior sin quedar bajo el header fijo (spacer + paddingTop del scroll).
 */

const HUB_COLUMN_MAX = 390;

const HUB_CARD_OVERLAY = 'rgba(180, 20, 20, 0.35)';
const HUB_CARD_FALLBACK_BG = '#2d2d2d';
/** Separación entre cards del hub. */
const HUB_CARD_GAP_PX = 8;
/** Aire bajo el chrome fijo antes del contenido (máx. compacto para acercar «Elegir deporte» arriba). */
const USER_HOME_SCROLL_INNER_PAD_TOP_PX = 0;

function deporteQuery(deporteElegido) {
  const dep = String(deporteElegido || '').trim().toLowerCase();
  return dep && DEPORTES_CANCHA_SEDE_KEYS.includes(dep) ? `?deporte=${encodeURIComponent(dep)}` : '';
}

function etiquetaDeporteHub(key) {
  const k = String(key || '').trim().toLowerCase();
  return DEPORTES_CANCHA_SEDE_OPTIONS.find((d) => d.key === k)?.label || '';
}

/** Título con sufijo de deporte si aplica; subtítulos fijos del producto. */
function tituloHubCardConDeporte(tituloBase, deporteKey) {
  if (!deporteKey || !DEPORTES_CANCHA_SEDE_KEYS.includes(deporteKey)) return tituloBase;
  const label = etiquetaDeporteHub(deporteKey);
  return `${tituloBase} · ${label}`;
}

function pickHubCmsPhotoUrl(rows, cmsPhotoIds) {
  if (!Array.isArray(rows) || !cmsPhotoIds?.length) return '';
  for (const wantedId of cmsPhotoIds) {
    const row = rows.find((r) => {
      if (r == null || typeof r !== 'object') return false;
      if (r.activo === false || r.activo === 'false' || r.activo === 0) return false;
      return String(r.id || '').trim() === wantedId;
    });
    const foto = row && String(row.foto_url || '').trim();
    if (foto) return foto;
  }
  return '';
}

const HUB_API_BASE = (
  typeof process !== 'undefined' && process.env.REACT_APP_API_BASE_URL
    ? String(process.env.REACT_APP_API_BASE_URL).replace(/\/$/, '')
    : 'https://padbol-backend.onrender.com'
);

const ADMIN_ROLES_CHIP = ['super_admin', 'admin_nacional', 'admin_club', 'empleado', 'editor_contenido'];
const LEGACY_GLOBAL_ADMIN_EMAILS = [
  'padbolinternacional@gmail.com',
  'admin@padbol.com',
  'sm@padbol.com',
];

function readCachedRolHeader() {
  try {
    return JSON.parse(localStorage.getItem('user_role_data') || '{}')?.rol || null;
  } catch {
    return null;
  }
}

function emailEsLegacyAdminHub(emailRaw) {
  const email = String(emailRaw || '').trim().toLowerCase();
  return LEGACY_GLOBAL_ADMIN_EMAILS.includes(email);
}

const hubPwaInstallButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  padding: '14px 24px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export default function UserHome() {
  const { t } = useTranslation();
  usePadbolLangVersion();
  const navigate = useNavigate();
  const location = useLocation();
  const { navDock } = useHubNavLayout();
  const { session, loading: authLoading, userProfile, profileLoading, refreshSession } = useAuth();
  const [deporteElegido, setDeporteElegido] = useState(() => readHubDeporteFilterPersisted());
  const [deporteHydrationDone, setDeporteHydrationDone] = useState(() =>
    Boolean(readHubDeporteFilterPersisted()),
  );
  const [hubCmsStatus, setHubCmsStatus] = useState('loading');
  const [hubCmsRows, setHubCmsRows] = useState([]);
  const [hubDeporteStatus, setHubDeporteStatus] = useState('loading');
  const [hubDeporteRows, setHubDeporteRows] = useState([]);
  /** Filas hub_config solo para la grilla de inicio (fetch dedicado). */
  const [hubInicioRows, setHubInicioRows] = useState([]);
  /** Si la URL de fondo falla al cargar, se oculta y se usa el fondo gris oscuro. */
  const [hubCardImageFailed, setHubCardImageFailed] = useState({});
  const [hubAdminRolEver, setHubAdminRolEver] = useState(() => {
    if (ADMIN_ROLES_CHIP.includes(readCachedRolHeader() || '')) return true;
    if (emailEsLegacyAdminHub(session?.user?.email)) return true;
    return false;
  });

  const currentCliente = useMemo(() => {
    const em = String(session?.user?.email || '').trim();
    if (!em) return null;
    return { email: em };
  }, [session?.user?.email]);
  const { rol, loading: roleLoading, sedeId: hubSedeId, pais: hubPaisUsuario } = useUserRole(currentCliente);

  useEffect(() => {
    if (!session?.user) {
      setHubAdminRolEver(false);
      return;
    }
    if (emailEsLegacyAdminHub(session.user.email)) setHubAdminRolEver((p) => p || true);
    if (ADMIN_ROLES_CHIP.includes(rol || '')) setHubAdminRolEver((p) => p || true);
  }, [session?.user, rol]);

  const rolEffective = useMemo(() => {
    const cached = readCachedRolHeader();
    const fromJwt = (() => {
      const r = String(
        session?.user?.app_metadata?.role ?? session?.user?.user_metadata?.role ?? ''
      )
        .trim()
        .toLowerCase();
      return ADMIN_ROLES_CHIP.includes(r) ? r : null;
    })();
    return rol || cached || fromJwt;
  }, [rol, session?.user?.app_metadata?.role, session?.user?.user_metadata?.role]);

  const esRolAdminHub =
    hubAdminRolEver ||
    ADMIN_ROLES_CHIP.includes(rolEffective || '') ||
    (Boolean(roleLoading) &&
      LEGACY_GLOBAL_ADMIN_EMAILS.includes(String(session?.user?.email || '').trim().toLowerCase()));
  const isOnAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const showAdminShortcut = Boolean(session?.user) && esRolAdminHub;

  useEffect(() => {
    const onPerfil = () => {
      void refreshSession();
    };
    window.addEventListener(PERFIL_CHANGE_EVENT, onPerfil);
    return () => window.removeEventListener(PERFIL_CHANGE_EVENT, onPerfil);
  }, [refreshSession]);

  useEffect(() => {
    if (session?.user) return;
    try {
      localStorage.removeItem('padbol_nombre_saludo');
      localStorage.removeItem('padbol_nombre_saludo_uid');
    } catch {
      /* ignore */
    }
  }, [session?.user]);

  useEffect(() => {
    setDeporteHydrationDone(Boolean(readHubDeporteFilterPersisted()));
  }, [session?.user?.id]);

  /** Tras login: aplicar deporte guardado (sesión, perfil o localStorage) sin mostrar la grilla de bienvenida en cada ingreso. */
  useEffect(() => {
    if (authLoading) return;
    if (session?.user && profileLoading) return;

    const resolved = resolveHubDeporteElegido({
      current: deporteElegido,
    });

    if (resolved && resolved !== deporteElegido) {
      setDeporteElegido(resolved);
      writeHubDeporteFilterToSession(resolved);
    }
    setDeporteHydrationDone(true);
  }, [authLoading, profileLoading, session?.user, userProfile, deporteElegido]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${HUB_API_BASE}/api/hub-config/inicio-cards`);
        const data = await res.json().catch(() => null);
        // eslint-disable-next-line no-console
        console.log('[UserHome] hub_inicio_cards fetch', {
          ok: res.ok,
          status: res.status,
          raw: data,
          rows: Array.isArray(data) ? data : [],
        });
        if (cancelled) return;
        setHubInicioRows(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setHubInicioRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${HUB_API_BASE}/api/hub-config`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !Array.isArray(data)) {
          setHubCmsStatus('error');
          setHubCmsRows([]);
          return;
        }
        setHubCmsRows(data);
        setHubCmsStatus('ok');
      } catch {
        if (!cancelled) {
          setHubCmsStatus('error');
          setHubCmsRows([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${HUB_API_BASE}/api/hub-deporte-config`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !Array.isArray(data)) {
          setHubDeporteStatus('error');
          setHubDeporteRows([]);
          return;
        }
        setHubDeporteRows(dedupeHubDeporteConfigRows(data));
        setHubDeporteStatus('ok');
      } catch {
        if (!cancelled) {
          setHubDeporteStatus('error');
          setHubDeporteRows([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setHubCardImageFailed({});
  }, [hubCmsRows, hubCmsStatus, hubDeporteRows, hubDeporteStatus, deporteElegido]);

  const nombreTitulo = useMemo(
    () => (session?.user ? nombreSaludoParaHub(userProfile, session) : ''),
    [session, userProfile],
  );

  const hubFotoUrl = String(userProfile?.foto_url || userProfile?.foto || '').trim();
  const hubInicial = String((nombreTitulo || '').trim() || '?')
    .charAt(0)
    .toUpperCase();


  const paisParaSponsors = String(hubPaisUsuario || userProfile?.pais || '').trim();
  const deporteTickerUserHome = useMemo(() => {
    const d = String(deporteElegido || '').trim().toLowerCase();
    return d && DEPORTES_CANCHA_SEDE_KEYS.includes(d) ? d : null;
  }, [deporteElegido]);
  const { tercerTiempoSponsor } = useHubSponsors({
    sedeId: hubSedeId != null && Number.isFinite(Number(hubSedeId)) ? Number(hubSedeId) : null,
    pais: paisParaSponsors,
    deporte: deporteTickerUserHome,
    enabled: true,
  });

  /** Grilla de 4 deportes solo si, tras hidratar, aún no hay deporte resuelto. */
  const showBienvenidaCuatroDeportes = useMemo(() => {
    if (!deporteHydrationDone) return false;
    const dep = String(deporteElegido || '').trim().toLowerCase();
    return !(dep && DEPORTES_CANCHA_SEDE_KEYS.includes(dep));
  }, [deporteElegido, deporteHydrationDone]);

  const inicioTiles = useMemo(() => {
    const rows = Array.isArray(hubInicioRows) ? hubInicioRows : [];
    return HUB_INICIO_CARD_IDS.map((id, idx) => {
      const row = rows.find((r) => String(r?.id || '') === id) || null;
      const tituloRow = String(row?.titulo ?? '').trim();
      const deporte = deporteHubInicioDesdeRow(row, idx);
      const foto =
        String(row?.foto_url || '').trim() || hubCardPhotoPorDeporte(deporte, 'reservar');
      const label = tituloRow || etiquetaDeporteHub(deporte) || deporte;
      return { id, deporte, foto, label };
    });
  }, [hubInicioRows]);

  const hubFixedActions = useMemo(
    () => [
      {
        key: 'reservar',
        titulo: t('jugar.reservar'),
        subtitulo: t('hub.card.reservarSub'),
        to: '/reservar',
        cmsPhotoIds: ['reservar'],
      },
      {
        key: 'buscar_partido',
        titulo: t('jugar.buscar'),
        subtitulo: t('jugar.buscarBody'),
        to: '/jugar/buscar',
        cmsPhotoIds: ['buscar_partido', 'partidos'],
      },
      {
        key: 'torneos',
        titulo: t('competir.torneosCard'),
        subtitulo: t('hub.card.torneosSub'),
        to: '/competir',
        cmsPhotoIds: ['torneos'],
      },
      {
        key: 'armar_partido',
        titulo: t('jugar.armar'),
        subtitulo: t('jugar.armarBody'),
        to: '/jugar/armar',
        cmsPhotoIds: ['armar_partido', 'jugar', 'armar-partido'],
      },
    ],
    [t],
  );

  const bigCards = useMemo(() => {
    const q = deporteQuery(deporteElegido);
    const rows = hubCmsStatus === 'ok' && Array.isArray(hubCmsRows) ? hubCmsRows : [];
    const depRows = Array.isArray(hubDeporteRows) ? hubDeporteRows : [];
    const hubDeporteOk = hubDeporteStatus === 'ok';
    return hubFixedActions.map((slot) => {
      const depRow = hubDeporteOk ? pickHubDeporteRow(depRows, deporteElegido, slot.key) : null;
      const depFoto = depRow && hubDeporteRowImagenUrl(depRow);
      const cmsUrl = pickHubCmsPhotoUrl(rows, slot.cmsPhotoIds);
      const porDeporte = deporteElegido ? hubCardPhotoPorDeporte(deporteElegido, slot.key) : '';
      const fallbackUrl = porDeporte || hubCardPhotoFallback(slot.key);
      const imageUrl = depFoto || cmsUrl || fallbackUrl;
      const tituloBase =
        depRow && String(depRow.titulo || '').trim() ? String(depRow.titulo).trim() : slot.titulo;
      const subtitulo =
        depRow != null && depRow.subtitulo != null ? String(depRow.subtitulo) : slot.subtitulo;
      return {
        key: slot.key,
        titulo: tituloHubCardConDeporte(tituloBase, deporteElegido),
        subtitulo,
        imageUrl,
        onClick: () =>
          intentarNavegarHubConPerfilJugadorMinimo(navigate, userProfile, slot.key, `${slot.to}${q}`),
      };
    });
  }, [hubCmsStatus, hubCmsRows, hubDeporteStatus, hubDeporteRows, navigate, deporteElegido, hubFixedActions, userProfile]);

  const scrollPaddingBottom = hubHubScrollPaddingBottomCss(navDock);
  const userHomeChromeSpacerH = useMemo(
    () =>
      hubUserHomeChromeSpacerHeightCss(
        location.pathname,
        {
          guest: !session?.user,
        },
        navDock,
      ),
    [location.pathname, session?.user, navDock],
  );

  /** Scroll arriba al montar y en cada cambio de ruta del hub (/hub, /inicio, /home). */
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
    try {
      if (typeof document !== 'undefined') {
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
        const container = document.querySelector('.hub-scroll-container');
        if (container) container.scrollTop = 0;
      }
    } catch {
      /* ignore */
    }
  }, [location.pathname]);

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100dvh',
        background: 'var(--bg-page)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        boxSizing: 'border-box',
      }}
    >
      <header
        className="app-header-shell"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1002,
          minHeight: `${HUB_APP_HEADER_HEIGHT_PX}px`,
          background: 'var(--nav-bg)',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--nav-border)',
          paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="app-header-inner app-header-inner--max-body"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            minHeight: HUB_APP_HEADER_HEIGHT_PX,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            {session?.user ? (
              <button
                type="button"
                onClick={() => {
                  if (esRolAdminHub) {
                    navigate(
                      rolEffective === 'editor_contenido'
                        ? '/admin?tab=personalizar_hub'
                        : '/admin'
                    );
                    return;
                  }
                  navigate('/mi-perfil');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  minWidth: 0,
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
                aria-label={esRolAdminHub ? t('hub.goToAdmin') : t('hub.goToProfile')}
              >
                {hubFotoUrl ? (
                  <img
                    src={hubFotoUrl}
                    alt=""
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0,
                      border: '2px solid var(--border)',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: 'var(--bg-card)',
                      color: 'var(--accent)',
                      fontSize: 18,
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      border: '2px solid var(--border)',
                    }}
                  >
                    {hubInicial}
                  </span>
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: 'var(--text-primary)',
                      fontSize: 22,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {nombreTitulo ? t('hub.helloName', { name: nombreTitulo }) : t('hub.helloShort')}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 400, marginTop: 2 }}>{t('hub.welcomeBack')}</div>
                </div>
              </button>
            ) : (
              <>
                <span
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'var(--bg-card)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 22,
                    flexShrink: 0,
                    border: '1px solid var(--border)',
                  }}
                  aria-hidden
                >
                  👋
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: 'var(--text-primary)',
                      fontSize: 22,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('hub.hello')}
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {session?.user ? (
              <button
                type="button"
                onClick={() => navigate('/soporte')}
                aria-label="Abrir soporte"
                title="Soporte"
                style={{
                  height: 36,
                  width: 36,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: 17,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ?
              </button>
            ) : null}
            <LanguageSwitcher variant="header" />
            <HubThemeSettingsButton compact />
            {showAdminShortcut ? (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    isOnAdmin
                      ? '/'
                      : rolEffective === 'editor_contenido'
                        ? '/admin?tab=personalizar_hub'
                        : '/admin'
                  )
                }
                aria-label={isOnAdmin ? t('hub.backToApp') : t('hub.goToAdmin')}
                title={isOnAdmin ? 'App' : 'Admin'}
                style={{
                  height: 36,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isOnAdmin ? '←' : '⚙'}
              </button>
            ) : null}
            {!session?.user && authLoading ? (
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>…</span>
            ) : !session?.user ? (
              <button
                type="button"
                onClick={() => navigate('/acceso')}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t('auth.signIn')}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: '100%',
          height: userHomeChromeSpacerH,
          pointerEvents: 'none',
          background: 'var(--bg-page)',
        }}
      />

      <div
        className="hub-scroll-container"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          width: '100%',
          boxSizing: 'border-box',
          paddingTop: USER_HOME_SCROLL_INNER_PAD_TOP_PX,
          paddingBottom: scrollPaddingBottom,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          background: 'var(--bg-page)',
        }}
      >
        <div
          style={{
            ...hubInstagramColumnWrapStyle,
            width: '100%',
            maxWidth: HUB_COLUMN_MAX,
            marginLeft: 'auto',
            marginRight: 'auto',
            paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
            paddingTop: 0,
            paddingBottom: 0,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          {showBienvenidaCuatroDeportes ? (
            <>
              <p
                style={{
                  margin: '0 0 10px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                  flexShrink: 0,
                }}
              >
                {t('hub.selectSportForHub')}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: HUB_CARD_GAP_PX,
                  width: '100%',
                  marginBottom: 12,
                  flexShrink: 0,
                }}
              >
                {inicioTiles.map((tile) => {
                  const failId = `inicio|${tile.id}|${tile.foto || ''}`;
                  const showPhoto = Boolean(tile.foto) && !hubCardImageFailed[failId];
                  return (
                    <button
                      key={tile.id}
                      type="button"
                      className="hub-surface-card"
                      onClick={() => {
                        setDeporteElegido(tile.deporte);
                        writeHubDeporteFilterToSession(tile.deporte);
                      }}
                      style={{
                        position: 'relative',
                        width: '100%',
                        minHeight: 140,
                        aspectRatio: '1',
                        textAlign: 'left',
                        border: 'none',
                        borderRadius: 12,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        padding: 0,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                        backgroundColor: showPhoto ? '#1a1a1a' : HUB_CARD_FALLBACK_BG,
                      }}
                    >
                      {showPhoto && tile.foto ? (
                        <div
                          className="hub-card-cover-layer"
                          style={{ backgroundImage: `url(${tile.foto})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                          aria-hidden
                        />
                      ) : null}
                      {tile.foto ? (
                        <img
                          alt=""
                          src={tile.foto}
                          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                          onError={() => {
                            setHubCardImageFailed((prev) => {
                              if (prev[failId]) return prev;
                              return { ...prev, [failId]: true };
                            });
                          }}
                        />
                      ) : null}
                      <div
                        aria-hidden
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: HUB_CARD_OVERLAY,
                        }}
                      />
                      <div
                        className="hub-surface-card__text"
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          height: '100%',
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end',
                          alignItems: 'flex-start',
                          boxSizing: 'border-box',
                          padding: '10px 12px',
                        }}
                      >
                        <span
                          className="hub-surface-card__title"
                          style={{
                            fontSize: 16,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <SportIcon
                            deporte={tile.deporte}
                            size={20}
                            color={SPORT_ICON_COLOR_ON_DARK}
                            style={{ color: SPORT_ICON_COLOR_ON_DARK }}
                            className="hub-surface-card__sport-icon"
                          />
                          {tile.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
          <HubDeporteSelect
            value={deporteElegido}
            onChange={(v) => {
              setDeporteElegido(v);
              writeHubDeporteFilterToSession(v);
            }}
          />

          {!authLoading && !session?.user ? (
            <p
              style={{
                textAlign: 'center',
                margin: '0 0 6px',
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--text-secondary)',
                lineHeight: 1.35,
                flexShrink: 0,
              }}
            >
              {t('landing.guestNote')}
            </p>
          ) : null}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: HUB_CARD_GAP_PX,
              width: '100%',
              height: 'auto',
              flexShrink: 0,
              marginBottom: 0,
            }}
          >
            {!showBienvenidaCuatroDeportes
              ? bigCards.map((c) => {
              const failId = `${c.key}|${c.imageUrl || ''}`;
              const showPhoto = Boolean(c.imageUrl) && !hubCardImageFailed[failId];
              return (
              <button
                key={c.key}
                type="button"
                onClick={c.onClick}
                className="hub-surface-card"
                style={{
                  position: 'relative',
                  width: '100%',
                  flex: '0 0 auto',
                  textAlign: 'left',
                  border: 'none',
                  borderRadius: 12,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  backgroundColor: showPhoto ? '#1a1a1a' : HUB_CARD_FALLBACK_BG,
                }}
              >
                {showPhoto && c.imageUrl ? (
                  <div
                    key={failId}
                    className="hub-card-cover-layer"
                    style={{ backgroundImage: `url(${c.imageUrl})` }}
                    aria-hidden
                  />
                ) : null}
                {c.imageUrl ? (
                  <img
                    alt=""
                    src={c.imageUrl}
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    onError={() => {
                      setHubCardImageFailed((prev) => {
                        if (prev[failId]) return prev;
                        return { ...prev, [failId]: true };
                      });
                    }}
                  />
                ) : null}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: HUB_CARD_OVERLAY,
                  }}
                />
                <div
                  className="hub-surface-card__text"
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'flex-start',
                    boxSizing: 'border-box',
                  }}
                >
                  <span className="hub-surface-card__title">{c.titulo}</span>
                  {c.subtitulo ? (
                    <span className="hub-surface-card__sub">{c.subtitulo}</span>
                  ) : null}
                </div>
              </button>
            );
            })
              : null}
            <HubTercerTiempoSponsor sponsor={tercerTiempoSponsor} />

            {!isPwaStandalone() ? (
              <div
                style={{
                  flexShrink: 0,
                  width: '100%',
                  marginTop: 14,
                  paddingBottom: 8,
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    color: 'var(--text-primary)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                >
                  <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 400, lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                    {t('hub.pwaPromo')}
                  </p>
                  <PwaInstallButtonWithModal buttonStyle={hubPwaInstallButtonStyle} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
